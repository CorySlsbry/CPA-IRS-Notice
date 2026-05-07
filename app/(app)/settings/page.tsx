import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, CreditCard, Globe, Key, Mail, Users } from 'lucide-react';

export const metadata = { title: 'Settings' };

const SECTIONS = [
  { href: '/settings/email', icon: Mail, name: 'Email + sending domain', body: 'Verify your domain, see warmup status, manage suppression list.' },
  { href: '/settings/domain', icon: Globe, name: 'Custom domain', body: 'Map your firm domain to your CRM forms + tracking.' },
  { href: '/settings/billing', icon: CreditCard, name: 'Billing', body: 'Plan, payment method, invoice history, cancel anytime.' },
  { href: '/settings/api', icon: Key, name: 'API + webhooks', body: 'Create API keys, configure outbound webhooks.' },
  { href: '/settings/team', icon: Users, name: 'Team', body: 'Invite users, manage roles, audit log.' },
];

export default function SettingsHomePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-serif text-3xl">Settings</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardHeader className="flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-accent/10">
                    <s.icon className="size-5 text-accent" />
                  </div>
                  <CardTitle className="text-lg">{s.name}</CardTitle>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
