import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Segments' };

export default async function SegmentsPage() {
  const sb = await createSupabaseServerClient();
  const { data: segments } = await sb
    .from('segments')
    .select('id, name, description, contact_count, contact_count_refreshed_at, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Segments</h1>
          <p className="text-sm text-muted-foreground">Saved filters that compile to live SQL — re-evaluated on every campaign or workflow tick.</p>
        </div>
        <Button asChild variant="gold">
          <Link href="/segments/new">+ New segment</Link>
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">All segments</CardTitle>
        </CardHeader>
        <CardContent>
          {(segments ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No segments yet. Try "trial-active contacts who opened day-2 email but didn't click" — that kind of slice.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {segments?.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{s.contact_count ?? 0} contacts</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
