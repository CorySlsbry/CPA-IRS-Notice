import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Comment triggers' };

export default async function TriggersPage() {
  const sb = await createSupabaseServerClient();
  const { data: triggers } = await sb
    .from('social_comment_triggers')
    .select('id, keyword, match_mode, action, action_payload, active, match_count, last_matched_at, social_accounts(platform, display_name)')
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Button asChild variant="ghost" size="sm">
        <Link href="/social">
          <ArrowLeft className="size-4" /> Social
        </Link>
      </Button>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Comment triggers</h1>
          <p className="text-sm text-muted-foreground">
            ManyChat-style: when someone comments [keyword], we DM them, tag them, or enroll them in a workflow.
          </p>
        </div>
        <Button asChild variant="gold">
          <Link href="/social/triggers/new">+ New trigger</Link>
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">All triggers</CardTitle>
        </CardHeader>
        <CardContent>
          {(triggers ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center">
              <p className="font-serif text-2xl">No triggers yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Suggested first trigger: <code>NOTICE</code> → DM the lead-magnet checklist link.
              </p>
              <Button asChild variant="gold" className="mt-4">
                <Link href="/social/triggers/new?preset=notice-checklist">Create the NOTICE → DM trigger</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {triggers?.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">{t.keyword as string}</code>{' '}
                      <span className="text-muted-foreground">→ {t.action as string}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(t.social_accounts as { platform: string; display_name: string } | null)?.display_name}
                      {' · '}
                      matched {t.match_count ?? 0}x
                    </p>
                  </div>
                  <Badge variant={t.active ? 'green' : 'secondary'}>{t.active ? 'active' : 'paused'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            We subscribe to your Facebook Page + Instagram Business Account webhooks at{' '}
            <code className="rounded bg-secondary px-1">/api/webhooks/meta</code>. Each comment that arrives is matched
            against active triggers in keyword order. The first match fires the configured action — DM, tag, or workflow
            enrollment — exactly once per (comment, trigger) pair.
          </p>
          <p>
            <strong>Heads up:</strong> Instagram comment-management requires the{' '}
            <code>instagram_manage_comments</code> + <code>instagram_manage_messages</code> scopes which need Meta App
            Review approval. While that's pending, IG triggers persist comments + queue DMs with status{' '}
            <code>blocked_scope_pending</code> so nothing's lost — they'll fire automatically once the scope is approved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
