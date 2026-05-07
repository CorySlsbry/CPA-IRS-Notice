import { NextResponse } from 'next/server';
import { z } from 'zod';
import { draftResponse } from '@/lib/ai/draft-response';
import { classificationSchema } from '@/lib/ai/classify-notice';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  noticeId: z.string().uuid(),
  strategy: z.enum([
    'agree_pay',
    'disagree_with_documentation',
    'partial_agree',
    'request_abatement',
    'request_installment',
    'unable_to_determine',
  ]),
  priorReturnNotes: z.string().max(20_000),
});

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: notice } = await admin
    .from('notices')
    .select('id, firm_id, classification_json, status')
    .eq('id', parsed.data.noticeId)
    .single();
  if (!notice) return NextResponse.json({ error: 'notice_not_found' }, { status: 404 });

  const { data: membership } = await sb
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .eq('firm_id', notice.firm_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const classification = classificationSchema.parse(notice.classification_json);
  const { data: firm } = await admin
    .from('firms')
    .select('name, default_signer_name, default_signer_title, settings')
    .eq('id', notice.firm_id)
    .single();
  if (!firm) return NextResponse.json({ error: 'firm_not_found' }, { status: 404 });

  const settings = (firm.settings ?? {}) as Record<string, string>;

  const result = await draftResponse({
    classification,
    priorReturnNotes: parsed.data.priorReturnNotes,
    strategy: parsed.data.strategy,
    firm: {
      name: firm.name,
      address: settings.address ?? '[CPA: confirm address]',
      phone: settings.phone,
      email: settings.email,
    },
    signer: {
      name: firm.default_signer_name ?? '[CPA name]',
      title: firm.default_signer_title ?? 'CPA',
    },
    letterDate: new Date().toISOString().slice(0, 10),
  });

  if (result.stopReason === 'max_tokens') {
    // Per landing-page-failures memory: never silently accept a truncated draft.
    return NextResponse.json(
      { error: 'draft_truncated', detail: 'Model hit max_tokens. Retry with shorter prior_return_notes.' },
      { status: 422 },
    );
  }

  const { data: response } = await admin
    .from('responses')
    .insert({
      notice_id: notice.id,
      firm_id: notice.firm_id,
      draft_text: result.draftText,
      draft_model: result.model,
      draft_prompt_version: result.promptVersion,
      draft_cost_cents: Math.round(result.costUsd * 100),
      irc_citations: result.ircCitations,
    })
    .select('id')
    .single();

  await admin
    .from('notices')
    .update({ status: 'drafted', drafted_at: new Date().toISOString() })
    .eq('id', notice.id);

  return NextResponse.json({
    responseId: response?.id,
    draftText: result.draftText,
    ircCitations: result.ircCitations,
    costUsd: result.costUsd,
  });
}
