import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Forms' };

export default async function FormsPage() {
  const sb = await createSupabaseServerClient();
  const { data: forms } = await sb
    .from('forms')
    .select('id, name, schema_json, on_submit_workflow_id, archived_at, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Forms</h1>
          <p className="text-sm text-muted-foreground">Embeddable forms that auto-create contacts and trigger workflows.</p>
        </div>
        <Button asChild variant="gold">
          <Link href="/forms/new">+ New form</Link>
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">All forms</CardTitle>
        </CardHeader>
        <CardContent>
          {(forms ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center">
              <p className="font-serif text-2xl">No forms yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Build a form, drop the embed snippet on your site, watch the contacts roll in.</p>
              <Button asChild variant="gold" className="mt-4">
                <Link href="/forms/new">Build your first form</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {forms?.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      <Link href={`/forms/${f.id}`} className="hover:underline">
                        {f.name}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Array.isArray((f.schema_json as { fields?: unknown[] })?.fields) ? (f.schema_json as { fields: unknown[] }).fields.length : 0} fields
                      {f.on_submit_workflow_id ? ' · triggers workflow' : ' · no workflow'}
                    </p>
                  </div>
                  <Badge variant={f.archived_at ? 'secondary' : 'green'}>{f.archived_at ? 'archived' : 'live'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
