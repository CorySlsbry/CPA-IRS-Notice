import { z } from 'zod';

export const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('form_submit'), formId: z.string().optional() }),
  z.object({ type: z.literal('tag_added'), tag: z.string() }),
  z.object({ type: z.literal('tag_removed'), tag: z.string() }),
  z.object({ type: z.literal('segment_entered'), segmentId: z.string() }),
  z.object({ type: z.literal('segment_exited'), segmentId: z.string() }),
  z.object({ type: z.literal('page_visited'), path: z.string() }),
  z.object({ type: z.literal('email_opened'), campaignId: z.string().optional() }),
  z.object({ type: z.literal('email_clicked'), campaignId: z.string().optional() }),
  z.object({ type: z.literal('email_replied') }),
  z.object({ type: z.literal('deal_stage_changed'), pipelineId: z.string().optional(), stage: z.string().optional() }),
  z.object({ type: z.literal('custom_event'), name: z.string() }),
  z.object({ type: z.literal('date_field_match'), field: z.string() }),
  z.object({ type: z.literal('no_activity_for'), days: z.number().int().positive() }),
  z.object({ type: z.literal('scheduled'), cron: z.string() }),
  z.object({ type: z.literal('notice_uploaded') }),
  z.object({ type: z.literal('manual') }),
]);

export type WorkflowTrigger = z.infer<typeof triggerSchema>;

export const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(['trigger', 'action', 'end']),
  data: z.record(z.string(), z.unknown()),
});

export const edgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  /** When set, edge is taken only when branch label matches the action result. */
  branch: z.string().optional(),
});

export const graphSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export type WorkflowNode = z.infer<typeof nodeSchema>;
export type WorkflowEdge = z.infer<typeof edgeSchema>;
export type WorkflowGraph = z.infer<typeof graphSchema>;

export const actionSchemas = {
  send_email: z.object({
    action: z.literal('send_email'),
    template: z.string(),
    subject: z.string(),
    fromName: z.string().optional(),
  }),
  add_tag: z.object({ action: z.literal('add_tag'), tag: z.string() }),
  remove_tag: z.object({ action: z.literal('remove_tag'), tag: z.string() }),
  set_field: z.object({
    action: z.literal('set_field'),
    field: z.string(),
    value: z.unknown(),
  }),
  move_deal_stage: z.object({
    action: z.literal('move_deal_stage'),
    pipelineId: z.string(),
    stage: z.string(),
  }),
  create_task: z.object({
    action: z.literal('create_task'),
    title: z.string(),
    dueInDays: z.number().int().nonnegative().optional(),
  }),
  wait: z.object({
    action: z.literal('wait'),
    amount: z.number().int().nonnegative(),
    unit: z.enum(['minutes', 'hours', 'days']),
    untilTimeOfDay: z.string().optional(), // "09:00"
  }),
  branch: z.object({
    action: z.literal('branch'),
    condition: z.object({
      field: z.string(),
      operator: z.enum(['is', 'is_not', 'gt', 'lt', 'is_set', 'is_empty']),
      value: z.unknown().optional(),
    }),
  }),
  webhook: z.object({
    action: z.literal('webhook'),
    url: z.string().url(),
    method: z.enum(['POST', 'PUT', 'PATCH']).default('POST'),
    body: z.record(z.string(), z.unknown()).optional(),
  }),
  ai_step: z.object({
    action: z.literal('ai_step'),
    prompt: z.string(),
    expectedOutputShape: z.record(z.string(), z.unknown()),
  }),
  post_to_social: z.object({
    action: z.literal('post_to_social'),
    accountId: z.string().uuid(),
    body: z.string().min(1).max(5000),
    mediaUrls: z.array(z.string().url()).max(10).optional(),
    linkUrl: z.string().url().optional(),
    /** Schedule N minutes/hours/days from when this node fires. Omit to post immediately. */
    delay: z
      .object({
        amount: z.number().int().nonnegative(),
        unit: z.enum(['minutes', 'hours', 'days']),
      })
      .optional(),
  }),
  end: z.object({ action: z.literal('end') }),
} as const;

export type ActionSpec =
  | z.infer<typeof actionSchemas.send_email>
  | z.infer<typeof actionSchemas.add_tag>
  | z.infer<typeof actionSchemas.remove_tag>
  | z.infer<typeof actionSchemas.set_field>
  | z.infer<typeof actionSchemas.move_deal_stage>
  | z.infer<typeof actionSchemas.create_task>
  | z.infer<typeof actionSchemas.wait>
  | z.infer<typeof actionSchemas.branch>
  | z.infer<typeof actionSchemas.webhook>
  | z.infer<typeof actionSchemas.ai_step>
  | z.infer<typeof actionSchemas.post_to_social>
  | z.infer<typeof actionSchemas.end>;
