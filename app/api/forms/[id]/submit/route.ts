import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { enrollContact } from '@/lib/workflows/enroll';

export const runtime = 'nodejs';

const submitSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  honeypot: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = submitSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (parsed.data.honeypot) return NextResponse.json({ ok: true }); // spam

  const supabase = getSupabaseAdmin();
  const { data: form } = await supabase
    .from('forms')
    .select('id, firm_id, schema_json, on_submit_workflow_id, redirect_url, archived_at')
    .eq('id', id)
    .maybeSingle();
  if (!form || form.archived_at) return NextResponse.json({ error: 'form_not_found' }, { status: 404 });

  const email = (parsed.data.payload.email as string | undefined)?.toLowerCase();
  if (!email) return NextResponse.json({ error: 'missing_email' }, { status: 400 });

  const { data: contact } = await supabase
    .from('contacts')
    .upsert(
      {
        firm_id: form.firm_id,
        email,
        first_name: parsed.data.payload.first_name as string | undefined,
        last_name: parsed.data.payload.last_name as string | undefined,
        phone: parsed.data.payload.phone as string | undefined,
        custom_fields: parsed.data.payload as Record<string, unknown>,
        source: 'form',
      },
      { onConflict: 'firm_id,email' },
    )
    .select('id')
    .single();

  if (contact) {
    await supabase.from('form_submissions').insert({
      form_id: id,
      firm_id: form.firm_id,
      contact_id: contact.id,
      payload: parsed.data.payload,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    });
    await supabase.from('activities').insert({
      firm_id: form.firm_id,
      contact_id: contact.id,
      type: 'form_submit',
      payload: { form_id: id },
    });
    if (form.on_submit_workflow_id) {
      await enrollContact({
        firmId: form.firm_id,
        contactId: contact.id,
        trigger: { type: 'form_submit', formId: id },
      });
    }
  }

  return NextResponse.json({ ok: true, redirect: form.redirect_url ?? null });
}
