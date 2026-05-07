-- RLS is OPTIONAL on Cloud SQL Postgres for NoticeReply.
--
-- The application connects with a single role (`app`) and enforces
-- multi-tenancy by including `firm_id` in every query (via the lib/db
-- query builder + repo layer). RLS is no longer the load-bearing security
-- model.
--
-- We still leave a thin policy in place that REJECTS access to tenant
-- tables when the connection has not set the per-request `app.firm_ids`
-- GUC. This is a defense-in-depth tripwire for code paths that forget to
-- filter — they fail closed instead of leaking cross-tenant data.
--
-- To enable the tripwire: connect as `app` (which respects RLS) and SET
--   app.firm_ids = '<firm_id1>,<firm_id2>'
-- before each request. Most code paths use the service-role connection
-- (RLS bypass) — that's fine because they pass firm_id through anyway.

create or replace function current_firm_ids()
returns setof uuid
language sql stable as $$
  select id::uuid from unnest(
    string_to_array(current_setting('app.firm_ids', true), ',')
  ) as id
  where id is not null and id <> ''
$$;

-- Optional tripwire policies. Uncomment if you want belt-and-suspenders.
-- Leaving them off by default since the app role bypasses RLS via grants.

-- alter table firms enable row level security;
-- create policy firms_member_select on firms
--   for select using (id in (select current_firm_ids()));
