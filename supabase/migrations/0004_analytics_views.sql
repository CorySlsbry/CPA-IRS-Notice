-- Stored procs for analytics dashboard. RLS-safe — they filter by the
-- caller's firm membership.

create or replace function top_pageviews_7d()
returns table(path text, views bigint)
language sql security invoker stable as $$
  select pv.path, count(*)::bigint as views
  from pageviews pv
  where pv.firm_id in (select current_firm_ids())
    and pv.occurred_at >= now() - interval '7 days'
  group by pv.path
  order by views desc
  limit 25
$$;

create or replace function utm_breakdown_7d()
returns table(utm_source text, sessions bigint)
language sql security invoker stable as $$
  select coalesce(s.utm_source, '(direct)') as utm_source, count(*)::bigint as sessions
  from sessions s
  where s.firm_id in (select current_firm_ids())
    and s.started_at >= now() - interval '7 days'
  group by 1
  order by 2 desc
  limit 25
$$;

-- Funnel evaluator: list of paths in order, returns drop-off counts.
create or replace function funnel_eval(p_steps text[])
returns table(step int, path text, sessions bigint)
language plpgsql security invoker stable as $$
declare i int;
begin
  for i in 1 .. array_length(p_steps, 1) loop
    return query
    select i,
           p_steps[i],
           count(distinct s.id)::bigint
    from sessions s
    join pageviews pv on pv.session_id = s.id
    where s.firm_id in (select current_firm_ids())
      and s.started_at >= now() - interval '30 days'
      and pv.path = p_steps[i]
      and (i = 1 or s.id in (
        select pv2.session_id from pageviews pv2
        where pv2.firm_id = s.firm_id
          and pv2.path = p_steps[i-1]
          and pv2.occurred_at <= pv.occurred_at
      ));
  end loop;
end $$;

-- Helper for live visitors stream (Realtime).
alter publication supabase_realtime add table pageviews;
