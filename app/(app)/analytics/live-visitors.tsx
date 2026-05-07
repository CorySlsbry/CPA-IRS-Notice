'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type LivePV = {
  id: string;
  path: string;
  occurred_at: string;
};

export function LiveVisitors() {
  const [recent, setRecent] = useState<LivePV[]>([]);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    const channel = sb
      .channel('live-pageviews')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pageviews' }, (payload) => {
        const row = payload.new as LivePV;
        setRecent((r) => [row, ...r].slice(0, 12));
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  if (recent.length === 0) {
    return <p className="text-sm text-muted-foreground">Listening… new pageviews will appear here in real time.</p>;
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
