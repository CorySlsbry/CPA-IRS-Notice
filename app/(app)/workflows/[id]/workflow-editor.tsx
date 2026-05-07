'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'reactflow/dist/style.css';
import type { Node, Edge } from 'reactflow';

const ReactFlow = dynamic(() => import('reactflow').then((m) => m.default), { ssr: false });
const Background = dynamic(() => import('reactflow').then((m) => m.Background), { ssr: false });
const Controls = dynamic(() => import('reactflow').then((m) => m.Controls), { ssr: false });

type Graph = {
  nodes: { id: string; type: string; data: Record<string, unknown> }[];
  edges: { source: string; target: string; branch?: string }[];
};

export function WorkflowEditor({
  workflowId: _workflowId,
  graphJson,
  triggerJson: _triggerJson,
}: {
  workflowId: string;
  graphJson: unknown;
  triggerJson: unknown;
}) {
  const graph = (graphJson as Graph | null) ?? { nodes: [], edges: [] };
  const { rfNodes, rfEdges } = useMemo(() => layoutGraph(graph), [graph]);

  return (
    <div className="h-[520px] w-full bg-secondary/20">
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView nodesDraggable={false} edgesUpdatable={false} proOptions={{ hideAttribution: true }}>
        <Background gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function layoutGraph(graph: Graph): { rfNodes: Node[]; rfEdges: Edge[] } {
  // Simple top-to-bottom auto layout: BFS from the trigger.
  const positions = new Map<string, { x: number; y: number }>();
  const start = graph.nodes.find((n) => n.type === 'trigger') ?? graph.nodes[0];
  if (start) positions.set(start.id, { x: 0, y: 0 });
  let queue: string[] = start ? [start.id] : [];
  const seen = new Set<string>();
  while (queue.length) {
    const next: string[] = [];
    for (const id of queue) {
      if (seen.has(id)) continue;
      seen.add(id);
      const pos = positions.get(id) ?? { x: 0, y: 0 };
      const children = graph.edges.filter((e) => e.source === id).map((e) => e.target);
      children.forEach((child, i) => {
        const offset = (i - (children.length - 1) / 2) * 220;
        positions.set(child, { x: pos.x + offset, y: pos.y + 130 });
        next.push(child);
      });
    }
    queue = next;
  }

  const rfNodes: Node[] = graph.nodes.map((n) => {
    const pos = positions.get(n.id) ?? { x: Math.random() * 400, y: Math.random() * 400 };
    const action = (n.data.action as string | undefined) ?? n.type;
    return {
      id: n.id,
      position: pos,
      data: { label: prettyLabel(n) },
      type: 'default',
      style: {
        background:
          n.type === 'trigger' ? '#1e3a8a' : n.type === 'end' ? '#374151' : action === 'wait' ? '#fbbf24' : '#ffffff',
        color: n.type === 'trigger' || n.type === 'end' ? '#fff' : '#111',
        border: '1px solid #d4d4d8',
        borderRadius: 10,
        padding: 8,
        fontSize: 12,
        width: 200,
      },
    };
  });
  const rfEdges: Edge[] = graph.edges.map((e, i) => ({
    id: `${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.branch,
    animated: true,
  }));
  return { rfNodes, rfEdges };
}

function prettyLabel(n: { id: string; type: string; data: Record<string, unknown> }): string {
  if (n.type === 'trigger') return `▶ ${(n.data.label as string) ?? 'trigger'}`;
  if (n.type === 'end') return '⬛ end';
  const action = n.data.action as string | undefined;
  if (action === 'send_email') return `📧 send: ${(n.data.template as string) ?? '?'}`;
  if (action === 'wait') return `⏱ wait ${n.data.amount} ${n.data.unit}`;
  if (action === 'add_tag') return `🏷 +${n.data.tag}`;
  if (action === 'remove_tag') return `🏷 −${n.data.tag}`;
  if (action === 'branch') return '🔀 branch';
  if (action === 'webhook') return '🔗 webhook';
  if (action === 'ai_step') return '🤖 ai step';
  return action ?? n.id;
}
