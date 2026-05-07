'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';

const STACK = [
  { name: 'AI IRS Notice Drafter (12 notice types, vision OCR)', value: 1200 },
  { name: 'Lob certified mail integration (one-click → mailed)', value: 200 },
  { name: 'Built-in CRM (contacts, companies, custom fields)', value: 348 },
  { name: 'Email engine + analytics (opens, clicks, replies)', value: 240 },
  { name: 'Visual workflow builder (3 archetype starters)', value: 600 },
  { name: 'Website visitor analytics + funnel tracking', value: 180 },
  { name: 'Embeddable forms + tracking script', value: 120 },
  { name: 'Pipelines + kanban + deal velocity reports', value: 180 },
  { name: 'Public API + outbound webhooks', value: 240 },
  { name: 'White-label outgoing notice letters (Pro)', value: 600 },
];

const TOTAL = STACK.reduce((s, x) => s + x.value, 0);

export function ValueStack() {
  return (
    <section className="bg-card/40 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">What you actually get</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            Stop paying 4 vendors. Get every tool a small CPA practice needs in one login.
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Total retail value of the bundle: <strong className="text-foreground">${TOTAL.toLocaleString()}/mo</strong>.
            Founding price: <strong className="text-foreground">$99/mo, locked for life</strong>.
          </p>
        </div>

        <ul className="mx-auto mt-10 grid max-w-4xl gap-3 md:grid-cols-2">
          {STACK.map((s, i) => (
            <motion.li
              key={s.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
            >
              <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent/20">
                    <Check className="size-3.5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
                    ${s.value}/mo
                  </span>
                </CardContent>
              </Card>
            </motion.li>
          ))}
        </ul>

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border-2 border-accent/40 bg-card p-6 text-center shadow-sm">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Total retail value</p>
          <p className="mt-1 font-serif text-5xl line-through opacity-60">${TOTAL.toLocaleString()}<span className="text-2xl">/mo</span></p>
          <p className="mt-4 text-sm uppercase tracking-wider text-accent font-semibold">Today, founder price</p>
          <p className="font-serif text-6xl font-medium">$99<span className="text-2xl text-muted-foreground">/mo</span></p>
          <p className="mt-2 text-xs text-muted-foreground">First 100 firms · locked for life · 14-day trial · no card</p>
        </div>
      </div>
    </section>
  );
}
