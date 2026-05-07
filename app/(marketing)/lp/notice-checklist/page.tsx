import type { Metadata } from 'next';
import { LeadMagnetForm } from './form';

export const metadata: Metadata = {
  title: 'Free: The 5-Minute IRS Notice Triage Checklist',
  description:
    'One page. Five steps. Tells you in under five minutes whether an IRS notice on your desk is a "drop everything" or one that can wait until next Tuesday.',
  alternates: { canonical: '/lp/notice-checklist' },
  robots: { index: true, follow: true },
};

/**
 * Lead magnet landing page. Hormozi pattern: minimal page, no nav distractions,
 * one CTA. Sabrina §16 ManyChat hook — drives from short-form video comments
 * ("Comment NOTICE for the checklist") into here.
 */
export default function NoticeChecklistLp() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2 font-serif text-base">
            <span className="grid size-7 place-items-center rounded-md bg-primary font-sans text-sm font-bold text-primary-foreground">
              N
            </span>
            <span className="font-semibold">NoticeReply</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          Free · No credit card · Sent in 30 seconds
        </p>
        <h1 className="mt-3 font-serif text-balance text-4xl leading-[1.05] md:text-6xl">
          The 5-Minute IRS Notice Triage Checklist.
        </h1>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
          Tells you in under 5 minutes whether the notice on your desk is{' '}
          <strong className="text-foreground">"drop everything"</strong> or one that can
          wait until next Tuesday. One page. Print it, pin it, stop guessing.
        </p>

        <ul className="mt-7 space-y-2.5 text-sm">
          <Bullet>
            The <strong>5 most common notice types</strong> CPAs see — what each one
            actually means
          </Bullet>
          <Bullet>
            The <strong>real deadlines</strong> (with 14-day certified-mail buffer math
            already done)
          </Bullet>
          <Bullet>
            How to spot <strong>"the IRS missed something on the return"</strong> in 2
            minutes flat
          </Bullet>
          <Bullet>
            The <strong>5 strategies</strong> in priority order — pick one and start
            drafting
          </Bullet>
        </ul>

        <div className="mt-10">
          <LeadMagnetForm />
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-sm">
          <p className="font-serif text-lg">Who is this from?</p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Cory Salisbury — small CPA shop in Tucson (Salisbury Bookkeeping). I built
            NoticeReply because I got tired of drafting the same five notice responses
            thirty times a quarter. The checklist is the manual version I used before
            the tool existed — still useful even if you don't try the trial.
          </p>
        </div>
      </main>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Salisbury Bookkeeping · Tucson, AZ ·{' '}
          <a href="mailto:support@salisburybookkeeping.com" className="underline">
            support@salisburybookkeeping.com
          </a>
          <span className="mx-2">·</span>
          <a href="/legal/privacy" className="underline">
            Privacy
          </a>
        </div>
      </footer>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}
