-- Social posting + reply automation. Modeled on the per-firm pattern used
-- everywhere else: each firm connects its own Facebook/Instagram/X/LinkedIn
-- accounts and queues posts + auto-DMs from there.
--
-- Tokens are encrypted at rest using pgcrypto's symmetric `pgp_sym_encrypt`,
-- with the key passed at query time from the SOCIAL_TOKEN_KEY secret.
-- Code that touches social_accounts.access_token MUST go through
-- lib/social/encrypt.ts so the key never leaks into shell history or logs.

create type social_platform as enum ('facebook', 'instagram', 'x', 'linkedin');
create type social_account_status as enum ('connected', 'expired', 'revoked', 'paused');
create type social_post_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed', 'canceled');
create type social_comment_action as enum ('send_dm', 'add_tag', 'enroll_workflow');

-- ─── Connected social accounts ────────────────────────────────────────────────
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  platform social_platform not null,
  external_id text not null,               -- FB Page ID, IG Business Account ID, etc
  display_name text not null,
  username text,
  avatar_url text,
  -- Encrypted via pgp_sym_encrypt(token, current_setting('app.token_key'))
  access_token_encrypted bytea,
  refresh_token_encrypted bytea,
  expires_at timestamptz,
  scopes text[],
  status social_account_status not null default 'connected',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_social_accounts_firm_external on social_accounts(firm_id, platform, external_id);
create index idx_social_accounts_firm on social_accounts(firm_id);
create index idx_social_accounts_status on social_accounts(status) where status = 'connected';

-- ─── Posts (queue + history) ──────────────────────────────────────────────────
create table social_posts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  platform social_platform not null,
  body text not null,
  media_urls text[],
  link_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  status social_post_status not null default 'draft',
  external_post_id text,
  external_url text,
  error text,
  open_count int default 0,
  reply_count int default 0,
  share_count int default 0,
  reaction_count int default 0,
  workflow_run_id uuid,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_social_posts_firm on social_posts(firm_id, created_at desc);
create index idx_social_posts_due on social_posts(scheduled_at) where status = 'scheduled';
create index idx_social_posts_external on social_posts(platform, external_post_id) where external_post_id is not null;

-- ─── Comment triggers (ManyChat-style) ────────────────────────────────────────
create table social_comment_triggers (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  -- nullable: matches comments on ANY post for the account
  post_id uuid references social_posts(id) on delete cascade,
  keyword citext not null,
  match_mode text not null default 'contains',  -- contains | starts_with | exact
  action social_comment_action not null,
  action_payload jsonb not null default '{}'::jsonb,
  -- e.g. { dm_template: 'lead_magnet_checklist', tag: 'commented-notice', workflow_id: '...' }
  active boolean not null default true,
  match_count int default 0,
  last_matched_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_social_comment_triggers_firm on social_comment_triggers(firm_id) where active;
create index idx_social_comment_triggers_account on social_comment_triggers(account_id) where active;

-- ─── Inbound comments (every comment ever received on a connected account) ───
create table social_comments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  post_id uuid references social_posts(id) on delete set null,
  external_comment_id text not null,
  external_post_id text,
  commenter_external_id text,
  commenter_handle text,
  commenter_name text,
  comment_text text,
  media_url text,
  matched_trigger_id uuid references social_comment_triggers(id) on delete set null,
  matched_at timestamptz,
  contact_id uuid references contacts(id) on delete set null,
  received_at timestamptz not null default now()
);

create unique index idx_social_comments_external on social_comments(account_id, external_comment_id);
create index idx_social_comments_firm on social_comments(firm_id, received_at desc);
create index idx_social_comments_post on social_comments(post_id);
create index idx_social_comments_unmatched on social_comments(firm_id) where matched_trigger_id is null;

-- ─── DMs sent in response to triggers ────────────────────────────────────────
create table social_dms (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  trigger_id uuid references social_comment_triggers(id) on delete set null,
  comment_id uuid references social_comments(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  recipient_external_id text not null,
  recipient_handle text,
  body text not null,
  external_message_id text,
  status text not null default 'pending',     -- pending | sent | delivered | failed | blocked
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_social_dms_firm on social_dms(firm_id, created_at desc);
create index idx_social_dms_pending on social_dms(status) where status = 'pending';

-- ─── Trigger updated_at on social_accounts + social_posts ────────────────────
do $$
begin
  drop trigger if exists trg_social_accounts_updated_at on social_accounts;
  create trigger trg_social_accounts_updated_at before update on social_accounts
    for each row execute function set_updated_at();
  drop trigger if exists trg_social_posts_updated_at on social_posts;
  create trigger trg_social_posts_updated_at before update on social_posts
    for each row execute function set_updated_at();
end $$;

-- ─── Helper to read a decrypted access token in one round trip ───────────────
-- USAGE (server-side only, with SOCIAL_TOKEN_KEY in pg session):
--   set local app.token_key = '<key from Secret Manager>';
--   select social_account_decrypted_token($1);
create or replace function social_account_decrypted_token(p_account_id uuid)
returns text language plpgsql security invoker stable as $$
declare v_token text;
begin
  select pgp_sym_decrypt(access_token_encrypted, current_setting('app.token_key'))::text
    into v_token
    from social_accounts
   where id = p_account_id;
  return v_token;
end $$;
