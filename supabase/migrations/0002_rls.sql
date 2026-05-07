-- Row-level security: every tenant table requires firm membership.

alter table firms enable row level security;
alter table firm_users enable row level security;
alter table clients enable row level security;
alter table notices enable row level security;
alter table responses enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table tags enable row level security;
alter table contact_tags enable row level security;
alter table segments enable row level security;
alter table pipelines enable row level security;
alter table deals enable row level security;
alter table activities enable row level security;
alter table notes enable row level security;
alter table tasks enable row level security;
alter table sending_domains enable row level security;
alter table email_templates enable row level security;
alter table campaigns enable row level security;
alter table email_sends enable row level security;
alter table email_events enable row level security;
alter table suppressions enable row level security;
alter table inbound_messages enable row level security;
alter table workflows enable row level security;
alter table workflow_runs enable row level security;
alter table workflow_step_logs enable row level security;
alter table sessions enable row level security;
alter table pageviews enable row level security;
alter table events enable row level security;
alter table forms enable row level security;
alter table form_submissions enable row level security;
alter table outbox_emails enable row level security;
alter table webhook_endpoints enable row level security;
alter table webhook_deliveries enable row level security;

-- Firms: member can SELECT; owners/admins can UPDATE.
create policy firms_member_select on firms
  for select using (id in (select current_firm_ids()));
create policy firms_admin_update on firms
  for update using (
    id in (
      select firm_id from firm_users
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

create policy firm_users_member_select on firm_users
  for select using (firm_id in (select current_firm_ids()));
create policy firm_users_admin_write on firm_users
  for all using (
    firm_id in (
      select firm_id from firm_users
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

-- Generic: members can SELECT/INSERT/UPDATE/DELETE rows for their firms.
do $$
declare t text;
begin
  for t in select unnest(array[
    'clients','notices','responses','companies','contacts','tags','contact_tags',
    'segments','pipelines','deals','activities','notes','tasks',
    'email_templates','campaigns','email_sends','email_events','suppressions',
    'inbound_messages','workflows','workflow_runs','workflow_step_logs',
    'sessions','pageviews','events','forms','form_submissions',
    'outbox_emails','webhook_endpoints','webhook_deliveries','sending_domains'
  ])
  loop
    execute format($f$
      create policy %1$I_member_all on %1$I
      for all using (firm_id in (select current_firm_ids()))
      with check (firm_id in (select current_firm_ids()));
    $f$, t || '_rls');
  end loop;
end $$;
