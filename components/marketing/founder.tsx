'use client';

export function FounderStory() {
  return (
    <section className="bg-card/50 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 md:grid-cols-[auto,1fr] md:gap-16 lg:px-8">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="mx-auto grid size-32 place-items-center rounded-full bg-primary text-3xl font-serif text-primary-foreground md:size-40 md:text-5xl">
            CS
          </div>
          <p className="mt-4 text-center text-sm font-semibold">Cory Salisbury</p>
          <p className="text-center text-xs text-muted-foreground">Salisbury Bookkeeping · Tucson, AZ</p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">The story</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl">
            I run Salisbury Bookkeeping. I built this because I was sick of drafting the same CP2000 response 30 times a quarter.
          </h2>
          <div className="mt-6 space-y-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            <p>Real talk — I'm not a SaaS founder. I'm a CPA who runs a small shop in Tucson with my wife. Most of my work is bookkeeping and small-business returns. The notice grind was killing margins.</p>
            <p>Last year I started feeding the IRS notices into Claude with the IRC citations cached. The drafts were good. Like, "edit two sentences and sign" good. So I wired up Lob to mail certified, slapped a CRM on it because I needed one anyway, and started using it on my own clients.</p>
            <p>$14,623.42 CP2000 in 6 minutes instead of 90. Same fee. Same outcome. The math worked.</p>
            <p>Now I'm letting other small CPA shops use it at a price that makes sense. $99/mo locked for the first 100 firms. If you're spending more than 30 minutes on the average notice, you'll feel this on day one.</p>
            <p className="font-medium text-foreground">— Cory</p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <a href="https://salisburybookkeeping.com" className="rounded-full border border-border bg-card px-4 py-2 transition-colors hover:bg-secondary">
              Salisbury Bookkeeping →
            </a>
            <a href="mailto:support@salisburybookkeeping.com" className="rounded-full border border-border bg-card px-4 py-2 transition-colors hover:bg-secondary">
              Reply to any email — I read them all
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
