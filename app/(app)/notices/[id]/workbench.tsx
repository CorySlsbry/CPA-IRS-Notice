'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, FileSignature, Loader2, Mail, RefreshCcw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

type Notice = {
  id: string;
  firm_id: string;
  notice_type: string | null;
  status: string;
  tax_year: number | null;
  amount_owed_cents: number | null;
  irs_reasoning: string | null;
  ssn_masked: string | null;
  classification_json: unknown;
  uploaded_at: string;
  drafted_at: string | null;
  mailed_at: string | null;
};

type Response = {
  id: string;
  draft_text: string;
  final_text: string | null;
  irc_citations: string[] | null;
  mailed_at: string | null;
  lob_letter_id: string | null;
  lob_tracking_status: string | null;
} | null;

const STRATEGIES = [
  { id: 'agree_pay', label: 'Agree + pay' },
  { id: 'disagree_with_documentation', label: 'Disagree + document' },
  { id: 'partial_agree', label: 'Partial agree' },
  { id: 'request_abatement', label: 'Request abatement' },
  { id: 'request_installment', label: 'Request installment' },
] as const;

export function NoticeWorkbench({ notice, response }: { notice: Notice; response: Response }) {
  const router = useRouter();
  const [strategy, setStrategy] = useState<(typeof STRATEGIES)[number]['id']>('disagree_with_documentation');
  const [priorReturnNotes, setPriorReturnNotes] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [editing, setEditing] = useState(response?.final_text ?? response?.draft_text ?? '');
  const [mailing, setMailing] = useState(false);
  const [taxpayerAddress, setTaxpayerAddress] = useState({ line1: '', city: '', state: '', zip: '' });

  async function draft() {
    setDrafting(true);
    try {
      const r = await fetch('/api/notices/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ noticeId: notice.id, strategy, priorReturnNotes }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.error ?? 'Draft failed');
        return;
      }
      toast.success('Draft ready.');
      setEditing(body.draftText);
      router.refresh();
    } finally {
      setDrafting(false);
    }
  }

  async function mail() {
    setMailing(true);
    try {
      const r = await fetch('/api/notices/mail', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          noticeId: notice.id,
          finalText: editing,
          taxpayerAddress,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        toast.error(body.error ?? 'Mail failed');
        return;
      }
      toast.success('Mailed certified — Lob letter ID ' + body.lobLetterId);
      router.refresh();
    } finally {
      setMailing(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/notices">
            <ArrowLeft className="size-4" /> All notices
          </Link>
        </Button>
        <Badge
          variant={
            notice.status === 'mailed' || notice.status === 'resolved'
              ? 'green'
              : notice.status === 'classified' || notice.status === 'drafted'
                ? 'amber'
                : 'secondary'
          }
        >
          {notice.status}
        </Badge>
      </div>

      <h1 className="mt-3 font-serif text-3xl">
        {notice.notice_type ?? 'Notice'}{' '}
        {notice.amount_owed_cents != null && (
          <span className="ml-2 font-sans text-base text-muted-foreground">
            {formatCurrency(notice.amount_owed_cents)}
          </span>
        )}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tax year {notice.tax_year ?? '—'} · uploaded {formatDate(notice.uploaded_at)} · SSN {notice.ssn_masked ?? '—'}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,18rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">IRS reasoning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{notice.irs_reasoning ?? 'Run classification to extract the reasoning.'}</p>
            </CardContent>
          </Card>

          {notice.status === 'classified' && !response && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generate a draft</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Strategy</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STRATEGIES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setStrategy(s.id)}
                        className={
                          'rounded-full border px-3 py-1 text-sm transition-colors ' +
                          (strategy === s.id
                            ? 'border-accent bg-accent text-accent-foreground'
                            : 'border-border bg-background hover:bg-secondary')
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="prior">Prior-return notes (paste relevant facts the AI needs)</Label>
                  <textarea
                    id="prior"
                    rows={5}
                    value={priorReturnNotes}
                    onChange={(e) => setPriorReturnNotes(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-border bg-background p-3 text-sm font-mono"
                    placeholder='e.g. "Brokerage 1099-DIV ($43K) was attached as Schedule D, page 47. Custom basis tracking on covered lots."'
                  />
                </div>
                <Button onClick={draft} variant="gold" size="lg" disabled={drafting}>
                  {drafting ? <><Loader2 className="size-4 animate-spin" /> Drafting…</> : <><FileSignature className="size-4" /> Draft response</>}
                </Button>
              </CardContent>
            </Card>
          )}

          {response && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Response draft</CardTitle>
                <Button variant="ghost" size="sm" onClick={draft} disabled={drafting}>
                  <RefreshCcw className="size-4" /> Regenerate
                </Button>
              </CardHeader>
              <CardContent>
                <textarea
                  rows={20}
                  value={editing}
                  onChange={(e) => setEditing(e.target.value)}
                  className="w-full rounded-md border border-border bg-background p-4 text-sm font-mono leading-relaxed"
                />
                {(response.irc_citations?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <span className="text-muted-foreground">Cited:</span>
                    {response.irc_citations?.map((c) => (
                      <Badge key={c} variant="outline">
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {response && !response.mailed_at && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mail certified</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Where the IRS letter should ship from. We use Lob test mode by default.</p>
                <Input placeholder="Recipient address line 1" value={taxpayerAddress.line1} onChange={(e) => setTaxpayerAddress({ ...taxpayerAddress, line1: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="City" value={taxpayerAddress.city} onChange={(e) => setTaxpayerAddress({ ...taxpayerAddress, city: e.target.value })} />
                  <Input placeholder="ST" value={taxpayerAddress.state} onChange={(e) => setTaxpayerAddress({ ...taxpayerAddress, state: e.target.value })} maxLength={2} />
                  <Input placeholder="ZIP" value={taxpayerAddress.zip} onChange={(e) => setTaxpayerAddress({ ...taxpayerAddress, zip: e.target.value })} />
                </div>
                <Button variant="gold" className="w-full" onClick={mail} disabled={mailing}>
                  {mailing ? <><Loader2 className="size-4 animate-spin" /> Mailing…</> : <><Mail className="size-4" /> Mail it</>}
                </Button>
              </CardContent>
            </Card>
          )}

          {response?.mailed_at && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mailed</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>Mailed {formatDate(response.mailed_at)}</p>
                {response.lob_letter_id && <p className="mt-1 font-mono text-xs text-muted-foreground">Lob ID: {response.lob_letter_id}</p>}
                {response.lob_tracking_status && <p className="mt-1">Status: <Badge variant="green">{response.lob_tracking_status}</Badge></p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Disclaimer</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-muted-foreground">
              NoticeReply is software. Every response is reviewed and signed by you, the CPA. We surface dollar amounts and citations so you can spot-check before signing. Liability sits with the practitioner — same as ProSeries or Lacerte.
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
