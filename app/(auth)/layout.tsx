import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl">
            <span className="grid size-8 place-items-center rounded-md bg-primary font-sans text-base font-bold text-primary-foreground">N</span>
            <span className="font-semibold">NoticeReply</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to site
          </Link>
        </div>
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
