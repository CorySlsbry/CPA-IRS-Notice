'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'Is this legal? Are we allowed to send AI-drafted responses to the IRS?',
    a: "Yes. Every response is reviewed and signed by you, the CPA — NoticeReply is software, just like ProSeries or Lacerte. The CPA remains responsible for the content, exactly as if you'd typed it. We include a one-line disclaimer in the letter footer. Circular 230 doesn't change with the drafting tool.",
  },
  {
    q: 'How accurate is the notice classification and draft?',
    a: 'Classification accuracy is ~98% on the top 5 notice types in our test set (CP2000, CP14, CP504, LT11, CP501). Draft quality is "edit two sentences and sign" on the strategies the model has been trained on. Anything below 0.6 confidence triggers a CPA-review prompt automatically.',
  },
  {
    q: "What happens if the AI gets something wrong and we mail it?",
    a: "You're the gatekeeper. The draft sits in front of you on screen — you read it, edit it, sign it. Lob doesn't mail until you click Mail. We surface every dollar amount and IRC citation so you can spot-check before signing. Same liability you'd have with a paralegal-drafted letter.",
  },
  {
    q: 'How does this compare to using ChatGPT directly?',
    a: 'ChatGPT will hallucinate IRC sections, can\'t actually mail certified letters, and won\'t track replies. NoticeReply has the IRC + IRM trained into the system prompt with citation guards, the Lob certified-mail pipeline, status tracking, and a CRM that stores it all per client.',
  },
  {
    q: 'I already use HubSpot / ActiveCampaign / GHL. Why switch?',
    a: 'You don\'t have to. Use NoticeReply just for notices and keep your CRM. But every CPA we\'ve onboarded so far has dumped the other tools by week two — they\'re paying $400-700/mo for features we ship at $99. CSV import takes 10 minutes.',
  },
  {
    q: 'How does the email sender work? Will my replies actually come back to me?',
    a: 'NoticeReply sends from support@salisburybookkeeping.com by default (peer-to-peer authority — a CPA firm built it for CPA firms). On Standard and Pro you can verify your own domain and your taxpayer-client emails go from your firm. Replies hit a real Gmail inbox and thread back into your CRM activity timeline within 60 seconds.',
  },
  {
    q: 'Is the visitor tracking GDPR-compliant?',
    a: 'Yes. EU IPs are truncated, no cookies fire until consent, DNT is respected. We don\'t use Google Analytics — everything is first-party.',
  },
  {
    q: "What if I'm in the middle of tax season and can't migrate now?",
    a: "Don't migrate. Just snap your next notice into NoticeReply and see what comes back. Use the rest of the platform whenever you want. The 14-day trial timer pauses the first time you upload a notice — we want you to actually use it before paying.",
  },
  {
    q: 'How is taxpayer PII handled?',
    a: 'Encrypted at rest with Postgres pgcrypto. SSNs masked everywhere except the actual mailed letter. SOC 2 Type 1 audit in progress. We don\'t train on your data — every prompt cache is per-firm.',
  },
  {
    q: 'What if I cancel?',
    a: '30 days of read-only access — every draft, contact, workflow stays viewable. CSV export of everything. Nothing held hostage.',
  },
  {
    q: 'Are there setup fees? Long-term contracts?',
    a: 'No setup fees. Month-to-month, cancel any time. The Founding tier is the only thing time-bound — first 100 firms get $99/mo locked for life; after that it goes to $149.',
  },
  {
    q: 'Does it support all 50 states?',
    a: 'Yes for federal IRS notices. State notices (FTB, NYS DTF, etc.) ship in v2 around month 3. We can mail to any US address.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Objections, on the record</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            What CPAs ask before they trust us with a CP2000.
          </h2>
        </div>

        <Accordion.Root type="single" collapsible className="mt-12 space-y-3">
          {FAQS.map((f) => (
            <Accordion.Item
              key={f.q}
              value={f.q}
              className="rounded-xl border border-border bg-card transition-colors data-[state=open]:bg-card"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-base font-semibold">
                  <span>{f.q}</span>
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden text-pretty data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <p className="border-t border-border px-5 py-4 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
