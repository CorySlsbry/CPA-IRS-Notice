'use client';

import { Check, Minus, X } from 'lucide-react';

const ROWS = [
  ['Drafts an IRS notice response from a photo', { nr: 'yes', man: 'no', gen: 'no', stack: 'no' }],
  ['Mails certified to IRS in one click', { nr: 'yes', man: 'no', gen: 'no', stack: 'partial' }],
  ['Cites the right IRC sections automatically', { nr: 'yes', man: 'partial', gen: 'no', stack: 'no' }],
  ['CRM with contacts, segments, deals', { nr: 'yes', man: 'no', gen: 'no', stack: 'yes' }],
  ['Email engine with opens + clicks + replies', { nr: 'yes', man: 'no', gen: 'no', stack: 'yes' }],
  ['Visual workflow builder (drag-drop)', { nr: 'yes', man: 'no', gen: 'no', stack: 'yes' }],
  ['Website visitor analytics + funnels', { nr: 'yes', man: 'no', gen: 'no', stack: 'yes' }],
  ['Replies inbound to your real Gmail inbox', { nr: 'yes', man: 'yes', gen: 'no', stack: 'partial' }],
  ['Public API + per-firm webhooks', { nr: 'yes', man: 'no', gen: 'no', stack: 'yes' }],
  ['Total monthly cost', { nr: '$99', man: 'time', gen: '$20+', stack: '$650+' }],
];

const COLS = [
  { id: 'nr', name: 'NoticeReply', highlight: true },
  { id: 'man', name: 'Manual / by hand' },
  { id: 'gen', name: 'Generic AI (ChatGPT)' },
  { id: 'stack', name: 'HubSpot + ChatGPT + Lob' },
] as const;

export function Comparison() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Before you compare on price</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            Stop stitching three tools together. Stop billing 90 minutes for 6.
          </h2>
        </div>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left">
              <tr>
                <th className="p-4"></th>
                {COLS.map((c) => (
                  <th
                    key={c.id}
                    className={`p-4 text-center font-semibold ${c.highlight ? 'bg-accent/10 text-foreground' : 'text-muted-foreground'}`}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => {
                const [label, vals] = row as [string, Record<string, string>];
                const isLast = i === ROWS.length - 1;
                return (
                  <tr key={label} className={isLast ? 'border-t-2 border-border bg-secondary/30 font-semibold' : 'border-b border-border'}>
                    <td className="p-4">{label}</td>
                    {COLS.map((c) => (
                      <td key={c.id} className={`p-4 text-center ${c.highlight ? 'bg-accent/10' : ''}`}>
                        {renderCell(vals[c.id]!)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function renderCell(v: string) {
  if (v === 'yes') return <Check className="mx-auto size-5 text-emerald-600" />;
  if (v === 'no') return <X className="mx-auto size-5 text-red-500/80" />;
  if (v === 'partial') return <Minus className="mx-auto size-5 text-amber-500" />;
  return <span className="font-mono text-sm">{v}</span>;
}
