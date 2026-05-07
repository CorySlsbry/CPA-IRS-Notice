'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

/**
 * Per memory (hormozi_landing_page_patterns.md): "Delay the form. Button
 * first, modal second." Two tabs — single opt-in OR refer-2-for-20%-off.
 * The refer-2 path is the always-on flywheel.
 */
export function TrialModal({ open, onOpenChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'single' | 'refer'>('single');
  const [submitted, setSubmitted] = useState<{ code?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    if (open) {
      if (!ref.current.open) ref.current.showModal();
    } else if (ref.current.open) {
      ref.current.close();
    }
  }, [open]);

  async function submitSingle(formData: FormData) {
    setSubmitting(true);
    try {
      const email = String(formData.get('email') ?? '');
      if (!isEmail(email)) {
        toast.error('Enter a valid email');
        return;
      }
      // Hand off to /signup with email pre-filled.
      window.location.href = `/signup?email=${encodeURIComponent(email)}`;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRefer(formData: FormData) {
    setSubmitting(true);
    try {
      const me = String(formData.get('me') ?? '');
      const f1 = String(formData.get('f1') ?? '');
      const f2 = String(formData.get('f2') ?? '');
      if (![me, f1, f2].every(isEmail)) {
        toast.error('All three emails must be valid');
        return;
      }
      const r = await fetch('/api/public/v1/referral/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ me, friends: [f1, f2] }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body?.error ?? 'Something went wrong — try again');
        return;
      }
      setSubmitted({ code: body.code });
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    onOpenChange(false);
    setTimeout(() => setSubmitted(null), 200);
  }

  return (
    <dialog
      ref={ref}
      onClose={close}
      className="m-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="w-[min(28rem,calc(100vw-2rem))] p-6">
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary"
        >
          ✕
        </button>
        {submitted ? (
          <SuccessPanel code={submitted.code} />
        ) : (
          <>
            <h2 className="font-serif text-2xl leading-tight">Start your 14-day trial</h2>
            <p className="mt-1 text-sm text-muted-foreground">No card. Cancel any time. Read-only access for 30 days after.</p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 text-sm">
              <button
                onClick={() => setTab('single')}
                className={
                  tab === 'single'
                    ? 'rounded-md bg-background px-3 py-2 font-medium shadow-sm'
                    : 'rounded-md px-3 py-2 text-muted-foreground'
                }
              >
                <Sparkles className="-mt-0.5 mr-1.5 inline size-4" /> Solo opt-in
              </button>
              <button
                onClick={() => setTab('refer')}
                className={
                  tab === 'refer'
                    ? 'rounded-md bg-background px-3 py-2 font-medium shadow-sm'
                    : 'rounded-md px-3 py-2 text-muted-foreground'
                }
              >
                <Users className="-mt-0.5 mr-1.5 inline size-4" /> Refer 2, all get 20%
              </button>
            </div>

            {tab === 'single' ? (
              <form
                action={submitSingle}
                className="mt-5 flex flex-col gap-3"
              >
                <div>
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@firm.com" />
                </div>
                <Button type="submit" size="lg" variant="gold" disabled={submitting}>
                  {submitting ? 'Starting…' : 'Start free trial'}
                </Button>
                <p className="text-xs text-muted-foreground">By signing up you agree to our Terms + Privacy. We'll email from <code className="rounded bg-secondary px-1 text-xs">support@salisburybookkeeping.com</code>.</p>
              </form>
            ) : (
              <form
                action={submitRefer}
                className="mt-5 flex flex-col gap-3"
              >
                <p className="rounded-md bg-accent/15 p-3 text-sm">
                  Refer 2 CPAs and all three of you get <strong>20% off for life</strong>. We email the code to all three.
                </p>
                <div>
                  <Label htmlFor="me">Your work email</Label>
                  <Input id="me" name="me" type="email" required placeholder="you@firm.com" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="f1">CPA friend #1</Label>
                    <Input id="f1" name="f1" type="email" required placeholder="friend1@firm.com" />
                  </div>
                  <div>
                    <Label htmlFor="f2">CPA friend #2</Label>
                    <Input id="f2" name="f2" type="email" required placeholder="friend2@firm.com" />
                  </div>
                </div>
                <Button type="submit" size="lg" variant="gold" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send the code to all 3'}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

function SuccessPanel({ code }: { code?: string }) {
  return (
    <div className="text-center">
      <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
      <h3 className="mt-3 font-serif text-2xl">You're in.</h3>
      {code ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Code emailed to all three of you:</p>
          <code className="mt-3 inline-block rounded-md bg-secondary px-3 py-1.5 font-mono text-base font-semibold">
            {code}
          </code>
          <p className="mt-3 text-xs text-muted-foreground">
            Apply at checkout for 20% off any tier — locks for life.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Check your inbox to confirm and start the trial.</p>
      )}
    </div>
  );
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}
