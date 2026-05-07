import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Tags + segments' };

export default async function TagsPage() {
  const sb = await createSupabaseServerClient();
  const [{ data: tags }, { data: segments }] = await Promise.all([
    sb.from('tags').select('id, name, color, description').order('name'),
    sb.from('segments').select('id, name, description, contact_count').order('updated_at', { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-serif text-3xl">Tags + segments</h1>
      <p className="text-sm text-muted-foreground">Tags are flat labels. Segments are saved filters that compile to live SQL.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Tags</CardTitle>
            <Button variant="gold" size="sm">+ New tag</Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(tags ?? []).map((t) => (
                <Badge key={t.id} style={{ backgroundColor: `${t.color}33`, color: t.color }} className="text-sm">
                  {t.name}
                </Badge>
              ))}
            </div>
            {(tags ?? []).length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Segments</CardTitle>
            <Button variant="gold" size="sm" asChild><Link href="/segments">+ New segment</Link></Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {(segments ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{s.contact_count ?? 0} contacts</span>
                </li>
              ))}
            </ul>
            {(segments ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No segments yet. Save your first filter to come back to it.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
