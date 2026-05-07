import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const metadata = { title: 'Pipelines' };

export default async function PipelinesPage() {
  const sb = await createSupabaseServerClient();
  const { data: pipelines } = await sb.from('pipelines').select('id, name, stages, is_default');
  const { data: deals } = await sb.from('deals').select('id, name, pipeline_id, stage, value_cents, status, contact_id').limit(200);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="font-serif text-3xl">Pipelines</h1>
      <p className="text-sm text-muted-foreground">Drag deals across stages. Auto-create from workflows.</p>

      {(pipelines ?? []).map((p) => {
        const stages = (p.stages as { id: string; name: string; color: string }[]) ?? [];
        const dealsByStage = new Map<string, typeof deals>();
        for (const d of deals ?? []) {
          if (d.pipeline_id !== p.id) continue;
          const arr = dealsByStage.get(d.stage as string) ?? [];
          arr.push(d);
          dealsByStage.set(d.stage as string, arr);
        }
        return (
          <Card key={p.id} className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="flex gap-3 min-w-max">
                {stages.map((s) => (
                  <div key={s.id} className="w-72 shrink-0 rounded-lg border border-border bg-secondary/30 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{s.name}</p>
                      <span className="text-xs text-muted-foreground">{(dealsByStage.get(s.id) ?? []).length}</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {(dealsByStage.get(s.id) ?? []).map((d) => (
                        <Link
                          key={d.id}
                          href={d.contact_id ? `/contacts/${d.contact_id}` : '#'}
                          className="block rounded-md border border-border bg-card p-3 text-sm shadow-sm transition-colors hover:border-accent"
                        >
                          <p className="font-medium">{d.name}</p>
                          {d.value_cents != null && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              ${(((d.value_cents as number) ?? 0) / 100).toLocaleString()}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {(pipelines ?? []).length === 0 && (
        <Card className="mt-6">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No pipelines configured. The default "Notice clients" pipeline is created on signup.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
