-- NoticeReply core schema. Multi-tenant via firm_id with RLS on every table.
-- Service-role bypasses RLS for cron/webhook/admin paths.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── Enums ────────────────────────────────────────────────────────────────────
create type firm_plan as enum ('founding', 'standard', 'pro');
create type user_role as enum ('owner', 'admin', 'member', 'viewer');
create type notice_type as enum (
  'CP2000','CP14','CP504','LT11','CP501','CP503','CP523','CP90','CP91','CP297','CP161','LT16','OTHER'
);
create type notice_status as enum (
  'uploaded','classified','drafted','reviewed','mailed','irs_responded','resolved','rejected'
);
create type lifecycle_stage as enum (
  'subscriber','lead','mql','sql','customer','evangelist','churned'
);
create type deal_status as enum ('open','won','lost');
create type activity_type as enum (
  'email_sent','email_open','email_click','email_reply','email_bounce','email_unsubscribe',
  'page_view','form_submit','note','call','task','task_completed',
  'deal_created','deal_stage_change','deal_won','deal_lost',
  'notice_uploaded','notice_classified','notice_drafted','notice_mailed','notice_resolved',
  'tag_added','tag_removed','identified','workflow_enrolled','workflow_completed','workflow_exited'
);
create type send_category as enum ('marketing','transactional','workflow_personal','workflow_bulk');
create type sending_domain_status as enum ('verifying','warming','live','paused');
create type campaign_status as enum ('draft','scheduled','sending','sent','paused','canceled');
create type email_event_type as enum ('open','click','bounce','complaint','unsubscribe','delivered');
create type suppression_reason as enum ('bounce','complaint','unsubscribe','manual');
create type workflow_archetype as enum ('short_term','long_term','evergreen');
create type workflow_status as enum ('draft','active','paused','archived');
create type workflow_run_status as enum ('running','waiting','completed','failed','exited');

-- ─── Firms / users ────────────────────────────────────────────────────────────
create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext unique not null,
  logo_url text,
  default_signer_name text,
  default_signer_title text,
  plan firm_plan not null default 'founding',
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  custom_email_domain citext,
  api_key_hash text,
  api_key_last4 text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table firm_users (
  firm_id uuid not null references firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'member',
  invited_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);

create index idx_firm_users_user on firm_users(user_id);

-- Helper: which firms can the current authed user see?
create or replace function current_firm_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select firm_id from firm_users where user_id = auth.uid()
$$;

-- ─── Taxpayer clients (encrypted PII) ─────────────────────────────────────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  display_name text not null,
  email_encrypted bytea,
  phone_encrypted bytea,
  ssn_last4 text,
  address_line1_encrypted bytea,
  address_line2_encrypted bytea,
  city text,
  state text,
  zip text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_firm on clients(firm_id);

