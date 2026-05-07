import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, FileText, Mail, Users } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
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

  const firmId = membership?.firm_id as string | undefined;
  if (!firmId) return null;

  const [noticesCount, contactsCount, sentCount, recentNotices, recentActivity] = await Promise.all([
    sb.from('notices').select('id', { count: 'exact', head: true }).eq('firm_id', firmId),
    sb.from('contacts').select('id', { count: 'exact', head: true }).eq('firm_id', firmId),
    sb.from('email_sends').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).gte('sent_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    sb
      .from('notices')
      .select('id, notice_type, status, uploaded_at, amount_owed_cents')
      .eq('firm_id', firmId)
      .order('uploaded_at', { ascending: false })
      .limit(5),
    sb
      .from('activities')
      .select('id, type, payload, occurred_at, contact_id')
      .eq('firm_id', firmId)
      .order('occurred_at', { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Welcome back.</h1>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
        </div>
        <Button asChild variant="gold" size="lg">
          <Link href="/notices/new">+ New notice</Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat icon={<FileText className="size-5 text-accent" />} label="Notices processed" value={(noticesCount.count ?? 0).toString()} />
        <Stat icon={<Users className="size-5 text-accent" />} label="Contacts in CRM" value={(contactsCount.count ?? 0).toLocaleString()} />
        <Stat icon={<Mail className="size-5 text-accent" />} label="Emails sent (30d)" value={(sentCount.count ?? 0).toLocaleString()} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent notices</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/notices">All <ArrowUpRight className="size-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(recentNotices.data ?? []).length === 0 ? (
              <EmptyNotices />
            ) : (
              <ul className="divide-y divide-border">
                {recentNotices.data?.map((n) => (
                  <li key={n.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <Link href={`/notices/${n.id}`} className="text-sm font-medium hover:underline">
                        {n.notice_type ?? 'Unclassified'}{' '}
                        {n.amount_owed_cents != null && (
                          <span className="ml-2 text-muted-foreground">
                            ${((n.amount_owed_cents as number) / 100).toLocaleString()}
                          </span>
                        )}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatRelative(n.uploaded_at)}</p>
                    </div>
                    <Badge variant={n.status === 'mailed' ? 'green' : n.status === 'classified' ? 'amber' : 'secondary'}>
                      {n.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity feed</CardTitle>
          </CardHeader>
          <CardContent>
            {(recentActivity.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet. As your contacts engage, you'll see it here.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.data?.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    <div className="min-w-0">
                      <p>
                        <span className="font-mono text-xs text-muted-foreground">{a.type}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelative(a.occurred_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Onboarding checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="divide-y divide-border text-sm">
            <ChecklistItem href="/notices/new" title="Snap your first notice" body="The fastest 'aha' on the platform." />
            <ChecklistItem href="/contacts/import" title="Import contacts (CSV)" body="Drop your taxpayer-client list and tag-bulk in 60 seconds." />
            <ChecklistItem href="/settings/email" title="Verify your sending domain" body="Custom domain on Standard+. Apex on Pro." />
            <ChecklistItem href="/workflows" title="Fork a starter workflow" body="14-day trial nurture, 90-day cold CPA, evergreen welcome." />
            <ChecklistItem href="/settings/api" title="Embed the tracking script" body="One line on your firm site. Real-time visitor map turns on." />
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid size-10 place-items-center rounded-lg bg-accent/10">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 font-serif text-3xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyNotices() {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium">No notices yet</p>
      <p className="mt-1 text-xs text-muted-foreground">Snap one — see what comes back in 60 seconds.</p>
      <Button asChild variant="gold" size="sm" className="mt-3">
        <Link href="/notices/new">+ Upload</Link>
      </Button>
    </div>
  );
}

function ChecklistItem({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link href={href}>
          Start <ArrowUpRight className="size-3.5" />
        </Link>
      </Button>
    </li>
  );
}
