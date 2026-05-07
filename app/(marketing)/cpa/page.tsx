import type { Metadata } from 'next';
import { FinalCta } from '@/components/marketing/final-cta';

export const metadata: Metadata = {
  title: 'For CPA firms — Liability, white-label, integration',
  description:
    'Built by a CPA, for CPAs. Liability sits with you (as it always has). Per-firm white-label on Pro. Integrations that match how a tax practice actually runs.',
  alternates: { canonical: '/cpa' },
};

export default function CpaPage() {
  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">For CPA firms</p>
        <h1 className="mt-2 font-serif text-balance text-4xl md:text-6xl">
          Built by a CPA. Designed around how your firm actually runs.
        </h1>
        <p className="mt-6 text-pretty text-xl leading-relaxed text-muted-foreground">
          We've spent zero hours optimizing for SaaS investors and a thousand hours optimizing for the partner who's drafting their fifteenth CP2000 of the week.
        </p>

        <Section id="liability" title="Liability + IRS rules">
          <p>NoticeReply is software. The CPA reviews and signs every response. Same liability profile as ProSeries, Lacerte, or any tax-prep tool — Circular 230 rules apply to you, the practitioner, not the tool.</p>
          <p>Every response includes a one-line footer disclosure: <em>"This letter was drafted with the assistance of NoticeReply software and reviewed and signed by the undersigned CPA, who is solely responsible for its content."</em> You can edit or remove this in firm settings — your call.</p>
        </Section>

        <Section id="whitelabel" title="White-label (Pro tier)">
          <p>Mailed letters: your firm logo, your signer, your address as the return. The "powered by" line is optional — toggle it off in settings.</p>
          <p>Taxpayer-client emails (notice received, response mailed, delivery confirmed) come from your verified firm domain on Pro. NoticeReply's transactional + marketing emails to you continue from <code className="rounded bg-secondary px-1">support@salisburybookkeeping.com</code> — that's the relationship.</p>
        </Section>

        <Section title="What we don't do">
          <p>We don't draft Tax Court petitions. We don't represent your client at appeals. We don't replace your tax software, and we won't pretend to. NoticeReply does one thing — turn IRS notices into client-ready, mailed responses — and surrounds it with a CRM that fits.</p>
        </Section>

        <Section title="Integrations that respect your stack">
          <p>Public REST API + outbound webhooks for everything. Zapier and Make work out of the box. CSV import for contact migration. Exports of every record at any time.</p>
          <p>What we don't do: scrape your tax software. We don't have access to ProSeries or Drake — you copy/paste the relevant return data into the draft prompt during review. That's intentional: the IRS-mandated review step is yours alone.</p>
        </Section>

        <Section title="Onboarding: ten minutes, not ten hours">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Sign up. Trial starts. No card.</li>
            <li>Snap one notice you've already responded to. Compare drafts.</li>
            <li>Import contacts (CSV). Save your first segment.</li>
            <li>Embed the tracking script (one line).</li>
            <li>Build a workflow — or fork one of the three pre-loaded starters.</li>
          </ol>
          <p className="mt-2">Most firms hit step 5 by Friday of week one.</p>
        </Section>
      </article>
      <FinalCta />
    </>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 border-t border-border pt-8">
      <h2 className="font-serif text-2xl md:text-3xl">{title}</h2>
      <div className="mt-3 space-y-3 text-pretty text-base leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
