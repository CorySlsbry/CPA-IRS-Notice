import type { Metadata } from 'next';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'The 5-Minute IRS Notice Triage Checklist',
  description:
    'One-page CPA checklist: tells you in five minutes whether an IRS notice is "drop everything" or can wait until next Tuesday.',
};

/**
 * The actual deliverable for the lead magnet. Print-optimized one-pager.
 * Visitors hit Cmd+P → Save as PDF if they want paper.
 *
 * Public route — no auth, no DB. Indexable so it can rank for
 * "irs notice triage checklist" organically.
 */
export default function ChecklistPage() {
  return (
    <div className="min-h-screen bg-cream text-ink print:bg-white">
      {/* Top bar — hidden on print */}
      <div className="border-b border-border bg-card/60 print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <a href="/" className="flex items-center gap-2 font-serif text-base">
            <span className="grid size-7 place-items-center rounded-md bg-primary font-sans text-sm font-bold text-primary-foreground">
              N
            </span>
            <span className="font-semibold">NoticeReply</span>
          </a>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
        {/* Header */}
        <header className="border-b-2 border-ink pb-4">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            From the desk of Cory @ Salisbury Bookkeeping
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] md:text-5xl">
            The 5-Minute IRS Notice Triage Checklist
          </h1>
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
            One page. Five steps. Tells you in under five minutes whether the notice on your
            desk is a <strong className="text-foreground">"drop everything"</strong> or one
            that can wait until next Tuesday.
          </p>
        </header>

        {/* Steps */}
        <ol className="mt-8 space-y-6">
          <Step
            n={1}
            title="Find the notice number (top-right corner)."
            time="15 sec"
            body={
              <>
                <p>
                  Every IRS notice has a <strong>CP, LT, or LTR number</strong> in the top-right
                  block of the front page. That number tells you what kind of notice it is —
                  and 70% of the time it's one of the five most common types below.
                </p>
                <Table
                  rows={[
                    ['CP2000', 'Math/income mismatch — IRS adjusted return', 'Calm. 30-day clock.'],
                    ['CP14', 'First balance-due notice', 'Calm. 21-day clock.'],
                    ['CP501 / 503', 'Reminder of unpaid balance', 'Calm. Compounding interest.'],
                    ['CP504', 'Intent to levy state tax refund', 'Yellow. 30-day clock to act.'],
                    ['LT11 / LT16', 'Final intent to levy', 'RED. 30-day collection due process.'],
                  ]}
                />
              </>
            }
          />

          <Step
            n={2}
            title="Read the response-by date — circle it."
            time="30 sec"
            body={
              <p>
                Found at the bottom of page 1 or in a yellow callout box. This is your
                hard deadline. <strong>Add 14 days of buffer</strong> for certified-mail
                transit + IRS scanning lag. A "respond by 05/08" notice should be mailed
                by <strong>04/24</strong>.
              </p>
            }
          />

          <Step
            n={3}
            title="Scan the IRS reasoning paragraph."
            time="60 sec"
            body={
              <>
                <p>
                  Usually one short paragraph that starts with{' '}
                  <em>"We changed your return because…"</em> Highlight three things:
                </p>
                <ul className="ml-5 mt-2 list-disc space-y-1 text-sm">
                  <li>The <strong>tax year</strong> they're adjusting</li>
                  <li>The <strong>specific line/income source</strong> they say is wrong</li>
                  <li>The <strong>dollar amount</strong> they're proposing</li>
                </ul>
                <p className="mt-2">
                  If you can't tell which line they're touching from the notice alone, set
                  the notice down — you'll need the original return open to make sense of
                  it. Don't waste time trying to remember.
                </p>
              </>
            }
          />

          <Step
            n={4}
            title="Match against your last 3 returns for that client."
            time="2 min"
            body={
              <p>
                Pull the last 3 years of filed returns from your tax software. Look for the
                same income source / deduction / credit the IRS is questioning. 80% of the
                time, the IRS missed something that's clearly on the return — like a 1099
                that was reported on Schedule D instead of Schedule B, or a prior-year credit
                they didn't carry forward. <strong>That's your disagree-with-documentation
                path.</strong>
              </p>
            }
          />

          <Step
            n={5}
            title="Pick a strategy."
            time="60 sec"
            body={
              <>
                <p>One of five paths, decided in this order:</p>
                <Table
                  rows={[
                    ['Disagree + document', "You found it on the return. Cite it. Done."],
                    ['Partial agree', 'Some of it is wrong, some is right. Itemize.'],
                    ['Agree + pay', 'Client really did miss the income. File a CP2000-Form 1040X.'],
                    ['Request abatement', 'Penalties only. First-time abatement (IRM 20.1.1.3.6.1).'],
                    ['Request installment', "Can't pay in full. Form 9465 + monthly amount."],
                  ]}
                />
              </>
            }
          />
        </ol>

        {/* Footer / pitch */}
        <footer className="mt-10 rounded-2xl border border-accent/40 bg-card p-6 print:break-inside-avoid">
          <p className="font-serif text-2xl">When you've got more than two notices a month, the math gets ugly.</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The above is what I (Cory, CPA at Salisbury Bookkeeping) walk through every time a
            client drops a notice on my desk. It works, but it takes time. Last year we replaced
            steps 1-5 with a tool — snap the notice with a phone, AI does steps 1-3 in 47 seconds,
            we do steps 4-5 in 6 minutes total.
          </p>
          <p className="mt-3 text-sm">
            That tool is <strong>NoticeReply</strong>. 14-day trial, no card.{' '}
            <a className="font-semibold underline" href="/">
              See it run on a real CP2000 →
            </a>
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Salisbury Bookkeeping · Tucson, AZ ·{' '}
            <a href="mailto:support@salisburybookkeeping.com" className="underline">
              support@salisburybookkeeping.com
            </a>
          </p>
        </footer>
      </article>

      <style>{`
        @media print {
          @page { margin: 0.5in; size: letter; }
          body { font-size: 11pt; }
        }
      `}</style>
    </div>
  );
}

function Step({ n, title, time, body }: { n: number; title: string; time: string; body: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem,1fr] gap-4 print:break-inside-avoid">
      <div>
        <div className="grid size-9 place-items-center rounded-full bg-accent text-base font-bold text-accent-foreground">
          {n}
        </div>
        <p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground">{time}</p>
      </div>
      <div className="pt-1">
        <h2 className="font-serif text-xl leading-tight md:text-2xl">{title}</h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed">{body}</div>
      </div>
    </li>
  );
}

function Table({ rows }: { rows: string[][] }) {
  return (
    <table className="mt-2 w-full text-sm">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <td className="w-[6.5rem] py-1.5 pr-3 align-top font-mono font-semibold">{row[0]}</td>
            <td className="py-1.5 pr-3 align-top">{row[1]}</td>
            <td className="py-1.5 align-top text-muted-foreground">{row[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintButton() {
  return (
    <Button
      variant="gold"
      size="sm"
      // Plain anchor + onclick via inline script wouldn't work in RSC — wrapped as client below
      asChild
    >
      <a href="javascript:window.print()">
        <Printer className="size-4" /> Print / Save as PDF
      </a>
    </Button>
  );
}
