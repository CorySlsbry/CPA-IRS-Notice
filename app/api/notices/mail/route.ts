import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getLobLetters, letterMarkdownToHtml } from '@/lib/lob/client';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  noticeId: z.string().uuid(),
  finalText: z.string().min(40),
  taxpayerAddress: z.object({
    line1: z.string().min(3),
    city: z.string().min(1),
    state: z.string().length(2),
    zip: z.string().min(5),
  }),
});

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: notice } = await admin
    .from('notices')
    .select('id, firm_id, notice_type, classification_json')
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

  const { data: firm } = await admin
    .from('firms')
    .select('name, logo_url, default_signer_name, default_signer_title, settings')
    .eq('id', notice.firm_id)
    .single();
  if (!firm) return NextResponse.json({ error: 'firm_not_found' }, { status: 404 });

  const settings = (firm.settings ?? {}) as Record<string, string>;
  const html = letterMarkdownToHtml(parsed.data.finalText, {
    firmName: firm.name,
    logoUrl: firm.logo_url ?? undefined,
  });

  const lob = getLobLetters();
  const letter = await lob.create({
    description: `${notice.notice_type ?? 'IRS notice'} response — ${notice.id.slice(0, 8)}`,
    to: {
      name: 'Internal Revenue Service',
      address_line1: parsed.data.taxpayerAddress.line1,
      address_city: parsed.data.taxpayerAddress.city,
      address_state: parsed.data.taxpayerAddress.state,
      address_zip: parsed.data.taxpayerAddress.zip,
      address_country: 'US',
    },
    from: {
      name: process.env.LOB_FROM_NAME ?? firm.name,
      address_line1: process.env.LOB_FROM_LINE1 ?? settings.address ?? '',
      address_city: process.env.LOB_FROM_CITY ?? settings.city ?? '',
      address_state: process.env.LOB_FROM_STATE ?? settings.state ?? '',
      address_zip: process.env.LOB_FROM_ZIP ?? settings.zip ?? '',
      address_country: 'US',
    },
    file: html,
    color: false,
    double_sided: true,
    address_placement: 'top_first_page',
    extra_service: 'certified',
  });

  const lobId = (letter.data as unknown as { id?: string })?.id ?? '';
  const expectedDelivery = (letter.data as unknown as { expected_delivery_date?: string })?.expected_delivery_date ?? null;

  // Persist on the response row.
  const { data: existing } = await admin
    .from('responses')
    .select('id')
    .eq('notice_id', notice.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin
      .from('responses')
      .update({
        final_text: parsed.data.finalText,
        mailed_at: new Date().toISOString(),
        lob_letter_id: lobId,
        lob_expected_delivery_date: expectedDelivery,
        lob_tracking_status: 'mailed',
      })
      .eq('id', existing.id);
  }

  await admin
    .from('notices')
    .update({ status: 'mailed', mailed_at: new Date().toISOString() })
    .eq('id', notice.id);

  await admin.from('activities').insert({
    firm_id: notice.firm_id,
    contact_id: null,
    type: 'notice_mailed',
    payload: { notice_id: notice.id, lob_letter_id: lobId, expected_delivery: expectedDelivery },
  });

  return NextResponse.json({
    lobLetterId: lobId,
    expectedDelivery,
  });
}
