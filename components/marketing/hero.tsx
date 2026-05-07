'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, ShieldCheck, Stamp } from 'lucide-react';
import { TrialModal } from './trial-modal';
import { useState } from 'react';

export function Hero() {
  const [open, setOpen] = useState(false);

  return (
    <section className="relative overflow-hidden">
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:pt-20 md:pb-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" />
            Built by a CPA, for CPAs · 14-day trial · No card
          </p>

          <h1 className="mt-5 font-serif text-balance text-[2.5rem] font-medium leading-[1.05] tracking-tight md:text-[3.5rem] lg:text-[4rem]">
            Turn 90-Minute IRS Notice Responses Into{' '}
            <span className="bg-gradient-to-br from-accent to-amber-600 bg-clip-text text-transparent">
              10-Minute Wins
            </span>
            — And Run Your Whole Practice From One Dashboard.
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            NoticeReply drafts client-ready responses to <strong className="font-semibold text-foreground">12 IRS notice types</strong> in under 60 seconds. Mail them with one click. Plus a built-in CRM, email engine, and website analytics so you never touch GHL or HubSpot again.
          </p>

          {/* Above-fold stat row */}
          <div className="mt-7 grid grid-cols-3 gap-3 max-w-xl">
            <Stat icon={<Stamp className="size-4" />} kicker="10x faster" body="Avg 6 min vs 90 min" />
            <Stat kicker="$200+ margin" body="Per notice processed" />
            <Stat kicker="1 platform" body="Replaces 4 tools" />
          </div>

          {/* CTA */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="xl"
              variant="gold"
              className="pulse-glow"
              onClick={() => setOpen(true)}
            >
              Start 14-Day Free Trial — No Card Required
            </Button>
            <Button asChild size="xl" variant="ghost">
              <Link href="#demo">See a 90-sec demo →</Link>
            </Button>
          </div>

          {/* Risk-reversal directly under button — Hormozi spec */}
          <div className="mt-5 max-w-xl rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm leading-relaxed">
            <span className="font-semibold">💯 Triple Guarantee:</span>{' '}
            If your first 5 notices don't save you 7+ hours, we refund your subscription, mail your responses for free, AND give you a free month of Standard. You literally cannot lose.
          </div>

          {/* Social proof */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-emerald-600" /> SOC 2 Type 1 in progress</div>
            <div>Trusted by CPA firms in <strong className="text-foreground">TX · FL · CA · NY</strong> + 18 other states</div>
          </div>
        </motion.div>

        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative md:pl-6"
        >
          <HeroFigure />
        </motion.div>
      </div>

      <TrialModal open={open} onOpenChange={setOpen} />
    </section>
  );
}

function Stat({ icon, kicker, body }: { icon?: React.ReactNode; kicker: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
        {icon} <span>{kicker}</span>
      </div>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}

/**
 * SVG hero figure stand-in. Replaces a real Imagen 4 Ultra render with
 * a tasteful editorial composition so dev mode doesn't depend on a
 * generated asset. Production should drop a .webp into /public/hero/
 * and swap this out.
 */
function HeroFigure() {
  return (
    <div className="relative aspect-[5/6] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl md:aspect-[5/5]">
      <svg viewBox="0 0 500 500" className="size-full" aria-hidden>
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.95 0.012 75)" />
            <stop offset="100%" stopColor="oklch(0.88 0.05 75)" />
          </linearGradient>
          <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.27 0.07 250)" />
            <stop offset="100%" stopColor="oklch(0.22 0.05 250)" />
          </linearGradient>
        </defs>
        <rect width="500" height="500" fill="url(#bg)" />
        {/* Desk */}
        <rect x="0" y="380" width="500" height="120" fill="oklch(0.78 0.06 75)" />
        {/* Monitor */}
        <rect x="160" y="120" width="280" height="180" rx="8" fill="oklch(0.22 0.04 250)" />
        <rect x="170" y="130" width="260" height="160" rx="4" fill="url(#screen)" />
        {/* Letter on screen */}
        <rect x="200" y="150" width="200" height="120" fill="white" />
        <rect x="210" y="160" width="80" height="6" fill="oklch(0.4 0.08 250)" />
        <rect x="210" y="174" width="180" height="3" fill="oklch(0.7 0.02 250)" />
        <rect x="210" y="182" width="160" height="3" fill="oklch(0.7 0.02 250)" />
        <rect x="210" y="190" width="170" height="3" fill="oklch(0.7 0.02 250)" />
        <rect x="210" y="220" width="60" height="20" fill="oklch(0.78 0.13 75)" />
        <text x="217" y="234" fontSize="11" fontFamily="Inter,sans-serif" fontWeight="600" fill="oklch(0.18 0.02 250)">CP2000</text>
        {/* Monitor stand */}
        <rect x="290" y="300" width="20" height="40" fill="oklch(0.22 0.04 250)" />
        <rect x="260" y="335" width="80" height="8" fill="oklch(0.22 0.04 250)" />
        {/* Coffee mug */}
        <ellipse cx="100" cy="395" rx="22" ry="6" fill="oklch(0.6 0.04 75)" />
        <rect x="78" y="350" width="44" height="50" rx="4" fill="oklch(0.18 0.02 250)" />
        <ellipse cx="100" cy="350" rx="22" ry="6" fill="oklch(0.36 0.04 75)" />
        {/* IRS letter on desk */}
        <g transform="translate(50,400) rotate(-7)">
          <rect width="120" height="80" fill="white" stroke="oklch(0.7 0.02 250)" />
          <rect x="8" y="8" width="50" height="6" fill="oklch(0.4 0.08 250)" />
          <rect x="8" y="22" width="100" height="2" fill="oklch(0.7 0.02 250)" />
          <rect x="8" y="28" width="90" height="2" fill="oklch(0.7 0.02 250)" />
          <rect x="8" y="34" width="100" height="2" fill="oklch(0.7 0.02 250)" />
          <rect x="8" y="40" width="80" height="2" fill="oklch(0.7 0.02 250)" />
          <rect x="8" y="56" width="40" height="14" fill="oklch(0.78 0.13 75)" />
        </g>
        {/* Plant */}
        <rect x="380" y="355" width="50" height="35" rx="4" fill="oklch(0.4 0.04 75)" />
        <ellipse cx="395" cy="345" rx="14" ry="20" fill="oklch(0.5 0.12 145)" />
        <ellipse cx="412" cy="340" rx="12" ry="22" fill="oklch(0.45 0.13 145)" />
        {/* Window light */}
        <rect x="0" y="0" width="500" height="120" fill="oklch(0.97 0.02 75)" opacity="0.5" />
        {/* Caption */}
        <text x="250" y="475" textAnchor="middle" fontFamily="Fraunces,serif" fontSize="14" fill="oklch(0.18 0.02 250)" fontStyle="italic">
          Tuesday morning. CP2000. 6 minutes.
        </text>
      </svg>
      <div className="pointer-events-none absolute inset-x-6 bottom-6 rounded-xl bg-card/85 p-4 shadow-md backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Live demo</p>
        <p className="mt-0.5 text-sm leading-snug text-foreground">
          "Brokerage 1099 was attached as Schedule D, p. 47" → response drafted in 47s, mailed certified by lunch.
        </p>
      </div>
    </div>
  );
}
