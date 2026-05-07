import { z } from 'zod';

/**
 * Segment filter compiler. JSON in, parameterized SQL out.
 * Supabase RPC `eval_segment` would normally execute this — for now
 * we stick to query-builder semantics so we can run it via PostgREST.
 *
 * Operators:
 *   is, is_not, contains, gt, lt, between, is_set, is_empty,
 *   in_last_n_days, tagged, not_tagged, in_segment,
 *   viewed_page, clicked_email, opened_email, replied_email,
 *   submitted_form, lifecycle_stage_is, lead_score_gt
 */

export const operatorEnum = z.enum([
  'is',
  'is_not',
  'contains',
  'gt',
  'lt',
  'between',
  'is_set',
  'is_empty',
  'in_last_n_days',
  'tagged',
  'not_tagged',
  'in_segment',
  'viewed_page',
  'clicked_email',
  'opened_email',
  'replied_email',
  'submitted_form',
  'lifecycle_stage_is',
  'lead_score_gt',
]);

const conditionSchema = z.object({
  field: z.string(),
  operator: operatorEnum,
  value: z.unknown().optional(),
  value2: z.unknown().optional(),
});

const groupSchema: z.ZodType<SegmentGroup> = z.lazy(() =>
  z.object({
    combinator: z.enum(['and', 'or']),
    conditions: z.array(z.union([conditionSchema, groupSchema])),
  }),
);

export type SegmentCondition = z.infer<typeof conditionSchema>;
export type SegmentGroup = {
  combinator: 'and' | 'or';
  conditions: (SegmentCondition | SegmentGroup)[];
};

export const segmentFilterSchema = groupSchema;

const ALLOWED_FIELDS = new Set([
  'email',
  'first_name',
  'last_name',
  'job_title',
  'lifecycle_stage',
  'lead_score',
  'created_at',
  'unsubscribed_at',
  'bounced_at',
  'company_id',
  'source',
]);

const CUSTOM_FIELD_PREFIX = 'custom.';

type CompiledClause = { sql: string; params: unknown[] };

/**
 * Compile a SegmentGroup into a single SQL WHERE-clause fragment that
 * filters `contacts c`. Sub-queries are correlated to `c.id` and the
 * provided `firmId`. The caller wraps the fragment in:
 *   select c.* from contacts c where c.firm_id = $1 and (<fragment>)
 */
export function compileSegment(
  group: SegmentGroup,
  firmId: string,
): CompiledClause {
  const params: unknown[] = [firmId];
  const sql = compileGroup(group, params);
  return { sql, params };
}

function compileGroup(group: SegmentGroup, params: unknown[]): string {
  if (group.conditions.length === 0) return 'true';
  const parts = group.conditions.map((c) =>
    'combinator' in c ? `(${compileGroup(c, params)})` : compileCondition(c, params),
  );
  const join = group.combinator === 'or' ? ' or ' : ' and ';
  return parts.join(join);
}

function compileCondition(cond: SegmentCondition, params: unknown[]): string {
  const { field, operator, value, value2 } = cond;

  if (field.startsWith(CUSTOM_FIELD_PREFIX)) {
    const key = field.slice(CUSTOM_FIELD_PREFIX.length);
    return customFieldClause(key, operator, value, value2, params);
  }
  if (!ALLOWED_FIELDS.has(field)) {
    return 'false';
  }

  const col = `c.${field}`;
  switch (operator) {
    case 'is':
      params.push(value);
      return `${col} = $${params.length}`;
    case 'is_not':
      params.push(value);
      return `${col} is distinct from $${params.length}`;
    case 'contains':
      params.push(`%${String(value ?? '')}%`);
      return `${col}::text ilike $${params.length}`;
    case 'gt':
      params.push(value);
      return `${col} > $${params.length}`;
    case 'lt':
      params.push(value);
      return `${col} < $${params.length}`;
    case 'between':
      params.push(value, value2);
      return `${col} between $${params.length - 1} and $${params.length}`;
    case 'is_set':
      return `${col} is not null`;
    case 'is_empty':
      return `${col} is null`;
    case 'in_last_n_days': {
      const n = Number(value ?? 0);
      return `${col} >= now() - interval '${n} days'`;
    }
    case 'lifecycle_stage_is':
      params.push(value);
      return `c.lifecycle_stage = $${params.length}`;
    case 'lead_score_gt':
      params.push(value);
      return `c.lead_score > $${params.length}`;
    case 'tagged':
      params.push(value);
      return `exists (
        select 1 from contact_tags ct join tags t on t.id = ct.tag_id
        where ct.contact_id = c.id and t.name = $${params.length}
      )`;
    case 'not_tagged':
      params.push(value);
      return `not exists (
        select 1 from contact_tags ct join tags t on t.id = ct.tag_id
        where ct.contact_id = c.id and t.name = $${params.length}
      )`;
    case 'in_segment':
      // Avoid recursion explosion — flag for caller to compile separately.
      params.push(value);
      return `c.id in (select contact_id from segment_membership_cache where segment_id = $${params.length})`;
    case 'viewed_page':
      params.push(value);
      return `exists (
        select 1 from pageviews pv join sessions s on s.id = pv.session_id
        where s.contact_id = c.id and pv.path = $${params.length}
      )`;
    case 'opened_email':
      params.push(value);
      return value
        ? `exists (select 1 from email_sends es where es.contact_id = c.id and es.opened_at is not null and es.subject ilike $${params.length})`
        : 'exists (select 1 from email_sends es where es.contact_id = c.id and es.opened_at is not null)';
    case 'clicked_email':
      params.push(value);
      return value
        ? `exists (select 1 from email_sends es where es.contact_id = c.id and es.first_clicked_at is not null and es.subject ilike $${params.length})`
        : 'exists (select 1 from email_sends es where es.contact_id = c.id and es.first_clicked_at is not null)';
    case 'replied_email':
      return 'exists (select 1 from email_sends es where es.contact_id = c.id and es.replied_at is not null)';
    case 'submitted_form':
      params.push(value);
      return `exists (select 1 from form_submissions fs where fs.contact_id = c.id and fs.form_id = $${params.length})`;
    default:
      return 'false';
  }
}

function customFieldClause(
  key: string,
  operator: SegmentCondition['operator'],
  value: unknown,
  _value2: unknown,
  params: unknown[],
): string {
  const path = `c.custom_fields->>'${key.replace(/'/g, "''")}'`;
  switch (operator) {
    case 'is':
      params.push(String(value));
      return `${path} = $${params.length}`;
    case 'is_not':
      params.push(String(value));
      return `${path} is distinct from $${params.length}`;
    case 'contains':
      params.push(`%${String(value ?? '')}%`);
      return `${path} ilike $${params.length}`;
    case 'is_set':
      return `${path} is not null`;
    case 'is_empty':
      return `${path} is null`;
    default:
      return 'false';
  }
}
