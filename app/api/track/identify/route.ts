import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const inputSchema = z.object({
  firmId: z.string().uuid(),
  anonId: z.string().min(8),
  sessionId: z.string().min(8),
  email: z.string().email(),
  traits: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const v = parsed.data;

  const traits = v.traits ?? {};
  const update = {
    firm_id: v.firmId,
    email: v.email.toLowerCase(),
    first_name: (traits.first_name as string) ?? undefined,
    last_name: (traits.last_name as string) ?? undefined,
    job_title: (traits.job_title as string) ?? undefined,
    custom_fields: Object.fromEntries(
      Object.entries(traits).filter(([k]) => !['first_name', 'last_name', 'job_title'].includes(k)),
    ),
  };

  const { data: contact } = await supabase
    .from('contacts')
    .upsert(update, { onConflict: 'firm_id,email' })
    .select('id')
    .single();

  if (contact) {
    // Backfill prior anonymous sessions onto this contact.
    await supabase.from('sessions').update({ contact_id: contact.id }).eq('firm_id', v.firmId).eq('anon_id', v.anonId).is('contact_id', null);
    await supabase.from('activities').insert({
      firm_id: v.firmId,
      contact_id: contact.id,
      type: 'identified',
      payload: { anon_id: v.anonId },
    });
  }

  return NextResponse.json({ contactId: contact?.id });
}
