import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRelative, formatCurrency } from '@/lib/utils';

export const metadata = { title: 'Notices' };

export default async function NoticesPage() {
  const sb = await createSupabaseServerClient();
  const { data: notices } = await sb
    .from('notices')
    .select('id, notice_type, status, uploaded_at, amount_owed_cents, tax_year, irs_reasoning')
    .order('uploaded_at', { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Notices</h1>
          <p className="text-sm text-muted-foreground">Every IRS notice you've uploaded, in one place.</p>
        </div>
        <Button asChild variant="gold" size="lg">
          <Link href="/notices/new">+ New notice</Link>
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">All notices</CardTitle>
        </CardHeader>
        <CardContent>
          {(notices ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-10 text-center">
              <p className="font-serif text-2xl">No notices yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Snap one and we'll have a draft back in under a minute.</p>
              <Button asChild variant="gold" className="mt-5">
                <Link href="/notices/new">Upload your first notice</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Year</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Reasoning</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Uploaded</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {notices?.map((n) => (
                    <tr key={n.id} className="hover:bg-secondary/40">
                      <td className="py-3 font-mono">{n.notice_type ?? '—'}</td>
                      <td className="py-3">{n.tax_year ?? '—'}</td>
                      <td className="py-3">{n.amount_owed_cents != null ? formatCurrency(n.amount_owed_cents as number) : '—'}</td>
                      <td className="py-3 max-w-md truncate text-muted-foreground">{n.irs_reasoning ?? '—'}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            n.status === 'mailed' || n.status === 'resolved'
                              ? 'green'
                              : n.status === 'classified' || n.status === 'drafted'
                                ? 'amber'
                                : 'secondary'
                          }
                        >
                          {n.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{formatRelative(n.uploaded_at)}</td>
                      <td className="py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/notices/${n.id}`}>Open →</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
