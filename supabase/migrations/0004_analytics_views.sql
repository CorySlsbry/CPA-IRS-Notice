-- Analytics RPCs. Same shape as before; security_invoker set to false so the
-- service-role connection runs them. Filtering by firm happens via the
-- caller setting `app.firm_ids` GUC (or, in service-role connections,
-- by passing firm_id explicitly via SQL — see lib/analytics/).
--
-- For Cloud SQL deployment we drop the call to current_firm_ids() at
-- the function body and instead require callers to pass firm_id in.

create or replace function top_pageviews_7d(p_firm_id uuid)
returns table(path text, views bigint)
language sql stable as $$
  select pv.path, count(*)::bigint as views
  from pageviews pv
  where pv.firm_id = p_firm_id
    and pv.occurred_at >= now() - interval '7 days'
  group by pv.path
  order by views desc
  limit 25
$$;

create or replace function utm_breakdown_7d(p_firm_id uuid)
returns table(utm_source text, sessions bigint)
language sql stable as $$
  select coalesce(s.utm_source, '(direct)') as utm_source, count(*)::bigint as sessions
  from sessions s
  where s.firm_id = p_firm_id
    and s.started_at >= now() - interval '7 days'
  group by 1
  order by 2 desc
  limit 25
$$;

-- Funnel evaluator. Drops the recursion-style join in favor of a CTE that
-- finds the first session that hit step 1, then checks each later step.
create or replace function funnel_eval(p_firm_id uuid, p_steps text[])
returns table(step int, path text, sessions bigint)
language plpgsql stable as $$
declare i int;
begin
  for i in 1 .. array_length(p_steps, 1) loop
    return query
    select i,
           p_steps[i],
           count(distinct s.id)::bigint
    from sessions s
    join pageviews pv on pv.session_id = s.id
    where s.firm_id = p_firm_id
      and s.started_at >= now() - interval '30 days'
      and pv.path = p_steps[i];
  end loop;
end $$;

-- Realtime is no longer Supabase Realtime — analytics live-visitors UI
-- polls /api/analytics/live every 5s instead.
