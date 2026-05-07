'use client';

import { motion } from 'framer-motion';
import { Camera, ScanLine, FileSignature, Stamp } from 'lucide-react';

const STEPS = [
  {
    icon: Camera,
    name: 'Snap',
    title: 'Snap the notice on your phone.',
    body: 'Camera works. Scanner works. PDF email upload works. We do the OCR — you do nothing.',
  },
  {
    icon: ScanLine,
    name: 'Classify',
    title: 'AI reads it and pulls the facts.',
    body: 'Notice type, tax year, amount owed, IRS reasoning. Pre-fills your CRM contact too.',
  },
  {
    icon: FileSignature,
    name: 'Review',
    title: 'Read the draft. Edit two sentences.',
    body: 'Draft cites the IRC sections. You\'re the CPA — you sign off on the final wording.',
  },
  {
    icon: Stamp,
    name: 'Mail',
    title: 'One click. Lob mails it certified.',
    body: 'We track delivery. Your client sees a "we mailed it" email automatically. Done.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">How it works</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            Four steps. Six minutes. One signed certified letter.
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Every step also writes to your CRM. By the time you mail the response, your contact, deal stage, and activity timeline are already updated.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="relative rounded-2xl border border-border bg-card p-6"
            >
              <div className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                Step {i + 1}
              </div>
              <s.icon className="size-7 text-accent" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">{s.name}</p>
              <h3 className="mt-1 font-serif text-xl leading-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
