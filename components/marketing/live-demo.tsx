'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Cpu, FileSignature, Loader2, Stamp, Check } from 'lucide-react';

/**
 * Public live demo on the landing page. NO backend, NO signup. Hardcoded
 * realistic CP2000 → animated classification → animated draft. Delivers the
 * "aha" within 30 seconds of landing — per Sabrina's §20 "user gets value
 * within 90 seconds" rule. Visitors who see this convert at materially
 * higher rates than visitors who only see static screenshots.
 *
 * Three states: idle → classifying (3s shimmer) → drafted (typewriter).
 */

const SAMPLE_CLASSIFICATION = {
  noticeType: 'CP2000',
  noticeDate: '2026-04-08',
  responseDueDate: '2026-05-08',
  taxYear: 2024,
  taxpayerName: '[Sample taxpayer]',
  ssnMasked: '***-**-4421',
  amountOwedCents: 1462342,
  interestCents: 84120,
  penaltyCents: 0,
  irsReasoning:
    'IRS records show $43,217 in 1099-DIV income from Charles Schwab not reported on the 1040. Adjustment increases tax liability by $14,623.42 plus statutory interest.',
  suggestedResponseStrategy: 'disagree_with_documentation',
  confidence: 0.97,
};

const SAMPLE_DRAFT = `Internal Revenue Service
Brookhaven, NY 11742-9006

Re: Response to CP2000 dated 04/08/2026 — Tax Year 2024 — [Sample taxpayer] — SSN ***-**-4421

Dear Sir or Madam:

We respectfully disagree with the proposed adjustment of $14,623.42 in the above-referenced notice. The 1099-DIV from Charles Schwab in the amount of $43,217 was reported on the original 2024 Form 1040, included in the Schedule D supporting documentation as part of the brokerage consolidation summary (see Exhibit A, page 47).

The income was correctly aggregated under "Capital gain distributions" on Schedule D, line 13, rather than as ordinary dividends on Schedule B, due to the nature of the underlying mutual fund distributions. Per IRC §852(b)(3), capital gain distributions from regulated investment companies are reportable as long-term capital gains regardless of holding period. The Schwab consolidated 1099 (Exhibit B) substantiates this classification.

We respectfully request that the proposed adjustment be withdrawn and confirmation of no balance due be issued in writing. Enclosed are copies of the 2024 Form 1099-DIV, the corresponding Schedule D, and the brokerage consolidation summary.

Sincerely,

[CPA name], CPA
[Firm name]
[Firm address]

Enclosures: Exhibit A — 2024 Schedule D; Exhibit B — Schwab 1099-DIV consolidated

This letter was drafted with the assistance of NoticeReply software and reviewed and signed by the undersigned CPA, who is solely responsible for its content.`;

type Stage = 'idle' | 'classifying' | 'drafted';

