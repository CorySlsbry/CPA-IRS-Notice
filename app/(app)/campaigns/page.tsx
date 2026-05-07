import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/utils';

export const metadata = { title: 'Campaigns' };

export default async function CampaignsPage() {
  const sb = await createSupabaseServerClient();
  const { data: campaigns } = await sb
    .from('campaigns')
    .select('id, name, status, scheduled_at, sent_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Broadcast emails with opens, clicks, and replies tracked.</p>
        </div>
        <Button asChild variant="gold">
          <Link href="/campaigns/new">+ New campaign</Link>
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">All campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {(campaigns ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No campaigns yet. Workflows handle most drip work — campaigns are for one-off broadcasts.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {campaigns?.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      <Link href={`/campaigns/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.sent_at
                        ? `Sent ${formatRelative(c.sent_at)}`
                        : c.scheduled_at
                          ? `Scheduled ${formatRelative(c.scheduled_at)}`
                          : `Created ${formatRelative(c.created_at)}`}
                    </p>
                  </div>
                  <Badge variant={c.status === 'sent' ? 'green' : c.status === 'sending' || c.status === 'scheduled' ? 'amber' : 'secondary'}>
                    {c.status}
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
