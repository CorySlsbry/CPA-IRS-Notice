import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { WorkflowEditor } from './workflow-editor';

export const metadata = { title: 'Workflow' };

export default async function WorkflowDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: workflow } = await sb
    .from('workflows')
    .select('id, firm_id, name, description, archetype, status, trigger_json, graph_json')
    .eq('id', id)
    .maybeSingle();
  if (!workflow) notFound();

  const { data: runs } = await sb
    .from('workflow_runs')
    .select('id, status, contact_id, started_at, completed_at, current_node_id')
    .eq('workflow_id', id)
    .order('started_at', { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/workflows">
          <ArrowLeft className="size-4" /> All workflows
        </Link>
      </Button>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">{workflow.name}</h1>
          <p className="text-sm text-muted-foreground">{workflow.description}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{workflow.archetype}</Badge>
          <Badge variant={workflow.status === 'active' ? 'green' : 'secondary'}>{workflow.status}</Badge>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,16rem]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Workflow graph</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <WorkflowEditor workflowId={workflow.id} graphJson={workflow.graph_json} triggerJson={workflow.trigger_json} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent runs</CardTitle>
          </CardHeader>
          <CardContent>
            {(runs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              <ul className="space-y-2">
                {runs?.map((r) => (
                  <li key={r.id} className="flex items-start justify-between text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{r.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">node: {r.current_node_id ?? '—'}</p>
                    </div>
                    <Badge variant={r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : 'amber'}>
                      {r.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
