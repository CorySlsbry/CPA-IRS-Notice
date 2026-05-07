import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveVisitors } from './live-visitors';
import { formatRelative } from '@/lib/utils';

export const metadata = { title: 'Analytics' };

export default async function AnalyticsPage() {
  const sb = await createSupabaseServerClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ count: sessionsCount }, { count: pvCount }, { data: topPaths }, { data: utmBreakdown }, { data: recent }] = await Promise.all([
    sb.from('sessions').select('id', { count: 'exact', head: true }).gte('started_at', since),
    sb.from('pageviews').select('id', { count: 'exact', head: true }).gte('occurred_at', since),
    sb.rpc('top_pageviews_7d').select('*').limit(8),
    sb.rpc('utm_breakdown_7d').select('*').limit(8),
    sb.from('sessions').select('id, started_at, utm_source, landing_path, country, device').order('started_at', { ascending: false }).limit(10),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-serif text-3xl">Analytics</h1>
      <p className="text-sm text-muted-foreground">First-party. GDPR-clean. Last 7 days.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat label="Sessions" value={sessionsCount ?? 0} />
        <Stat label="Pageviews" value={pvCount ?? 0} />
        <Stat label="Pages / session" value={sessionsCount && pvCount ? ((pvCount / sessionsCount).toFixed(1)) : '—'} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live visitors</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveVisitors />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top pages (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            {(topPaths ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No pageviews yet — embed track.js on your site.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {(topPaths as { path: string; views: number }[] | null)?.map((p) => (
                  <li key={p.path} className="flex justify-between">
                    <span className="truncate font-mono text-xs">{p.path}</span>
                    <span className="text-muted-foreground">{p.views}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">UTM breakdown (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            {(utmBreakdown ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No UTM data yet. Tag your campaigns with utm_source / utm_campaign.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {(utmBreakdown as { utm_source: string; sessions: number }[] | null)?.map((p) => (
                  <li key={p.utm_source} className="flex justify-between">
                    <span className="font-mono text-xs">{p.utm_source ?? '(direct)'}</span>
                    <span className="text-muted-foreground">{p.sessions}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {(recent ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="font-mono">{s.landing_path ?? '/'}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{s.utm_source ?? 'direct'}</span>
                  <span className="ml-auto text-muted-foreground">{formatRelative(s.started_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 font-serif text-3xl">{value}</p>
      </CardContent>
    </Card>
  );
}
