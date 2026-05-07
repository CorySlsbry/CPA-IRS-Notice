import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, MessageCircle, MessageSquare, Plus, Send } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export const metadata = { title: 'Social' };

export default async function SocialOverview() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: membership } = await sb
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const firmId = (membership?.firm_id as string | undefined) ?? null;
  if (!firmId) return null;

  const [{ data: accounts }, { data: posts }, { data: pendingDms }, { data: triggers }] = await Promise.all([
    sb.from('social_accounts').select('id, platform, display_name, username, status').eq('firm_id', firmId),
    sb
      .from('social_posts')
      .select('id, platform, body, scheduled_at, published_at, status, external_url, reaction_count, reply_count')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false })
      .limit(10),
    sb.from('social_dms').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).eq('status', 'pending'),
    sb.from('social_comment_triggers').select('id, keyword, action, active').eq('firm_id', firmId).eq('active', true),
  ]);

  const stats = {
    accounts: (accounts ?? []).length,
    scheduled: (posts ?? []).filter((p) => p.status === 'scheduled').length,
    triggers: (triggers ?? []).length,
    pendingDms: pendingDms ?? 0,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Social</h1>
          <p className="text-sm text-muted-foreground">
            Post + auto-reply on Facebook + Instagram. Sabrina §16 ManyChat-style flywheel, integrated with the CRM.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/social/triggers">Comment triggers</Link>
          </Button>
          <Button asChild variant="gold">
            <Link href="/social/compose">
              <Plus className="size-4" /> New post
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat icon={<Send className="size-5 text-accent" />} label="Connected accounts" value={stats.accounts} />
        <Stat icon={<CalendarClock className="size-5 text-accent" />} label="Scheduled posts" value={stats.scheduled} />
        <Stat icon={<MessageCircle className="size-5 text-accent" />} label="Active triggers" value={stats.triggers} />
        <Stat icon={<MessageSquare className="size-5 text-accent" />} label="DMs pending" value={String(stats.pendingDms)} />
      </div>

      <Card className="mt-8">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Connected accounts</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/social/accounts">Manage →</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {(accounts ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No accounts connected. Hook up Salisbury Bookkeeping's Facebook + Instagram in{' '}
              <Link href="/social/accounts" className="font-semibold underline">
                Accounts
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(accounts ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      {a.display_name}
                      {a.username && <span className="ml-2 text-xs text-muted-foreground">@{a.username}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{(a.platform as string).toUpperCase()}</p>
                  </div>
                  <Badge variant={a.status === 'connected' ? 'green' : 'amber'}>{a.status as string}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Recent posts</CardTitle>
        </CardHeader>
        <CardContent>
          {(posts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {posts?.map((p) => (
                <li key={p.id} className="grid grid-cols-[1fr,auto] items-start gap-4 py-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm">{p.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(p.platform as string).toUpperCase()} ·{' '}
                      {p.published_at
                        ? `Published ${formatRelative(p.published_at as string)}`
                        : p.scheduled_at
                          ? `Scheduled ${formatRelative(p.scheduled_at as string)}`
                          : 'Draft'}
                      {p.external_url && (
                        <>
                          {' · '}
                          <a className="underline" href={p.external_url as string} target="_blank" rel="noreferrer">
                            view
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={
                      p.status === 'published'
                        ? 'green'
                        : p.status === 'failed'
                          ? 'red'
                          : p.status === 'scheduled'
                            ? 'amber'
                            : 'secondary'
                    }
                  >
                    {p.status as string}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="grid size-10 place-items-center rounded-lg bg-accent/10">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-serif text-3xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
