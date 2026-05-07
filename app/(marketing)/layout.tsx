import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl tracking-tight">
            <span className="grid size-8 place-items-center rounded-md bg-primary font-sans text-base font-bold text-primary-foreground">
              N
            </span>
            <span className="font-semibold">NoticeReply</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link href="/#how" className="text-muted-foreground hover:text-foreground">How it works</Link>
            <Link href="/#crm" className="text-muted-foreground hover:text-foreground">CRM</Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="/cpa" className="text-muted-foreground hover:text-foreground">For CPA firms</Link>
            <Link href="/#faq" className="text-muted-foreground hover:text-foreground">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild variant="gold" size="sm">
              <Link href="/signup">Start free trial</Link>
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t border-border bg-card/40 py-12">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          <div>
            <div className="flex items-center gap-2 font-serif text-lg">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">N</span>
              <span className="font-semibold">NoticeReply</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground text-pretty">
              IRS notice responses, drafted by AI and signed by you. Plus a CRM that actually fits a CPA practice.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Built by{' '}
              <a href="https://salisburybookkeeping.com" className="underline">
                Salisbury Bookkeeping
              </a>{' '}
              · Tucson, AZ
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/#how" className="hover:text-foreground">How it works</Link></li>
              <li><Link href="/#crm" className="hover:text-foreground">Built-in CRM</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/#faq" className="hover:text-foreground">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">For CPAs</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/cpa" className="hover:text-foreground">Why CPAs love it</Link></li>
              <li><Link href="/cpa#liability" className="hover:text-foreground">Liability + IRS rules</Link></li>
              <li><Link href="/cpa#whitelabel" className="hover:text-foreground">White-label</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/legal/terms" className="hover:text-foreground">Terms</Link></li>
              <li><Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link href="/legal/dpa" className="hover:text-foreground">DPA</Link></li>
              <li><a href="mailto:support@salisburybookkeeping.com" className="hover:text-foreground">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-border pt-6 px-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          © {new Date().getFullYear()} NoticeReply / Salisbury Bookkeeping. NoticeReply is software — your CPA signs and is responsible for the response.
        </div>
      </footer>
    </div>
  );
}
