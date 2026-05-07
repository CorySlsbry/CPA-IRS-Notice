'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function LeadMagnetForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = new FormData(e.currentTarget);
      const r = await fetch('/api/lead-magnets/notice-checklist/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(data.get('email') ?? ''),
          firmName: String(data.get('firm') ?? ''),
          source: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_source') : null,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body?.error ?? 'Something went wrong — try again');
        return;
      }
      setDone(true);
      // Open the checklist in a new tab while keeping the success state on this page
      setTimeout(() => {
        window.open('/checklist', '_blank', 'noopener');
      }, 400);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5">
        <CheckCircle2 className="size-6 shrink-0 text-emerald-600" />
        <div>
          <p className="font-serif text-xl text-emerald-900">You're in. Checklist opening now.</p>
          <p className="mt-1 text-sm text-emerald-900/80">
            We also emailed you a copy from <code className="rounded bg-emerald-100 px-1">support@salisburybookkeeping.com</code>{' '}
            so it's on hand next time a notice walks in. If it's not in your inbox in 60 seconds,
            check spam — and tell me where it landed (reply to that email).
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border-2 border-accent/40 bg-card p-6">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="firm" className="text-sm">
            Firm name
          </Label>
          <Input id="firm" name="firm" required placeholder="Smith CPA, LLC" autoComplete="organization" />
        </div>
        <div>
          <Label htmlFor="email" className="text-sm">
            Work email
          </Label>
          <Input id="email" name="email" type="email" required placeholder="you@firm.com" autoComplete="email" />
        </div>
      </div>
      <Button type="submit" size="lg" variant="gold" className="mt-4 w-full pulse-glow" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending the checklist…
          </>
        ) : (
          'Send me the checklist (free, instant)'
        )}
      </Button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        One email. From a real CPA. Unsubscribe with one click in the footer of every message.
      </p>
    </form>
  );
}
