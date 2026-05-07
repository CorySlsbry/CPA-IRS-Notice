import { NextResponse } from 'next/server';
import { z } from 'zod';
import { classifyNotice } from '@/lib/ai/classify-notice';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  noticeId: z.string().uuid(),
  pages: z
    .array(
      z.object({
        base64: z.string().min(20),
        mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
      }),
    )
    .min(1)
    .max(8),
});

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: notice } = await admin
    .from('notices')
    .select('id, firm_id, status')
    .eq('id', parsed.data.noticeId)
    .single();
  if (!notice) return NextResponse.json({ error: 'notice_not_found' }, { status: 404 });

  // Verify the user belongs to the firm.
  const { data: membership } = await sb
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .eq('firm_id', notice.firm_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const result = await classifyNotice({ pages: parsed.data.pages });

  await admin
    .from('notices')
    .update({
      notice_type: result.classification.noticeType,
      tax_year: result.classification.taxYear,
      amount_owed_cents: result.classification.amountOwedCents,
      irs_reasoning: result.classification.irsReasoning,
      ssn_masked: result.classification.ssnMasked,
      classification_json: result.classification,
      status: 'classified',
      classified_at: new Date().toISOString(),
      cost_cents: Math.round(result.costUsd * 100),
    })
    .eq('id', notice.id);

  return NextResponse.json({ classification: result.classification, costUsd: result.costUsd });
}
