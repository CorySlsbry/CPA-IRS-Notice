-- Lead-magnet signups. Captured on public landing pages BEFORE the visitor
-- has a firm context. Cron later imports them into the marketing org's
-- CRM (specified by env MARKETING_FIRM_ID) and enrolls in the welcome
-- workflow.

create table lead_magnet_signups (
  id uuid primary key default gen_random_uuid(),
  magnet_id text not null,
  email citext not null,
  firm_name text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  user_agent text,
  ip_truncated text,
  imported_to_firm_id uuid references firms(id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index idx_lead_magnet_signups_unique on lead_magnet_signups(magnet_id, email);
create index idx_lead_magnet_signups_pending on lead_magnet_signups(created_at desc) where imported_at is null;
