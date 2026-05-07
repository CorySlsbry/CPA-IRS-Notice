'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

type Account = { id: string; platform: string; display_name: string; username: string | null };

export function ComposeClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function submit(immediate: boolean) {
    if (!accountId) {
      toast.error('Connect an account first');
      return;
    }
    if (!body.trim()) {
      toast.error('Body required');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/social/post', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          body,
          mediaUrls: mediaUrl ? [mediaUrl] : undefined,
          linkUrl: linkUrl || undefined,
          scheduledAt: immediate ? undefined : scheduledAt || undefined,
        }),
      });
      const r2 = await r.json();
      if (!r.ok) {
        toast.error(r2?.error ?? 'Post failed');
        return;
      }
      toast.success(immediate ? 'Posted!' : `Scheduled for ${new Date(r2.scheduledAt).toLocaleString()}`);
      router.push('/social');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="font-serif text-2xl">No accounts connected.</p>
          <p className="mt-1 text-sm text-muted-foreground">Hook up Facebook or Instagram first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div>
          <Label>Account</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                className={
                  'rounded-full border px-3 py-1.5 text-sm ' +
                  (accountId === a.id
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border hover:bg-secondary')
                }
              >
                {a.platform.toUpperCase()} · {a.display_name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="body">Body</Label>
          <textarea
            id="body"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What are you posting?"
            className="mt-1.5 w-full rounded-md border border-border bg-background p-3 text-base"
            maxLength={5000}
          />
          <p className="mt-1 text-xs text-muted-foreground">{body.length}/5000</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="media">Image URL (optional)</Label>
            <Input id="media" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label htmlFor="link">Link URL (FB only)</Label>
            <Input id="link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>

        <div>
          <Label htmlFor="when">Schedule for (optional — leave blank to post now)</Label>
          <Input id="when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => submit(true)} variant="gold" size="lg" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Post now
          </Button>
          <Button onClick={() => submit(false)} variant="outline" size="lg" disabled={busy || !scheduledAt}>
            Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
