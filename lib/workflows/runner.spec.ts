import { describe, expect, test } from 'vitest';
import { graphSchema } from './types';

describe('workflow graph schema', () => {
  test('parses a valid 3-step graph', () => {
    const graph = {
      nodes: [
        { id: 'start', type: 'trigger', data: { label: 'tag_added trial-active' } },
        { id: 'e1', type: 'action', data: { action: 'send_email', template: 'trial_day0_welcome' } },
        { id: 'w1', type: 'action', data: { action: 'wait', amount: 2, unit: 'days' } },
        { id: 'end', type: 'end', data: {} },
      ],
      edges: [
        { source: 'start', target: 'e1' },
        { source: 'e1', target: 'w1' },
        { source: 'w1', target: 'end' },
      ],
    };
    const out = graphSchema.parse(graph);
    expect(out.nodes).toHaveLength(4);
    expect(out.edges).toHaveLength(3);
  });

  test('rejects an unknown node type', () => {
    expect(() =>
      graphSchema.parse({
        nodes: [{ id: 'x', type: 'banana', data: {} }],
        edges: [],
      }),
    ).toThrow();
  });
});
