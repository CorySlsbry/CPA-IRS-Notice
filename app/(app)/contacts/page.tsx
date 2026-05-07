import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/utils';

export const metadata = { title: 'Contacts' };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lifecycle?: string }>;
}) {
  const params = await searchParams;
  const sb = await createSupabaseServerClient();
  let query = sb
    .from('contacts')
    .select('id, email, first_name, last_name, lifecycle_stage, lead_score, source, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (params.q) {
    query = query.or(`email.ilike.%${params.q}%,first_name.ilike.%${params.q}%,last_name.ilike.%${params.q}%`);
  }
  if (params.lifecycle) {
    query = query.eq('lifecycle_stage', params.lifecycle);
  }
  const { data: contacts } = await query;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Contacts</h1>
          <p className="text-sm text-muted-foreground">Your taxpayer clients, prospects, and everyone in between.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/contacts/import">Import CSV</Link>
          </Button>
          <Button asChild variant="gold">
            <Link href="/contacts/new">+ New contact</Link>
          </Button>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap gap-2" action="/contacts">
        <input
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search name or email…"
          className="h-10 flex-1 rounded-md border border-border bg-background px-4 text-sm"
        />
        <select
          name="lifecycle"
          defaultValue={params.lifecycle ?? ''}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All lifecycles</option>
          {['subscriber', 'lead', 'mql', 'sql', 'customer', 'evangelist', 'churned'].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <Button type="submit" variant="default">
          Filter
        </Button>
      </form>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">{(contacts ?? []).length} contacts</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-2.5">Name</th>
                <th className="px-6 py-2.5">Email</th>
                <th className="px-6 py-2.5">Lifecycle</th>
                <th className="px-6 py-2.5">Score</th>
                <th className="px-6 py-2.5">Source</th>
                <th className="px-6 py-2.5">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(contacts ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-secondary/40">
                  <td className="px-6 py-3 font-medium">
                    <Link href={`/contacts/${c.id}`} className="hover:underline">
                      {c.first_name ?? ''} {c.last_name ?? ''}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-6 py-3">
                    <Badge variant="outline">{c.lifecycle_stage}</Badge>
                  </td>
                  <td className="px-6 py-3 font-mono">{c.lead_score}</td>
                  <td className="px-6 py-3 text-muted-foreground">{c.source ?? '—'}</td>
                  <td className="px-6 py-3 text-muted-foreground">{formatRelative(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
