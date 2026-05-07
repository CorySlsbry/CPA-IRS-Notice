'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Camera, Cpu, FileSignature, Stamp, Mail, CheckCircle2 } from 'lucide-react';

/**
 * Detailed case-study walkthrough of a real CP2000 — narrative format.
 * Per Sabrina §17: "pitch the outcome, not the task." This page shows the
 * concrete outcome end-to-end: notice → 6-minute drafting → certified
 * mail → IRS withdrew the adjustment.
 *
 * Pure presentational — no data fetching.
 */

const TIMELINE = [
  {
    icon: Camera,
    timestamp: '0:00',
    title: 'Tuesday morning. Snap.',
    body: 'Client walks in with the CP2000. Phone camera, three pages, drop into the dashboard. No scanner. No retyping. Image upload starts before I sit down.',
  },
  {
    icon: Cpu,
    timestamp: '0:47',
    title: 'Classification + extracted reasoning.',
    body: 'CP2000, Tax Year 2024, $14,623.42 plus $841.20 interest. IRS reasoning: $43,217 from a 1099-DIV not reported. Strategy auto-suggested: disagree with documentation. Confidence: 0.97.',
  },
  {
    icon: FileSignature,
    timestamp: '2:30',
    title: 'Drafted response with the right citations.',
    body: 'Two paragraphs. Cites IRC §852(b)(3) for the capital-gain-distribution treatment. Lists Exhibits A + B (Schedule D + Schwab consolidated 1099). I edit two sentences for tone. The dollar amount, the SSN, the date — all already correct.',
  },
  {
    icon: Stamp,
    timestamp: '5:48',
    title: "One click → mailed certified.",
    body: 'I review one more time. Click Mail. Lob picks it up. I get a tracking number in the activity timeline. Total time on this notice: 6 minutes flat.',
  },
  {
    icon: Mail,
    timestamp: '5 weeks later',
    title: 'IRS sends the “no balance due” confirmation.',
    body: 'Adjustment withdrawn. Same outcome we would have produced with a 90-minute manual draft. Same fee to the client ($349). 84 minutes of margin recovered.',
  },
];

export function CaseStudy() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Outcome, not feature list</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            $14,623.42 CP2000 → withdrawn. Six minutes of CPA time.
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            One real notice, end-to-end. The fee to the client didn't change. The CPA's hours-billable-per-week went up.
          </p>
        </div>

        <ol className="mt-14 space-y-6 max-w-3xl mx-auto">
          {TIMELINE.map((step, i) => (
            <motion.li
              key={step.timestamp}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="grid grid-cols-[5rem,1fr,auto] items-start gap-4 p-5 sm:grid-cols-[6.5rem,1fr,auto]">
                  <div className="font-mono text-xs">
                    <Badge variant="gold">{step.timestamp}</Badge>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 font-serif text-lg leading-tight">
                      <step.icon className="size-4 text-accent" />
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                  {i < TIMELINE.length - 1 ? (
                    <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
                  ) : (
                    <CheckCircle2 className="hidden size-5 text-emerald-600 sm:block" />
                  )}
                </CardContent>
              </Card>
            </motion.li>
          ))}
        </ol>

        <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-accent/40 bg-card p-6 text-center shadow-sm">
          <p className="font-serif text-2xl">The math on this one notice</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Stat kicker="Old way" value="90 min" sub="manual draft + research" />
            <Stat kicker="New way" value="6 min" sub="review + mail" highlight />
            <Stat kicker="Recovered" value="$210" sub="84 min @ $150/hr" />
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            The Founding plan is $99/mo. <strong className="text-foreground">Half of one notice covers it.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({
  kicker,
  value,
  sub,
  highlight,
}: {
  kicker: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? 'rounded-lg bg-accent/15 p-3'
          : 'rounded-lg bg-secondary/40 p-3'
      }
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{kicker}</p>
      <p className="mt-0.5 font-serif text-2xl">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
