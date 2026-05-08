-- Jarvis lead-ingestion dedup schema. Adds normalized identity columns to
-- contacts + a dedicated `leads` table that stores per-call attribution
-- (one row per Jarvis push, even when the contact already exists).
--
-- Rules MUST match Jarvis client-side normalization verbatim or hash keys
-- diverge across systems and the unique indexes will let dupes through.

-- ─── Helper functions ────────────────────────────────────────────────────────

create or replace function normalize_email(p_email text)
returns text language sql immutable as $$
  select lower(trim(p_email))
$$;

create or replace function normalize_phone(p_phone text)
returns text language plpgsql immutable as $$
declare v_digits text;
begin
  if p_phone is null then return null; end if;
  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  if length(v_digits) = 11 and substring(v_digits, 1, 1) = '1' then
    v_digits := substring(v_digits, 2);
  end if;
  if v_digits = '' then return null; end if;
  return v_digits;
end $$;

create or replace function normalize_linkedin(p_url text)
returns text language plpgsql immutable as $$
declare v text;
begin
  if p_url is null then return null; end if;
  v := lower(trim(p_url));
  -- strip query string
  v := split_part(v, '?', 1);
  -- strip trailing slash
  v := rtrim(v, '/');
  if v = '' then return null; end if;
  return v;
end $$;

create or replace function normalize_company(p_name text)
returns text language plpgsql immutable as $$
declare v text;
begin
  if p_name is null then return null; end if;
  v := lower(trim(p_name));
  -- Strip suffixes (case-insensitive, optional trailing dot). Order matters:
  -- longer phrases first so 'corporation' isn't truncated by 'corp'.
  v := regexp_replace(v, '[\s,]+(corporation|enterprises|holdings|services|company|p\.c\.|p\.a\.|group|corp\.?|llc\.?|llp\.?|ltd\.?|inc\.?|pa\.?|pc\.?|co\.?)$', '', 'gi');
  -- strip punctuation listed in spec
  v := regexp_replace(v, '[.,&''/()\[\]]', '', 'g');
  -- collapse whitespace
  v := regexp_replace(v, '\s+', ' ', 'g');
  v := trim(v);
  if v = '' then return null; end if;
  return v;
end $$;

create or replace function compute_name_company_key(p_first text, p_last text, p_company text)
returns text language plpgsql immutable as $$
declare v_name text; v_co text;
begin
  v_name := lower(trim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')));
  v_name := regexp_replace(v_name, '\s+', ' ', 'g');
  v_co := normalize_company(p_company);
  if v_name = '' or v_name = ' ' or v_co is null then return null; end if;
  return v_name || '|' || v_co;
end $$;

-- ─── Add dedup columns to contacts ───────────────────────────────────────────
alter table contacts
  add column if not exists email_normalized citext,
  add column if not exists phone_digits text,
  add column if not exists linkedin_url text,
  add column if not exists linkedin_normalized text,
  add column if not exists name_company_key text,
  add column if not exists apollo_person_id text,
  add column if not exists external_id text,
  add column if not exists jarvis_dedup_qualifiers jsonb,
  add column if not exists company_name_at_capture text;

-- ─── Backfill existing rows from current data ────────────────────────────────
update contacts c
set email_normalized = normalize_email(c.email::text),
    phone_digits     = normalize_phone(c.phone),
    linkedin_normalized = normalize_linkedin(c.linkedin_url),
    name_company_key = compute_name_company_key(c.first_name, c.last_name, co.name),
    company_name_at_capture = co.name
from companies co
where c.company_id = co.id;

-- For contacts with no company, still compute the email/phone/linkedin parts
update contacts
set email_normalized = normalize_email(email::text),
    phone_digits     = coalesce(phone_digits, normalize_phone(phone)),
    linkedin_normalized = coalesce(linkedin_normalized, normalize_linkedin(linkedin_url))
where email_normalized is null;

-- Build the cached jsonb summary for fast read in /match
update contacts
set jarvis_dedup_qualifiers = jsonb_strip_nulls(jsonb_build_object(
  'email_normalized', email_normalized,
  'phone_digits', phone_digits,
  'linkedin_normalized', linkedin_normalized,
  'name_company_key', name_company_key,
  'apollo_person_id', apollo_person_id,
  'external_id', external_id
));

-- ─── Indexes (REQUIRED for /match performance) ───────────────────────────────
-- Partial unique on email_normalized scoped per firm — multi-tenant safe
create unique index if not exists uniq_contacts_firm_email_normalized
  on contacts(firm_id, email_normalized) where email_normalized is not null;

create unique index if not exists uniq_contacts_firm_phone_digits
  on contacts(firm_id, phone_digits) where phone_digits is not null;

create unique index if not exists uniq_contacts_firm_name_company_key
  on contacts(firm_id, name_company_key) where name_company_key is not null;

create unique index if not exists uniq_contacts_firm_linkedin_normalized
  on contacts(firm_id, linkedin_normalized) where linkedin_normalized is not null;

create index if not exists idx_contacts_firm_apollo_person_id
  on contacts(firm_id, apollo_person_id) where apollo_person_id is not null;

create index if not exists idx_contacts_firm_external_id
  on contacts(firm_id, external_id) where external_id is not null;

create index if not exists idx_contacts_firm_updated_at
  on contacts(firm_id, updated_at desc);

-- ─── Auto-maintain dedup columns on insert/update ────────────────────────────
create or replace function contacts_compute_dedup()
returns trigger language plpgsql as $$
declare v_company_name text;
begin
  new.email_normalized := normalize_email(new.email::text);
  new.phone_digits := normalize_phone(new.phone);
  new.linkedin_normalized := normalize_linkedin(new.linkedin_url);

  if new.company_id is not null then
    select name into v_company_name from companies where id = new.company_id;
  else
    v_company_name := new.company_name_at_capture;
  end if;
  new.name_company_key := compute_name_company_key(new.first_name, new.last_name, v_company_name);

  new.jarvis_dedup_qualifiers := jsonb_strip_nulls(jsonb_build_object(
    'email_normalized', new.email_normalized,
    'phone_digits', new.phone_digits,
    'linkedin_normalized', new.linkedin_normalized,
    'name_company_key', new.name_company_key,
    'apollo_person_id', new.apollo_person_id,
    'external_id', new.external_id
  ));
  return new;
end $$;

drop trigger if exists trg_contacts_compute_dedup on contacts;
create trigger trg_contacts_compute_dedup
  before insert or update of email, phone, linkedin_url, first_name, last_name,
                              company_id, company_name_at_capture, apollo_person_id, external_id
  on contacts for each row execute function contacts_compute_dedup();

-- ─── Per-call lead-attribution table ─────────────────────────────────────────
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  vertical text not null,
  source text,
  interest text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  notes text,
  raw_payload jsonb,
  external_id text,
  apollo_person_id text,
  trigger_tag_applied boolean default false,
  stop_tag_blocked text,
  match_signal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_firm_updated_at on leads(firm_id, updated_at desc);
create index if not exists idx_leads_contact on leads(contact_id, created_at desc);
create index if not exists idx_leads_external_id on leads(firm_id, external_id) where external_id is not null;
create index if not exists idx_leads_vertical on leads(firm_id, vertical, updated_at desc);

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

-- Grant the app user privileges on new objects + functions
grant select, insert, update, delete on leads to app;
grant execute on function normalize_email(text) to app;
grant execute on function normalize_phone(text) to app;
grant execute on function normalize_linkedin(text) to app;
grant execute on function normalize_company(text) to app;
grant execute on function compute_name_company_key(text, text, text) to app;
