'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Layers3, Mail, MapPin, Workflow } from 'lucide-react';

export function CrmShowcase() {
  return (
    <section id="crm" className="bg-primary/5 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">The moat</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            Your operating system, not just a tool.
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            The notice tool is the wedge. The CRM is what keeps you. Built specifically for how a CPA practice actually runs — not a re-skin of HubSpot.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ShowcaseCard
            icon={<Activity className="size-5" />}
            title="Activity timeline"
            body="Every email, page visit, form fill, deal change, and notice mailed — one chronological feed per contact. No tab-hopping."
            preview={<TimelinePreview />}
          />
          <ShowcaseCard
            icon={<Workflow className="size-5" />}
            title="Visual workflows"
            body="Three starter archetypes pre-loaded: 14-day trial nurture, 90-day cold CPA nurture, evergreen welcome. Drag, drop, run."
            preview={<WorkflowPreview />}
          />
          <ShowcaseCard
            icon={<Layers3 className="size-5" />}
            title="Pipelines + deals"
            body="Multiple pipelines, kanban + table view, per-stage conversion. Auto-create deals from workflows. No upgrade tax."
            preview={<PipelinePreview />}
          />
          <ShowcaseCard
            icon={<Mail className="size-5" />}
            title="Email engine"
            body="Resend-powered. Custom domain. Open + click + reply tracking. One suppression list for transactional + marketing."
            preview={<EmailPreview />}
          />
          <ShowcaseCard
            icon={<MapPin className="size-5" />}
            title="Real-time visitor map"
            body="See every visitor on your site live. UTM attribution, funnels, page-level scroll depth. First-party — no Google Analytics."
            preview={<VisitorMapPreview />}
          />
          <ShowcaseCard
            icon={<Activity className="size-5" />}
            title="Public API + webhooks"
            body="Per-firm API keys. Standard REST. Webhook out on every event. Integrate Zapier, Make, your spreadsheet — your call."
            preview={<ApiPreview />}
          />
        </div>
      </div>
    </section>
  );
}

function ShowcaseCard({
  icon,
  title,
  body,
  preview,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  preview: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45 }}
    >
      <Card className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="border-b border-border bg-secondary/40 p-4 font-mono text-[11px] text-muted-foreground">
          {preview}
        </div>
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">{icon}</div>
            <h3 className="font-serif text-lg">{title}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TimelinePreview() {
  return (
    <ul className="space-y-1.5">
      {[
        ['email_open', '"Welcome to NoticeReply…" — 2m ago'],
        ['page_view', '/pricing — 4m ago'],
        ['notice_mailed', 'CP2000 → IRS — 1h ago'],
        ['email_reply', '"Looks great, thanks!" — 3h ago'],
      ].map(([t, b]) => (
        <li key={`${t}-${b}`} className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" /> <span className="text-foreground">{t}</span>
          <span className="text-muted-foreground">→ {b}</span>
        </li>
      ))}
    </ul>
  );
}

function WorkflowPreview() {
  return (
    <pre className="text-[11px] leading-snug">{`▶ trigger:    tag_added "trial-active"
   ↓
   send: trial_day0_welcome
   ↓
   wait 2 days
   ↓
   send: trial_day2_first_notice
   ↓
   …`}</pre>
  );
}

function PipelinePreview() {
  const stages = ['New', 'Engaged', 'Qualified', 'Won'];
  return (
    <div className="grid grid-cols-4 gap-1">
      {stages.map((s, i) => (
        <div key={s} className="rounded bg-card p-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground">{s}</div>
          <div className="mt-1 h-1.5 rounded bg-accent" style={{ width: `${100 - i * 22}%` }} />
        </div>
      ))}
    </div>
  );
}

function EmailPreview() {
  return (
    <pre className="text-[11px] leading-snug">{`📧  Sent     412
✉️  Opened   289 (70%)
🔗  Clicked   97 (23%)
✍️  Replied   38 (9%)`}</pre>
  );
}

function VisitorMapPreview() {
  return (
    <div className="relative h-20 w-full">
      <div className="absolute left-[15%] top-[40%] size-2 animate-pulse rounded-full bg-emerald-500" />
      <div className="absolute left-[40%] top-[20%] size-2 animate-pulse rounded-full bg-accent [animation-delay:.6s]" />
      <div className="absolute left-[60%] top-[55%] size-2 animate-pulse rounded-full bg-primary [animation-delay:.3s]" />
      <div className="absolute left-[78%] top-[35%] size-2 animate-pulse rounded-full bg-emerald-500 [animation-delay:.9s]" />
      <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">3 live · 12 today</div>
    </div>
  );
}

function ApiPreview() {
  return (
    <pre className="text-[11px] leading-snug">{`curl -X POST .../api/public/v1/contacts \\
  -H "x-api-key: nr_live_…" \\
  -d '{"email":"j@firm.com",
       "tags":["cpa-prospect"]}'`}</pre>
  );
}
