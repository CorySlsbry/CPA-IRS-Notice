'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Row = Record<string, string>;

const FIELD_OPTIONS = [
  '— skip —',
  'email',
  'first_name',
  'last_name',
  'phone',
  'job_title',
  'company_name',
  'lifecycle_stage',
  'source',
  'tags',
];

export function ImportClient() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function onFile(file: File | null) {
    if (!file) return;
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        setRows(r.data.slice(0, 5000));
        setHeaders(r.meta.fields ?? []);
        const guessed: Record<string, string> = {};
        for (const h of r.meta.fields ?? []) {
          const lower = h.toLowerCase();
          if (lower.includes('email')) guessed[h] = 'email';
          else if (lower.includes('first')) guessed[h] = 'first_name';
          else if (lower.includes('last')) guessed[h] = 'last_name';
          else if (lower === 'name' || lower === 'full name') guessed[h] = 'first_name';
          else if (lower.includes('phone')) guessed[h] = 'phone';
          else if (lower.includes('title') || lower.includes('role')) guessed[h] = 'job_title';
          else if (lower.includes('company') || lower.includes('firm')) guessed[h] = 'company_name';
          else if (lower.includes('tag')) guessed[h] = 'tags';
          else if (lower.includes('source')) guessed[h] = 'source';
          else guessed[h] = '— skip —';
        }
        setMapping(guessed);
        toast.success(`Parsed ${r.data.length} rows.`);
      },
      error: (err) => toast.error(err.message),
    });
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows, mapping }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.error ?? 'Import failed');
        return;
      }
      toast.success(`Imported ${body.created} new + ${body.updated} updated.`);
      router.push('/contacts');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-0">
          <label
            htmlFor="csv"
            className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-accent hover:bg-accent/5"
          >
            <Upload className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-serif text-lg">Drop your CSV</p>
            <p className="mt-1 text-sm text-muted-foreground">Up to 5,000 rows per import.</p>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => onFile(e.currentTarget.files?.[0] ?? null)}
            />
          </label>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold">Map columns</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2 text-sm">
                  <span className="w-1/2 truncate font-mono text-xs">{h}</span>
                  <select
                    value={mapping[h] ?? '— skip —'}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                    className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {FIELD_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <Button onClick={submit} variant="gold" size="lg" className="mt-5" disabled={busy}>
              {busy ? <><Loader2 className="size-4 animate-spin" /> Importing…</> : `Import ${rows.length} rows`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