-- ─── Notices + responses ──────────────────────────────────────────────────────
create table notices (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  notice_type notice_type,
  tax_year int,
  amount_owed_cents bigint,
  irs_reasoning text,
  ssn_masked text,
  raw_image_url text,
  raw_image_pages jsonb,
  classification_json jsonb,
  status notice_status not null default 'uploaded',
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  classified_at timestamptz,
  drafted_at timestamptz,
  mailed_at timestamptz,
  resolved_at timestamptz,
  cost_cents int default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index idx_notices_firm on notices(firm_id);
create index idx_notices_status on notices(firm_id, status);
create index idx_notices_uploaded_at on notices(firm_id, uploaded_at desc);

create table responses (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references notices(id) on delete cascade,
  firm_id uuid not null references firms(id) on delete cascade,
  draft_text text not null,
  final_text text,
  draft_model text,
  draft_prompt_version text,
  draft_cost_cents int default 0,
  irc_citations text[],
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  signed_pdf_url text,
  mailed_at timestamptz,
  lob_letter_id text,
  lob_tracking_status text,
  lob_expected_delivery_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_responses_notice on responses(notice_id);
create index idx_responses_firm on responses(firm_id);

-- ─── Companies / contacts ─────────────────────────────────────────────────────
create table companies (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  domain citext,
  industry text,
  employee_count int,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_companies_firm on companies(firm_id);
create unique index idx_companies_firm_domain on companies(firm_id, domain) where domain is not null;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  email citext,
  phone text,
  first_name text,
  last_name text,
  full_name text generated always as (
    nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '')
  ) stored,
  job_title text,
  company_id uuid references companies(id) on delete set null,
  source text,
  lifecycle_stage lifecycle_stage not null default 'subscriber',
  lead_score int not null default 0,
  unsubscribed_at timestamptz,
  bounced_at timestamptz,
  marked_spam_at timestamptz,
  first_touch_utm jsonb,
  last_touch_utm jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_contacts_firm_email on contacts(firm_id, email) where email is not null;
create index idx_contacts_firm on contacts(firm_id);
create index idx_contacts_lifecycle on contacts(firm_id, lifecycle_stage);
create index idx_contacts_company on contacts(company_id);

-- ─── Tags / segments ──────────────────────────────────────────────────────────
create table tags (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name citext not null,
  color text not null default '#94a3b8',
  description text,
  created_at timestamptz not null default now(),
  unique (firm_id, name)
);

create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  firm_id uuid not null references firms(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id),
  primary key (contact_id, tag_id)
);

create index idx_contact_tags_tag on contact_tags(tag_id);
create index idx_contact_tags_firm on contact_tags(firm_id);

create table segments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  description text,
  filter_json jsonb not null,
  contact_count int default 0,
  contact_count_refreshed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_segments_firm on segments(firm_id);

-- ─── Pipelines / deals ────────────────────────────────────────────────────────
create table pipelines (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  stages jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_pipelines_firm on pipelines(firm_id);

create table deals (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  name text not null,
  stage text not null,
  value_cents bigint default 0,
  status deal_status not null default 'open',
  expected_close_date date,
  closed_at timestamptz,
  owner_id uuid references auth.users(id),
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_deals_firm on deals(firm_id);
create index idx_deals_pipeline on deals(pipeline_id, stage);
create index idx_deals_contact on deals(contact_id);

-- ─── Activities / notes / tasks ───────────────────────────────────────────────
create table activities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  type activity_type not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id)
);

create index idx_activities_firm_occurred on activities(firm_id, occurred_at desc);
create index idx_activities_contact_occurred on activities(contact_id, occurred_at desc);
create index idx_activities_type on activities(firm_id, type, occurred_at desc);

create table notes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  body text not null,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  title text not null,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  assignee_id uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_tasks_firm_due on tasks(firm_id, due_at) where completed_at is null;

-- ─── Email engine ─────────────────────────────────────────────────────────────
create table sending_domains (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade,
  domain citext not null,
  category send_category not null,
  daily_cap int not null default 50,
  warmup_started_at timestamptz,
  warmup_day int default 0,
  status sending_domain_status not null default 'verifying',
  resend_domain_id text,
  dkim_records jsonb,
  spf_record text,
  dmarc_record text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index idx_sending_domains_firm_domain on sending_domains(coalesce(firm_id, '00000000-0000-0000-0000-000000000000'::uuid), domain, category);

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  subject text not null,
  preview_text text,
  react_email_component text not null,
  json_props jsonb not null default '{}'::jsonb,
  category send_category not null default 'marketing',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_email_templates_firm on email_templates(firm_id) where archived_at is null;

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  template_id uuid references email_templates(id),
  segment_id uuid references segments(id),
  subject_a text,
  subject_b text,
  ab_split_pct int default 50,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status campaign_status not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campaigns_firm on campaigns(firm_id);

create table email_sends (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  workflow_run_id uuid,
  contact_id uuid references contacts(id) on delete set null,
  to_email citext not null,
  from_email citext not null,
  category send_category not null,
  subject text not null,
  message_id text unique,
  resend_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  first_clicked_at timestamptz,
  replied_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  open_count int default 0,
  click_count int default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index idx_email_sends_firm on email_sends(firm_id, sent_at desc);
create index idx_email_sends_contact on email_sends(contact_id, sent_at desc);
create index idx_email_sends_campaign on email_sends(campaign_id);
create index idx_email_sends_workflow_run on email_sends(workflow_run_id);

create table email_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  email_send_id uuid not null references email_sends(id) on delete cascade,
  type email_event_type not null,
  url text,
  ip text,
  user_agent text,
  occurred_at timestamptz not null default now(),
  payload jsonb
);

create index idx_email_events_send on email_events(email_send_id);
create index idx_email_events_firm_occurred on email_events(firm_id, occurred_at desc);

create table suppressions (
  firm_id uuid not null references firms(id) on delete cascade,
  email citext not null,
  reason suppression_reason not null,
  reason_detail text,
  added_at timestamptz not null default now(),
  primary key (firm_id, email)
);

create table inbound_messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  gmail_message_id text unique not null,
  in_reply_to_message_id text,
  references_header text,
  matched_email_send_id uuid references email_sends(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  from_email citext not null,
  to_email citext,
  subject text,
  body_text text,
  body_html text,
  raw_headers jsonb,
  received_at timestamptz not null,
  processed_at timestamptz,
  is_unsubscribe boolean default false,
  is_bounce boolean default false
);

create index idx_inbound_messages_firm on inbound_messages(firm_id, received_at desc);
create index idx_inbound_messages_send on inbound_messages(matched_email_send_id);

-- ─── Workflows ────────────────────────────────────────────────────────────────
create table workflows (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  description text,
  archetype workflow_archetype not null default 'evergreen',
  status workflow_status not null default 'draft',
  trigger_json jsonb not null,
  graph_json jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  version int not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workflows_firm on workflows(firm_id);
create index idx_workflows_status on workflows(firm_id, status) where status = 'active';

create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status workflow_run_status not null default 'running',
  current_node_id text,
  next_run_at timestamptz default now(),
  context jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);

create index idx_workflow_runs_due on workflow_runs(next_run_at) where status in ('running','waiting');
create index idx_workflow_runs_firm_workflow on workflow_runs(firm_id, workflow_id);
create unique index idx_workflow_runs_active_unique on workflow_runs(workflow_id, contact_id)
  where status in ('running','waiting');

create table workflow_step_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  workflow_run_id uuid not null references workflow_runs(id) on delete cascade,
  node_id text not null,
  action text not null,
  result jsonb,
  ran_at timestamptz not null default now()
);

create index idx_workflow_step_logs_run on workflow_step_logs(workflow_run_id, ran_at);

-- ─── Site analytics ───────────────────────────────────────────────────────────
create table sessions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  anon_id text not null,
  contact_id uuid references contacts(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  landing_path text,
  country text,
  region text,
  device text,
  browser text,
  os text,
  ip_truncated text
);

create index idx_sessions_firm_started on sessions(firm_id, started_at desc);
create index idx_sessions_anon on sessions(firm_id, anon_id);
create index idx_sessions_contact on sessions(contact_id);

create table pageviews (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  url text not null,
  path text not null,
  title text,
  referrer text,
  ms_on_page int,
  scroll_depth_pct int,
  occurred_at timestamptz not null default now()
);

create index idx_pageviews_firm_occurred on pageviews(firm_id, occurred_at desc);
create index idx_pageviews_session on pageviews(session_id, occurred_at);
create index idx_pageviews_firm_path on pageviews(firm_id, path);

create table events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  name text not null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index idx_events_firm_name on events(firm_id, name, occurred_at desc);

-- ─── Forms ────────────────────────────────────────────────────────────────────
create table forms (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  name text not null,
  schema_json jsonb not null,
  redirect_url text,
  on_submit_workflow_id uuid references workflows(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  form_id uuid not null references forms(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  payload jsonb not null,
  ip text,
  user_agent text,
  submitted_at timestamptz not null default now()
);

create index idx_form_submissions_form on form_submissions(form_id, submitted_at desc);

-- ─── Outbox / webhooks ────────────────────────────────────────────────────────
create table outbox_emails (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending',
  attempts int not null default 0,
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);

create index idx_outbox_emails_due on outbox_emails(send_at) where status = 'pending';

create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  url text not null,
  events text[] not null,
  secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  endpoint_id uuid not null references webhook_endpoints(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status text not null default 'pending',
  response_code int,
  response_body text,
  attempts int not null default 0,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_webhook_deliveries_due on webhook_deliveries(next_attempt_at) where status = 'pending';

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'firms','clients','responses','companies','contacts','segments','deals',
    'email_templates','campaigns','workflows','forms'
  ])
  loop
    execute format('drop trigger if exists trg_%I_updated_at on %I', t, t);
    execute format('create trigger trg_%I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
