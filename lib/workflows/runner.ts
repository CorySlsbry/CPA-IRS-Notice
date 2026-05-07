import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/sender';
import { graphSchema, type WorkflowGraph, type WorkflowEdge, type ActionSpec } from './types';

const MAX_STEPS_PER_TICK = 25;

export type RunResult = {
  runsAdvanced: number;
  runsCompleted: number;
  runsFailed: number;
  durationMs: number;
};

/**
 * Pull all workflow_runs whose next_run_at <= now() and advance each
 * one step. Idempotent — workflow_step_logs gives us the audit trail.
 */
export async function tickWorkflows(opts?: { limit?: number }): Promise<RunResult> {
  const start = Date.now();
  const limit = opts?.limit ?? 200;
  const supabase = getSupabaseAdmin();

  const { data: dueRuns, error } = await supabase
    .from('workflow_runs')
    .select('id, firm_id, workflow_id, contact_id, current_node_id, context, status')
    .in('status', ['running', 'waiting'])
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`tickWorkflows query failed: ${error.message}`);

  let runsAdvanced = 0;
  let runsCompleted = 0;
  let runsFailed = 0;

  for (const run of dueRuns ?? []) {
    try {
      const result = await advanceRun(run.id);
      runsAdvanced += 1;
      if (result.completed) runsCompleted += 1;
    } catch (err) {
      runsFailed += 1;
      console.error('[workflow.runner] failed', run.id, err);
      await supabase
        .from('workflow_runs')
        .update({
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id);
    }
  }

  return { runsAdvanced, runsCompleted, runsFailed, durationMs: Date.now() - start };
}

type AdvanceResult = { completed: boolean };

