-- Update seed_starter_assets to install the 3-stage Jarvis workflow chain
-- (per the lead-ingestion spec):
--   short:     trigger="cpa-irs-cold-queue"             — 14-day initial cold push
--              applies "cpa-irs-short-nurture-complete" at end
--   long:      trigger="cpa-irs-short-nurture-complete" — 90-day relationship build
--              applies "cpa-irs-long-nurture-complete" at end
--   evergreen: trigger="cpa-irs-long-nurture-complete"  — quarterly check-in
--
-- Stop tags (any of these on a contact → trigger tag NOT applied):
--   cpa-irs-booked-call, cpa-irs-client, cpa-irs-lost, do-not-contact

create or replace function seed_starter_assets(p_firm_id uuid)
returns void language plpgsql as $$
begin
  -- Default pipeline
  insert into pipelines (firm_id, name, is_default, stages)
  values (
    p_firm_id, 'Notice clients', true,
    '[
      {"id":"new","name":"New","color":"#94a3b8"},
      {"id":"engaged","name":"Engaged","color":"#60a5fa"},
      {"id":"qualified","name":"Qualified","color":"#34d399"},
      {"id":"won","name":"Won","color":"#22c55e"},
      {"id":"lost","name":"Lost","color":"#f87171"}
    ]'::jsonb
  )
  on conflict do nothing;

  -- Tags including stop tags + the Jarvis chain markers
  insert into tags (firm_id, name, color, description) values
    (p_firm_id, 'cpa-irs-cold-queue',              '#1e40af', 'Jarvis-pushed CPA prospect — fires Short workflow'),
    (p_firm_id, 'cpa-irs-short-nurture-complete',  '#3b82f6', 'Short complete — fires Long workflow'),
    (p_firm_id, 'cpa-irs-long-nurture-complete',   '#6366f1', 'Long complete — fires Evergreen workflow'),
    (p_firm_id, 'cpa-irs-booked-call',             '#22c55e', 'STOP — booked discovery call; pause cold cadence'),
    (p_firm_id, 'cpa-irs-client',                  '#16a34a', 'STOP — converted to paying client'),
    (p_firm_id, 'cpa-irs-lost',                    '#94a3b8', 'STOP — disqualified; do not re-enroll'),
    (p_firm_id, 'do-not-contact',                  '#dc2626', 'STOP — explicit unsubscribe / opt-out'),
    (p_firm_id, 'apollo-enriched',                 '#a855f7', 'Contact data sourced from Apollo enrichment'),
    (p_firm_id, 'irs-notices-prospect',            '#fb923c', 'Interest tag for IRS notices vertical'),
    (p_firm_id, 'cpa-prospect',                    '#1e40af', 'Generic CPA prospect — operator-applied'),
    (p_firm_id, 'trial-active',                    '#22c55e', 'Currently in 14-day trial'),
    (p_firm_id, 'replied',                         '#a855f7', 'Replied to a NoticeReply email')
  on conflict (firm_id, name) do nothing;

  -- ─── Workflow 1: Short — 14-day cold push ──────────────────────────────────
  insert into workflows (firm_id, name, description, archetype, status, trigger_json, graph_json)
  values (
    p_firm_id,
    'CPA cold push — Short (14d)',
    'Initial 14-day cold cadence triggered when Jarvis applies cpa-irs-cold-queue. End applies cpa-irs-short-nurture-complete to fire the Long workflow.',
    'short_term',
    'active',
    '{"type":"tag_added","tag":"cpa-irs-cold-queue"}'::jsonb,
    '{"nodes":[
      {"id":"start","type":"trigger","data":{"label":"cold-queue tag"}},
      {"id":"e1","type":"action","data":{"action":"send_email","template":"cpa_intro","subject":"Quick question from another small CPA shop"}},
      {"id":"w1","type":"action","data":{"action":"wait","amount":3,"unit":"days"}},
      {"id":"e2","type":"action","data":{"action":"send_email","template":"cpa_cp2000_war_story","subject":"How a $14K CP2000 became a 6-minute win"}},
      {"id":"w2","type":"action","data":{"action":"wait","amount":4,"unit":"days"}},
      {"id":"e3","type":"action","data":{"action":"send_email","template":"welcome_resource","subject":"The 5-minute notice triage checklist (PDF)"}},
      {"id":"w3","type":"action","data":{"action":"wait","amount":3,"unit":"days"}},
      {"id":"e4","type":"action","data":{"action":"send_email","template":"welcome_offer","subject":"14 days, no card. Snap one notice and see."}},
      {"id":"w4","type":"action","data":{"action":"wait","amount":4,"unit":"days"}},
      {"id":"complete","type":"action","data":{"action":"add_tag","tag":"cpa-irs-short-nurture-complete"}},
      {"id":"end","type":"end","data":{}}
    ],"edges":[
      {"source":"start","target":"e1"},{"source":"e1","target":"w1"},{"source":"w1","target":"e2"},
      {"source":"e2","target":"w2"},{"source":"w2","target":"e3"},{"source":"e3","target":"w3"},
      {"source":"w3","target":"e4"},{"source":"e4","target":"w4"},{"source":"w4","target":"complete"},
      {"source":"complete","target":"end"}
    ]}'::jsonb
  ) on conflict do nothing;

  -- ─── Workflow 2: Long — 90-day relationship build ──────────────────────────
  insert into workflows (firm_id, name, description, archetype, status, trigger_json, graph_json)
  values (
    p_firm_id,
    'CPA cold push — Long (90d)',
    'Long-term relationship build. Triggered automatically when Short completes (tag chain). Twelve touches over 90 days: education, war stories, soft CTAs.',
    'long_term',
    'active',
    '{"type":"tag_added","tag":"cpa-irs-short-nurture-complete"}'::jsonb,
    '{"nodes":[
      {"id":"start","type":"trigger","data":{"label":"short-nurture-complete"}},
      {"id":"e1","type":"action","data":{"action":"send_email","template":"cpa_intro","subject":"Quick check-in from Salisbury Bookkeeping"}},
      {"id":"w1","type":"action","data":{"action":"wait","amount":7,"unit":"days"}},
      {"id":"e2","type":"action","data":{"action":"send_email","template":"cpa_cp2000_war_story","subject":"$14K CP2000, 6 minutes — what changed"}},
      {"id":"w2","type":"action","data":{"action":"wait","amount":14,"unit":"days"}},
      {"id":"e3","type":"action","data":{"action":"send_email","template":"welcome_resource","subject":"Q-end notice queue checklist"}},
      {"id":"w3","type":"action","data":{"action":"wait","amount":21,"unit":"days"}},
      {"id":"e4","type":"action","data":{"action":"send_email","template":"welcome_offer","subject":"Free 14-day trial — still on the table"}},
      {"id":"w4","type":"action","data":{"action":"wait","amount":21,"unit":"days"}},
      {"id":"e5","type":"action","data":{"action":"send_email","template":"trial_day0_welcome","subject":"One last thing"}},
      {"id":"complete","type":"action","data":{"action":"add_tag","tag":"cpa-irs-long-nurture-complete"}},
      {"id":"end","type":"end","data":{}}
    ],"edges":[
      {"source":"start","target":"e1"},{"source":"e1","target":"w1"},{"source":"w1","target":"e2"},
      {"source":"e2","target":"w2"},{"source":"w2","target":"e3"},{"source":"e3","target":"w3"},
      {"source":"w3","target":"e4"},{"source":"e4","target":"w4"},{"source":"w4","target":"e5"},
      {"source":"e5","target":"complete"},{"source":"complete","target":"end"}
    ]}'::jsonb
  ) on conflict do nothing;

  -- ─── Workflow 3: Evergreen — quarterly check-in ────────────────────────────
  insert into workflows (firm_id, name, description, archetype, status, trigger_json, graph_json)
  values (
    p_firm_id,
    'CPA cold push — Evergreen (quarterly)',
    'Final stage. Triggered when Long completes. Quarterly low-touch check-in indefinitely.',
    'evergreen',
    'active',
    '{"type":"tag_added","tag":"cpa-irs-long-nurture-complete"}'::jsonb,
    '{"nodes":[
      {"id":"start","type":"trigger","data":{"label":"long-nurture-complete"}},
      {"id":"w1","type":"action","data":{"action":"wait","amount":90,"unit":"days"}},
      {"id":"e1","type":"action","data":{"action":"send_email","template":"welcome_resource","subject":"Quarterly notice-update for CPAs"}},
      {"id":"w2","type":"action","data":{"action":"wait","amount":90,"unit":"days"}},
      {"id":"e2","type":"action","data":{"action":"send_email","template":"cpa_cp2000_war_story","subject":"Notice trends this quarter"}},
      {"id":"end","type":"end","data":{}}
    ],"edges":[
      {"source":"start","target":"w1"},{"source":"w1","target":"e1"},{"source":"e1","target":"w2"},
      {"source":"w2","target":"e2"},{"source":"e2","target":"end"}
    ]}'::jsonb
  ) on conflict do nothing;
end $$;

-- Grant execute on the updated function
grant execute on function seed_starter_assets(uuid) to app;
