'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';

const TIERS = [
  {
    id: 'founding',
    name: 'Founding',
    price: 99,
    tag: 'Locked for life — first 100 firms',
    bullets: [
      'Notice tool, all 12 types',
      '500 CRM contacts',
      'Basic email engine',
      '1 active workflow',
      'Website analytics',
      'Email support',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 299,
    tag: 'Most popular',
    bullets: [
      'Everything in Founding',
      '5,000 CRM contacts',
      'Unlimited workflows',
      'Full analytics + funnels',
      'Custom email domain',
      'Priority support',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 599,
    tag: 'For multi-office firms',
    bullets: [
      'Everything in Standard',
      '25,000 CRM contacts',
      'Dedicated sending IP',
      'White-label notice letters',
      'Public API + webhooks',
      'Sub-accounts',
      'SLA + named CSM',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
] as const;

export function Pricing() {
  return (
    <section id="pricing" className="bg-card/40 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Pricing</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            Three tiers. Two notices a month covers Founding.
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Refer 2 CPAs and all three of you get <strong className="text-foreground">20% off for life</strong>. Always on, every tier.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <Card
              key={t.id}
              className={
                t.highlight
                  ? 'relative border-2 border-accent/60 shadow-xl ring-1 ring-accent/30'
                  : 'border-border'
              }
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-accent-foreground">
                  Most popular
                </div>
              )}
              <CardContent className="p-7">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-2xl">{t.name}</h3>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{t.tag}</p>
                <p className="mt-4 font-serif text-5xl">
                  ${t.price}
                  <span className="text-base text-muted-foreground">/mo</span>
                </p>

                <ul className="mt-5 space-y-2.5 text-sm">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild size="lg" variant={t.highlight ? 'gold' : 'default'} className="mt-7 w-full">
                  <Link href={`/signup?plan=${t.id}`}>{t.cta}</Link>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">14-day trial · no card required</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
