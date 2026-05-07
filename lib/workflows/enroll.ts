import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { WorkflowTrigger } from './types';

/**
 * Find every active workflow whose trigger matches this event and start
 * a workflow_run for the contact (idempotent: one run per workflow x
 * contact at a time).
 */
export async function enrollContact(args: {
  firmId: string;
  contactId: string;
  trigger:
    | { type: 'tag_added'; tag: string }
    | { type: 'tag_removed'; tag: string }
    | { type: 'form_submit'; formId?: string }
    | { type: 'page_visited'; path: string }
    | { type: 'email_replied' }
    | { type: 'notice_uploaded' }
    | { type: 'manual'; workflowId: string }
    | { type: 'custom_event'; name: string };
}): Promise<{ enrolled: number }> {
  const supabase = getSupabaseAdmin();

  const matchClause =
    args.trigger.type === 'manual' ? { id: args.trigger.workflowId } : { firm_id: args.firmId, status: 'active' as const };

  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, trigger_json')
    .match(matchClause);

  if (!workflows) return { enrolled: 0 };

  const matched = workflows.filter((w) => triggerMatches(w.trigger_json as WorkflowTrigger, args.trigger));
  let enrolled = 0;

  for (const w of matched) {
    const { error } = await supabase.from('workflow_runs').insert({
      firm_id: args.firmId,
      workflow_id: w.id,
      contact_id: args.contactId,
      status: 'running',
      next_run_at: new Date().toISOString(),
      context: { trigger: args.trigger },
    });
    if (!error) {
      enrolled += 1;
      await supabase.from('activities').insert({
        firm_id: args.firmId,
        contact_id: args.contactId,
        type: 'workflow_enrolled',
        payload: { workflow_id: w.id, trigger: args.trigger },
      });
    }
    // Unique index swallows duplicates silently — that's fine.
  }

  return { enrolled };
}

function triggerMatches(stored: WorkflowTrigger, incoming: { type: string; [k: string]: unknown }): boolean {
  if (stored.type !== incoming.type) return false;
  if (stored.type === 'tag_added' && incoming.type === 'tag_added') return stored.tag === incoming.tag;
  if (stored.type === 'tag_removed' && incoming.type === 'tag_removed') return stored.tag === incoming.tag;
  if (stored.type === 'form_submit' && incoming.type === 'form_submit') {
    return !stored.formId || stored.formId === incoming.formId;
  }
  if (stored.type === 'page_visited' && incoming.type === 'page_visited') {
    return stored.path === incoming.path;
  }
  if (stored.type === 'custom_event' && incoming.type === 'custom_event') {
    return stored.name === (incoming as { name: string }).name;
  }
  if (stored.type === 'notice_uploaded' || stored.type === 'email_replied' || stored.type === 'manual') {
    return true;
  }
  return false;
}
