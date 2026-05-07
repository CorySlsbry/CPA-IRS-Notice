'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ApiKeyClient() {
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    try {
      const r = await fetch('/api/settings/api-key', { method: 'POST' });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.error ?? 'Failed');
        return;
      }
      setRevealed(body.key);
      toast.success('New API key generated. Save it — it will not be shown again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {revealed ? (
        <>
          <pre className="overflow-x-auto rounded bg-secondary/50 p-3 font-mono text-xs">{revealed}</pre>
          <p className="text-xs text-muted-foreground">Copy this now — we only store the hash. You won't see it again.</p>
        </>
      ) : (
        <p className="text-muted-foreground">Generate a per-firm API key. Pass it as <code className="rounded bg-secondary px-1">x-api-key</code> or <code className="rounded bg-secondary px-1">Authorization: Bearer …</code>.</p>
      )}
      <Button variant={revealed ? 'outline' : 'gold'} onClick={generate} disabled={generating}>
        {generating ? 'Generating…' : revealed ? 'Regenerate (invalidates current)' : 'Generate API key'}
      </Button>
    </div>
  );
}
