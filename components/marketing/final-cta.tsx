'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TrialModal } from './trial-modal';

export function FinalCta() {
  const [open, setOpen] = useState(false);
  return (
    <section className="relative isolate overflow-hidden bg-primary py-24 text-primary-foreground">
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-serif text-balance text-4xl leading-[1.05] md:text-6xl">
          Stop spending 90 minutes on a 6-minute job.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-primary-foreground/85">
          14-day free trial. No card. Cancel any time. Triple guarantee — refund + free mailings + free month if it doesn't save you 7 hours on the first 5 notices.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="xl" variant="gold" onClick={() => setOpen(true)} className="pulse-glow">
            Start 14-Day Free Trial — No Card Required
          </Button>
        </div>
        <p className="mt-6 text-xs uppercase tracking-wider text-primary-foreground/70">
          Founding tier · $99/mo locked for life · First 100 firms only
        </p>
      </div>
      <TrialModal open={open} onOpenChange={setOpen} />
    </section>
  );
}
