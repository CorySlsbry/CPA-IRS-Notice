'use client';

import { useEffect, useState } from 'react';

type LivePV = {
  id: string;
  path: string;
  occurred_at: string;
};

/**
 * Live pageview feed. Used to be a Supabase Realtime channel; on Cloud SQL
 * we poll /api/analytics/live every 5s. Same UX, slightly higher latency.
 */
export function LiveVisitors() {
  const [recent, setRecent] = useState<LivePV[]>([]);

  useEffect(() => {
    let cancelled = false;
    let lastSeenAt: string | null = null;

    async function tick() {
      try {
        const url = lastSeenAt ? `/api/analytics/live?since=${encodeURIComponent(lastSeenAt)}` : '/api/analytics/live';
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok || cancelled) return;
        const body = (await r.json()) as { pageviews: LivePV[] };
        if (body.pageviews.length === 0) return;
        lastSeenAt = body.pageviews[0]!.occurred_at;
        setRecent((r) => [...body.pageviews, ...r].slice(0, 12));
      } catch {
        // network blip — ignore
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (recent.length === 0) {
    return <p className="text-sm text-muted-foreground">Listening… new pageviews will appear here every few seconds.</p>;
  }

  return (
    <ul className="space-y-1.5 text-sm">
      {recent.map((pv) => (
        <li key={pv.id} className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="font-mono text-xs">{pv.path}</span>
          <span className="ml-auto text-xs text-muted-foreground">{new Date(pv.occurred_at).toLocaleTimeString()}</span>
        </li>
      ))}
    </ul>
  );
}
