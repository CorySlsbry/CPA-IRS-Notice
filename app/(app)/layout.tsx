import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Activity, FileText, Inbox, LayoutDashboard, Mail, Network, Settings, Tag, Users, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoutButton } from './logout-button';

// The (app) route group is auth-gated and reads from the DB on every render.
// Force dynamic so Next.js doesn't try to statically prerender at build time
// (DATABASE_URL is intentionally absent during build).
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await sb
    .from('firm_users')
    .select('firm_id, role, firms(name, plan, trial_ends_at)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const firm = (membership?.firms as { name?: string; plan?: string; trial_ends_at?: string } | null) ?? null;

  return (
    <div className="grid min-h-screen grid-cols-[16rem_1fr] bg-background">
      <aside className="border-r border-border bg-card/50 px-4 py-5">
        <Link href="/dashboard" className="flex items-center gap-2 font-serif text-lg">
          <span className="grid size-8 place-items-center rounded-md bg-primary font-sans text-base font-bold text-primary-foreground">
            N
          </span>
          <span className="font-semibold">NoticeReply</span>
        </Link>

        <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs">
          <p className="font-medium">{firm?.name ?? '—'}</p>
          <p className="mt-0.5 text-muted-foreground">
            {firm?.plan ?? 'founding'} ·{' '}
            {firm?.trial_ends_at && new Date(firm.trial_ends_at).getTime() > Date.now()
              ? `${Math.ceil((new Date(firm.trial_ends_at).getTime() - Date.now()) / 86_400_000)}d left in trial`
              : 'active'}
          </p>
        </div>

        <nav className="mt-5 space-y-0.5 text-sm">
          <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem href="/notices" icon={FileText} label="Notices" />
          <NavSection label="CRM" />
          <NavItem href="/contacts" icon={Users} label="Contacts" />
          <NavItem href="/pipelines" icon={Network} label="Pipelines" />
          <NavItem href="/tags" icon={Tag} label="Tags + segments" />
          <NavSection label="Marketing" />
          <NavItem href="/campaigns" icon={Mail} label="Campaigns" />
          <NavItem href="/workflows" icon={Workflow} label="Workflows" />
          <NavItem href="/forms" icon={Inbox} label="Forms" />
          <NavSection label="Analytics" />
          <NavItem href="/analytics" icon={Activity} label="Analytics" />
          <NavSection label="Account" />
          <NavItem href="/settings" icon={Settings} label="Settings" />
        </nav>

        <div className="mt-8 border-t border-border pt-4 text-xs">
          <p className="text-muted-foreground">Signed in as</p>
          <p className="truncate font-medium">{user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="overflow-x-hidden">{children}</main>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-foreground/80',
        'transition-colors hover:bg-secondary hover:text-foreground',
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  );
}

function NavSection({ label }: { label: string }) {
  return <p className="mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>;
}