export async function advanceRun(runId: string): Promise<AdvanceResult> {
  const supabase = getSupabaseAdmin();
  const { data: run, error } = await supabase
    .from('workflow_runs')
    .select('id, firm_id, workflow_id, contact_id, current_node_id, context, status')
    .eq('id', runId)
    .single();
  if (error || !run) throw new Error(`run ${runId} not found`);
  if (run.status === 'completed' || run.status === 'failed' || run.status === 'exited') {
    return { completed: true };
  }

  const { data: workflow } = await supabase
    .from('workflows')
    .select('graph_json, status')
    .eq('id', run.workflow_id)
    .single();
  if (!workflow) throw new Error('workflow not found');
  if (workflow.status !== 'active') {
    await supabase.from('workflow_runs').update({ status: 'exited', completed_at: new Date().toISOString() }).eq('id', runId);
    return { completed: true };
  }

  const graph = graphSchema.parse(workflow.graph_json);

  // Execute up to MAX_STEPS_PER_TICK back-to-back nodes. Wait nodes break out.
  let currentNodeId = run.current_node_id ?? findStartNode(graph);
  let context = (run.context as Record<string, unknown>) ?? {};

  for (let i = 0; i < MAX_STEPS_PER_TICK; i++) {
    const node = graph.nodes.find((n) => n.id === currentNodeId);
    if (!node) {
      await supabase.from('workflow_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId);
      return { completed: true };
    }

    if (node.type === 'end') {
      await supabase.from('workflow_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId);
      return { completed: true };
    }

    if (node.type === 'trigger') {
      // Trigger node is the start anchor — advance to its first outgoing edge.
      const next = graph.edges.find((e) => e.source === node.id);
      if (!next) {
        await supabase.from('workflow_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId);
        return { completed: true };
      }
      currentNodeId = next.target;
      continue;
    }

    // Action node.
    const actionResult = await executeAction(
      run.firm_id,
      run.contact_id,
      run.id,
      node.id,
      node.data as ActionSpec,
      context,
    );

    await supabase.from('workflow_step_logs').insert({
      firm_id: run.firm_id,
      workflow_run_id: run.id,
      node_id: node.id,
      action: (node.data as { action?: string }).action ?? 'unknown',
      result: actionResult,
    });

    if (actionResult.kind === 'wait') {
      await supabase
        .from('workflow_runs')
        .update({
          status: 'waiting',
          current_node_id: node.id,
          next_run_at: actionResult.until,
          context,
        })
        .eq('id', runId);
      return { completed: false };
    }

    if (actionResult.kind === 'wait_processed' || actionResult.kind === 'done') {
      const next = pickNextEdge(graph, node.id, actionResult.branch);
      if (!next) {
        await supabase.from('workflow_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId);
        return { completed: true };
      }
      currentNodeId = next.target;
      context = { ...context, [`node_${node.id}_result`]: actionResult.value ?? null };
      continue;
    }

    if (actionResult.kind === 'exit') {
      await supabase
        .from('workflow_runs')
        .update({ status: 'exited', completed_at: new Date().toISOString() })
        .eq('id', runId);
      return { completed: true };
    }
  }

  // Hit step ceiling — defer 1 minute and re-tick.
  await supabase
    .from('workflow_runs')
    .update({
      current_node_id: currentNodeId,
      context,
      next_run_at: new Date(Date.now() + 60_000).toISOString(),
      status: 'running',
    })
    .eq('id', runId);
  return { completed: false };
}

function findStartNode(graph: WorkflowGraph): string {
  const trigger = graph.nodes.find((n) => n.type === 'trigger');
  return trigger?.id ?? graph.nodes[0]?.id ?? 'start';
}

function pickNextEdge(graph: WorkflowGraph, nodeId: string, branch?: string): WorkflowEdge | null {
  const outgoing = graph.edges.filter((e) => e.source === nodeId);
  if (outgoing.length === 0) return null;
  if (branch) {
    const matching = outgoing.find((e) => e.branch === branch);
    if (matching) return matching;
  }
  return outgoing.find((e) => !e.branch) ?? outgoing[0] ?? null;
}

type ActionOutcome =
  | { kind: 'done'; branch?: string; value?: unknown }
  | { kind: 'wait'; until: string }
  | { kind: 'wait_processed'; branch?: string; value?: unknown }
  | { kind: 'exit' };

async function executeAction(
  firmId: string,
  contactId: string,
  runId: string,
  _nodeId: string,
  spec: ActionSpec,
  context: Record<string, unknown>,
): Promise<ActionOutcome> {
  const supabase = getSupabaseAdmin();

  switch (spec.action) {
    case 'send_email': {
      const { data: contact } = await supabase
        .from('contacts')
        .select('email, first_name, last_name, custom_fields')
        .eq('id', contactId)
        .single();
      if (!contact?.email) return { kind: 'done', value: { skipped: 'no_email' } };
      const result = await sendEmail({
        firmId,
        contactId,
        to: contact.email as string,
        category: 'workflow_personal',
        subject: spec.subject,
        template: spec.template,
        fromName: spec.fromName,
        workflowRunId: runId,
        props: contact as Record<string, unknown>,
      });
      return { kind: 'done', value: result };
    }

    case 'add_tag': {
      const { data: tag } = await supabase
        .from('tags')
        .upsert({ firm_id: firmId, name: spec.tag }, { onConflict: 'firm_id,name' })
        .select('id')
        .single();
      if (tag) {
        await supabase
          .from('contact_tags')
          .upsert({ contact_id: contactId, tag_id: tag.id, firm_id: firmId }, { onConflict: 'contact_id,tag_id' });
        await supabase.from('activities').insert({
          firm_id: firmId,
          contact_id: contactId,
          type: 'tag_added',
          payload: { tag: spec.tag },
        });
      }
      return { kind: 'done' };
    }

    case 'remove_tag': {
      const { data: tag } = await supabase
        .from('tags')
        .select('id')
        .eq('firm_id', firmId)
        .eq('name', spec.tag)
        .maybeSingle();
      if (tag) {
        await supabase.from('contact_tags').delete().eq('contact_id', contactId).eq('tag_id', tag.id);
        await supabase.from('activities').insert({
          firm_id: firmId,
          contact_id: contactId,
          type: 'tag_removed',
          payload: { tag: spec.tag },
        });
      }
      return { kind: 'done' };
    }

    case 'set_field': {
      const update: Record<string, unknown> = {};
      if (['email', 'first_name', 'last_name', 'job_title', 'lead_score', 'lifecycle_stage'].includes(spec.field)) {
        update[spec.field] = spec.value;
      } else {
        const { data: existing } = await supabase
          .from('contacts')
          .select('custom_fields')
          .eq('id', contactId)
          .single();
        update.custom_fields = { ...((existing?.custom_fields as object) ?? {}), [spec.field]: spec.value };
      }
      await supabase.from('contacts').update(update).eq('id', contactId);
      return { kind: 'done' };
    }

    case 'wait': {
      const ms =
        spec.unit === 'minutes' ? spec.amount * 60_000 : spec.unit === 'hours' ? spec.amount * 3_600_000 : spec.amount * 86_400_000;
      let until = new Date(Date.now() + ms);
      if (spec.untilTimeOfDay) {
        const [h, m] = spec.untilTimeOfDay.split(':').map(Number);
        until.setHours(h ?? 9, m ?? 0, 0, 0);
        if (until.getTime() < Date.now()) until = new Date(until.getTime() + 86_400_000);
      }
      return { kind: 'wait', until: until.toISOString() };
    }

    case 'branch': {
      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();
      const ok = evaluateCondition(contact, spec.condition);
      return { kind: 'done', branch: ok ? 'yes' : 'no', value: { branch: ok ? 'yes' : 'no' } };
    }

    case 'webhook': {
      const r = await fetch(spec.url, {
        method: spec.method ?? 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contactId, context, ...spec.body }),
      });
      return { kind: 'done', value: { status: r.status } };
    }

    case 'create_task': {
      const dueAt = spec.dueInDays != null ? new Date(Date.now() + spec.dueInDays * 86_400_000).toISOString() : null;
      await supabase.from('tasks').insert({ firm_id: firmId, contact_id: contactId, title: spec.title, due_at: dueAt });
      return { kind: 'done' };
    }

    case 'move_deal_stage': {
      await supabase
        .from('deals')
        .update({ stage: spec.stage })
        .eq('firm_id', firmId)
        .eq('contact_id', contactId)
        .eq('pipeline_id', spec.pipelineId);
      return { kind: 'done' };
    }

    case 'ai_step': {
      // Hand off to the AI step handler — implemented in lib/workflows/ai-step.ts
      const { runAiStep } = await import('./ai-step');
      const value = await runAiStep({ firmId, contactId, prompt: spec.prompt, expectedOutputShape: spec.expectedOutputShape, context });
      return { kind: 'done', value };
    }

    case 'post_to_social': {
      // Queue a social post (immediate or delayed). The post-runner cron picks it up.
      let scheduledAt = new Date();
      if (spec.delay) {
        const ms =
          spec.delay.unit === 'minutes'
            ? spec.delay.amount * 60_000
            : spec.delay.unit === 'hours'
              ? spec.delay.amount * 3_600_000
              : spec.delay.amount * 86_400_000;
        scheduledAt = new Date(Date.now() + ms);
      }
      const { data: account } = await supabase
        .from('social_accounts')
        .select('id, platform, status')
        .eq('id', spec.accountId)
        .eq('firm_id', firmId)
        .maybeSingle();
      if (!account) {
        return { kind: 'done', value: { skipped: 'account_not_found' } };
      }
      const { data: post } = await supabase
        .from('social_posts')
        .insert({
          firm_id: firmId,
          account_id: account.id,
          platform: account.platform,
          body: spec.body,
          media_urls: spec.mediaUrls ?? null,
          link_url: spec.linkUrl ?? null,
          scheduled_at: scheduledAt.toISOString(),
          status: 'scheduled',
          workflow_run_id: runId,
        })
        .select('id')
        .single();
      return { kind: 'done', value: { post_id: post?.id, scheduled_at: scheduledAt.toISOString() } };
    }

    case 'end':
      return { kind: 'exit' };
  }
}

function evaluateCondition(
  contact: Record<string, unknown> | null,
  cond: { field: string; operator: string; value?: unknown },
): boolean {
  if (!contact) return false;
  const left = (contact as Record<string, unknown>)[cond.field];
  switch (cond.operator) {
    case 'is':
      return left === cond.value;
    case 'is_not':
      return left !== cond.value;
    case 'gt':
      return typeof left === 'number' && typeof cond.value === 'number' && left > cond.value;
    case 'lt':
      return typeof left === 'number' && typeof cond.value === 'number' && left < cond.value;
    case 'is_set':
      return left != null && left !== '';
    case 'is_empty':
      return left == null || left === '';
    default:
      return false;
  }
}
