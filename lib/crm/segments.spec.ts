import { describe, expect, test } from 'vitest';
import { compileSegment, type SegmentGroup } from './segments';

const firmId = '00000000-0000-0000-0000-000000000001';

describe('compileSegment', () => {
  test('empty group compiles to true', () => {
    const out = compileSegment({ combinator: 'and', conditions: [] }, firmId);
    expect(out.sql).toBe('true');
  });

  test('single is-clause produces parameterized SQL', () => {
    const out = compileSegment(
      { combinator: 'and', conditions: [{ field: 'lifecycle_stage', operator: 'is', value: 'lead' }] },
      firmId,
    );
    expect(out.sql).toBe('c.lifecycle_stage = $2');
    expect(out.params).toEqual([firmId, 'lead']);
  });

  test('OR combinator joins with " or "', () => {
    const group: SegmentGroup = {
      combinator: 'or',
      conditions: [
        { field: 'lifecycle_stage', operator: 'is', value: 'lead' },
        { field: 'lifecycle_stage', operator: 'is', value: 'mql' },
      ],
    };
    const out = compileSegment(group, firmId);
    expect(out.sql).toBe('c.lifecycle_stage = $2 or c.lifecycle_stage = $3');
    expect(out.params).toEqual([firmId, 'lead', 'mql']);
  });

  test('nested group is parenthesized', () => {
    const group: SegmentGroup = {
      combinator: 'and',
      conditions: [
        { field: 'lifecycle_stage', operator: 'is', value: 'lead' },
        {
          combinator: 'or',
          conditions: [
            { field: 'lead_score', operator: 'gt', value: 50 },
            { field: 'email', operator: 'contains', value: 'cpa' },
          ],
        },
      ],
    };
    const out = compileSegment(group, firmId);
    expect(out.sql).toBe('c.lifecycle_stage = $2 and (c.lead_score > $3 or c.email::text ilike $4)');
    expect(out.params).toEqual([firmId, 'lead', 50, '%cpa%']);
  });

  test('tagged generates EXISTS sub-query', () => {
    const out = compileSegment(
      { combinator: 'and', conditions: [{ field: 'any', operator: 'tagged', value: 'cpa-prospect' }] },
      firmId,
    );
    expect(out.sql).toContain('exists');
    expect(out.sql).toContain('contact_tags');
    expect(out.params).toEqual([firmId, 'cpa-prospect']);
  });

  test('unknown field on contact compiles to false (no SQL injection vector)', () => {
    const out = compileSegment(
      { combinator: 'and', conditions: [{ field: 'password', operator: 'is', value: "'; drop table contacts;" }] },
      firmId,
    );
    expect(out.sql).toBe('false');
    expect(out.params).toEqual([firmId]);
  });

  test('custom field path uses jsonb operator', () => {
    const out = compileSegment(
      { combinator: 'and', conditions: [{ field: 'custom.firm_size', operator: 'is', value: '5-15' }] },
      firmId,
    );
    expect(out.sql).toBe("c.custom_fields->>'firm_size' = $2");
    expect(out.params).toEqual([firmId, '5-15']);
  });

  test('custom field key with single quote is escaped', () => {
    const out = compileSegment(
      { combinator: 'and', conditions: [{ field: "custom.it's_a_field", operator: 'is_set' }] },
      firmId,
    );
    expect(out.sql).toBe("c.custom_fields->>'it''s_a_field' is not null");
  });

  test('between produces two-param BETWEEN', () => {
    const out = compileSegment(
      {
        combinator: 'and',
        conditions: [{ field: 'lead_score', operator: 'between', value: 10, value2: 50 }],
      },
      firmId,
    );
    expect(out.sql).toBe('c.lead_score between $2 and $3');
    expect(out.params).toEqual([firmId, 10, 50]);
  });
});