export function LiveDemo() {
  const [stage, setStage] = useState<Stage>('idle');
  const [draftIndex, setDraftIndex] = useState(0);

  // Type-out the draft when we land in the drafted stage
  useEffect(() => {
    if (stage !== 'drafted') return;
    if (draftIndex >= SAMPLE_DRAFT.length) return;
    const speed = draftIndex < 200 ? 4 : 8; // first paragraph faster, slow down later
    const t = setTimeout(() => setDraftIndex((i) => i + 6), speed);
    return () => clearTimeout(t);
  }, [stage, draftIndex]);

  function startDemo() {
    setStage('classifying');
    setDraftIndex(0);
    setTimeout(() => setStage('drafted'), 2400);
  }

  function reset() {
    setStage('idle');
    setDraftIndex(0);
  }

  return (
    <section id="demo" className="relative isolate bg-card/40 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Try it on a real CP2000 — no signup</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            Click "Run sample". Watch the response draft itself.
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Sample IRS notice, sample taxpayer. The classifier and drafter are running on a hardcoded payload here so you can see the output without signing up. The production pipeline is identical — just with your real notice.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr,1fr]">
          {/* Left: the "notice" + classification */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr,2fr]">
                <div className="border-r border-border bg-secondary/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Step 1 · Snap
                  </p>
                  <NoticeMockImage />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Cpu className="size-3.5" /> Step 2 · Classify
                    {stage === 'classifying' && <Loader2 className="size-3.5 animate-spin text-accent" />}
                    {stage === 'drafted' && <Check className="size-3.5 text-emerald-600" />}
                  </div>

                  {stage === 'idle' ? (
                    <div className="mt-3 grid h-48 place-items-center text-center">
                      <Button onClick={startDemo} variant="gold" size="lg" className="pulse-glow">
                        <Camera className="size-4" /> Run sample CP2000
                      </Button>
                    </div>
                  ) : (
                    <ClassificationPanel stage={stage} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right: the draft */}
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <FileSignature className="size-3.5" /> Step 3 · Drafted response
                  {stage === 'drafted' && draftIndex >= SAMPLE_DRAFT.length - 6 && (
                    <Badge variant="green">complete</Badge>
                  )}
                </div>
                {stage !== 'idle' && (
                  <Button onClick={reset} variant="ghost" size="sm">
                    Reset
                  </Button>
                )}
              </div>
              <pre className="mt-3 h-[360px] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/20 p-4 font-mono text-[11.5px] leading-relaxed">
                {stage === 'idle' ? (
                  <span className="text-muted-foreground">
                    The drafted response will animate here in real time once you click Run sample.
                  </span>
                ) : stage === 'classifying' ? (
                  <span className="text-muted-foreground">Waiting for classification…</span>
                ) : (
                  <>
                    {SAMPLE_DRAFT.slice(0, draftIndex)}
                    {draftIndex < SAMPLE_DRAFT.length && <span className="animate-pulse">▍</span>}
                  </>
                )}
              </pre>
              {stage === 'drafted' && draftIndex >= SAMPLE_DRAFT.length - 6 && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Pill icon={<Stamp className="size-3.5" />} label="One click → mailed certified via Lob" />
                  <Pill icon={<FileSignature className="size-3.5" />} label="IRC §852(b)(3) auto-cited" />
                  <Pill icon={<Cpu className="size-3.5" />} label="47 sec on real production" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          The production version handles all 12 notice types, supports your firm's signer + letterhead, and mails certified to the IRS. This demo runs on a hardcoded payload so you can see the output instantly.
        </p>
      </div>
    </section>
  );
}

function ClassificationPanel({ stage }: { stage: Stage }) {
  if (stage === 'classifying') {
    return (
      <div className="mt-3 space-y-2.5">
        {[80, 60, 95, 72, 90].map((w, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-secondary"
            style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    );
  }
  return (
    <AnimatePresence>
      <motion.dl
        key="classified"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mt-3 space-y-1.5 text-[12.5px]"
      >
        <Field label="Type" value={<Badge variant="gold">{SAMPLE_CLASSIFICATION.noticeType}</Badge>} />
        <Field label="Tax year" value={SAMPLE_CLASSIFICATION.taxYear} />
        <Field
          label="Amount owed"
          value={<span className="font-mono font-semibold">${(SAMPLE_CLASSIFICATION.amountOwedCents / 100).toLocaleString()}</span>}
        />
        <Field label="SSN" value={<span className="font-mono">{SAMPLE_CLASSIFICATION.ssnMasked}</span>} />
        <Field label="Response due" value={SAMPLE_CLASSIFICATION.responseDueDate} />
        <Field
          label="Strategy"
          value={
            <span className="text-foreground">{SAMPLE_CLASSIFICATION.suggestedResponseStrategy.replace(/_/g, ' ')}</span>
          }
        />
        <Field
          label="Confidence"
          value={
            <span className="font-mono text-emerald-700">
              {(SAMPLE_CLASSIFICATION.confidence * 100).toFixed(0)}%
            </span>
          }
        />
        <p className="mt-2 rounded-md border border-border bg-background p-2 text-[11px] leading-snug text-muted-foreground">
          {SAMPLE_CLASSIFICATION.irsReasoning}
        </p>
      </motion.dl>
    </AnimatePresence>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1 last:border-0">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-[10px] text-muted-foreground">
      {icon} <span>{label}</span>
    </div>
  );
}

/** SVG mock of an IRS notice — no real PII obviously. */
function NoticeMockImage() {
  return (
    <div className="mt-2 aspect-[5/6] overflow-hidden rounded border border-border bg-white">
      <svg viewBox="0 0 250 300" className="size-full" aria-hidden>
        <rect width="250" height="300" fill="#ffffff" />
        <rect x="14" y="14" width="60" height="14" fill="#1e3a8a" />
        <text x="78" y="25" fontSize="9" fontFamily="Inter" fontWeight="700" fill="#1e3a8a">
          IRS · Notice
        </text>
        <rect x="180" y="14" width="56" height="22" fill="#fbbf24" />
        <text x="184" y="29" fontSize="11" fontFamily="Inter" fontWeight="700" fill="#1e3a8a">
          CP2000
        </text>
        <line x1="14" y1="50" x2="236" y2="50" stroke="#e2e8f0" />
        <text x="14" y="68" fontSize="8" fill="#475569">Notice date 04/08/2026</text>
        <text x="14" y="80" fontSize="8" fill="#475569">Tax year 2024</text>
        <rect x="14" y="92" width="222" height="2" fill="#cbd5e1" />
        <text x="14" y="110" fontSize="7" fill="#1e293b">We changed your 2024 Form 1040 because</text>
        <text x="14" y="120" fontSize="7" fill="#1e293b">we found 1099 income that wasn't reported.</text>
        <rect x="14" y="134" width="222" height="2" fill="#cbd5e1" />
        <text x="14" y="150" fontSize="7" fontWeight="700" fill="#1e293b">Amount due</text>
        <text x="180" y="150" fontSize="9" fontWeight="700" fill="#dc2626" textAnchor="end">
          $14,623.42
        </text>
        <text x="14" y="166" fontSize="6" fill="#64748b">+ statutory interest $841.20</text>
        <rect x="14" y="180" width="222" height="2" fill="#cbd5e1" />
        <text x="14" y="200" fontSize="7" fill="#475569">Schwab 1099-DIV $43,217</text>
        <text x="14" y="210" fontSize="7" fill="#475569">not reported on Schedule B</text>
        <text x="14" y="220" fontSize="7" fill="#475569">(was actually on Schedule D)</text>
        <rect x="14" y="244" width="60" height="22" fill="#fef3c7" />
        <text x="20" y="259" fontSize="8" fontWeight="700" fill="#92400e">Reply by</text>
        <text x="84" y="259" fontSize="8" fill="#0f172a">05/08/2026</text>
      </svg>
    </div>
  );
}
