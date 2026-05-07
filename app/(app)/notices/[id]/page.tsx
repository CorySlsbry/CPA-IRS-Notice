import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NoticeWorkbench } from './workbench';

export const metadata = { title: 'Notice' };

export default async function NoticeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data: notice } = await sb
    .from('notices')
    .select('id, firm_id, notice_type, status, tax_year, amount_owed_cents, irs_reasoning, ssn_masked, classification_json, uploaded_at, drafted_at, mailed_at')
    .eq('id', id)
    .maybeSingle();
  if (!notice) notFound();

  const { data: response } = await sb
    .from('responses')
    .select('id, draft_text, final_text, irc_citations, mailed_at, lob_letter_id, lob_tracking_status')
    .eq('notice_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <NoticeWorkbench notice={notice} response={response ?? null} />
    </div>
  );
}
