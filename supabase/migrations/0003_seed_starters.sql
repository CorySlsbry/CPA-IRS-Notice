-- Helper: bootstrap a new firm with default starter assets (pipeline, tags,
-- starter workflow templates). Called from auth.users insert trigger.

create or replace function seed_starter_assets(p_firm_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Default pipeline
  insert into pipelines (firm_id, name, is_default, stages)
  values (
    p_firm_id,
    'Notice clients',
    true,
    '[
      {"id":"new","name":"New","color":"#94a3b8"},
      {"id":"engaged","name":"Engaged","color":"#60a5fa"},
      {"id":"qualified","name":"Qualified","color":"#34d399"},
      {"id":"won","name":"Won","color":"#22c55e"},
      {"id":"lost","name":"Lost","color":"#f87171"}
    ]'::jsonb
  );

  -- Default tags
  insert into tags (firm_id, name, color, description) values
    (p_firm_id, 'cpa-prospect', '#1e40af', 'Cold CPA prospect from Apollo'),
    (p_firm_id, 'trial-active', '#22c55e', 'Currently in 14-day trial'),
    (p_firm_id, 'replied', '#a855f7', 'Replied to a NoticeReply email'),
    (p_firm_id, 'unsubscribed', '#94a3b8', 'Opted out — do not email');

  -- Starter workflow: short-term — 14-day trial nurture
  insert into workflows (firm_id, name, description, archetype, status, trigger_json, graph_json)
  values (
    p_firm_id,
    'Trial nurture (14-day)',
    'Drip activation for new trial signups. Six touches over 14 days. Authored in Cory voice.',
    'short_term',
    'active',
    '{"type":"tag_added","tag":"trial-active"}'::jsonb,
    '{"nodes":[
      {"id":"start","type":"trigger","data":{"label":"Trial signup"}},
      {"id":"e1","type":"action","data":{"action":"send_email","template":"trial_day0_welcome","subject":"Welcome to NoticeReply — start with one notice"}},
      {"id":"w1","type":"action","data":{"action":"wait","amount":2,"unit":"days"}},
      {"id":"e2","type":"action","data":{"action":"send_email","template":"trial_day2_first_notice","subject":"Snap your first notice (2-min walkthrough)"}},
      {"id":"w2","type":"action","data":{"action":"wait","amount":3,"unit":"days"}},
      {"id":"e3","type":"action","data":{"action":"send_email","template":"trial_day5_crm","subject":"You also have a CRM in there"}},
      {"id":"w3","type":"action","data":{"action":"wait","amount":4,"unit":"days"}},
      {"id":"e4","type":"action","data":{"action":"send_email","template":"trial_day9_workflow","subject":"Build your first workflow (steal mine)"}},
      {"id":"w4","type":"action","data":{"action":"wait","amount":2,"unit":"days"}},
      {"id":"e5","type":"action","data":{"action":"send_email","template":"trial_day11_warning","subject":"3 days left on your trial"}},
      {"id":"w5","type":"action","data":{"action":"wait","amount":3,"unit":"days"}},
      {"id":"e6","type":"action","data":{"action":"send_email","template":"trial_day14_close","subject":"Your trial just ended — here is what unlocks"}},
      {"id":"end","type":"end","data":{}}
    ],"edges":[
      {"source":"start","target":"e1"},
      {"source":"e1","target":"w1"},
      {"source":"w1","target":"e2"},
      {"source":"e2","target":"w2"},
      {"source":"w2","target":"e3"},
      {"source":"e3","target":"w3"},
      {"source":"w3","target":"e4"},
      {"source":"e4","target":"w4"},
      {"source":"w4","target":"e5"},
      {"source":"e5","target":"w5"},
      {"source":"w5","target":"e6"},
      {"source":"e6","target":"end"}
    ]}'::jsonb
  );

  -- Starter workflow: long-term — 90-day cold CPA nurture
  insert into workflows (firm_id, name, description, archetype, status, trigger_json, graph_json)
  values (
    p_firm_id,
    'CPA cold lead nurture (90-day)',
    'Long-term relationship build for cold CPA prospects. 12 touches over 90 days. Mix of education + soft CTA.',
    'long_term',
    'active',
    '{"type":"tag_added","tag":"cpa-prospect"}'::jsonb,
    '{"nodes":[
      {"id":"start","type":"trigger","data":{"label":"Tagged cpa-prospect"}},
      {"id":"e1","type":"action","data":{"action":"send_email","template":"cpa_intro","subject":"Quick question from another small CPA shop"}},
      {"id":"w1","type":"action","data":{"action":"wait","amount":4,"unit":"days"}},
      {"id":"e2","type":"action","data":{"action":"send_email","template":"cpa_cp2000_war_story","subject":"How a $14K CP2000 became a 6-minute win"}},
      {"id":"end","type":"end","data":{}}
    ],"edges":[
      {"source":"start","target":"e1"},
      {"source":"e1","target":"w1"},
      {"source":"w1","target":"e2"},
      {"source":"e2","target":"end"}
    ]}'::jsonb
  );

  -- Starter workflow: evergreen — welcome new subscriber
  insert into workflows (firm_id, name, description, archetype, status, trigger_json, graph_json)
  values (
    p_firm_id,
    'Welcome new subscriber',
    'Three-touch evergreen welcome triggered by form submission.',
    'evergreen',
    'active',
    '{"type":"form_submit"}'::jsonb,
    '{"nodes":[
      {"id":"start","type":"trigger","data":{"label":"Form submit"}},
      {"id":"e1","type":"action","data":{"action":"send_email","template":"welcome_subscribe","subject":"You are in. Here is what to expect."}},
      {"id":"w1","type":"action","data":{"action":"wait","amount":2,"unit":"days"}},
      {"id":"e2","type":"action","data":{"action":"send_email","template":"welcome_resource","subject":"The 5-minute notice triage checklist (PDF)"}},
      {"id":"w2","type":"action","data":{"action":"wait","amount":4,"unit":"days"}},
      {"id":"e3","type":"action","data":{"action":"send_email","template":"welcome_offer","subject":"14 days, no card. Snap one notice and see."}},
      {"id":"end","type":"end","data":{}}
    ],"edges":[
      {"source":"start","target":"e1"},
      {"source":"e1","target":"w1"},
      {"source":"w1","target":"e2"},
      {"source":"e2","target":"w2"},
      {"source":"w2","target":"e3"},
      {"source":"e3","target":"end"}
    ]}'::jsonb
  );
end $$;

-- Auto-create a personal firm for new auth.users on signup.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_firm_id uuid;
begin
  insert into firms (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'firm_name', split_part(new.email,'@',1) || ' CPA'),
    substring(md5(new.id::text || extract(epoch from now())::text), 1, 12)
  )
  returning id into v_firm_id;

  insert into firm_users (firm_id, user_id, role) values (v_firm_id, new.id, 'owner');
  perform seed_starter_assets(v_firm_id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
