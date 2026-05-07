import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, rateLimitOk } from '@/lib/api/public-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { enrollContact } from '@/lib/workflows/enroll';

export const runtime = 'nodejs';

const inputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!rateLimitOk(auth.firmId, auth.rateLimit)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: contact } = await supabase
    .from('contacts')
    .upsert({ firm_id: auth.firmId, email: parsed.data.email.toLowerCase() }, { onConflict: 'firm_id,email' })
    .select('id')
    .single();

  if (!contact) return NextResponse.json({ error: 'contact_create_failed' }, { status: 500 });

  await supabase.from('events').insert({
    firm_id: auth.firmId,
    contact_id: contact.id,
    name: parsed.data.name,
    properties: parsed.data.properties ?? {},
  });

  await enrollContact({
    firmId: auth.firmId,
    contactId: contact.id,
    trigger: { type: 'custom_event', name: parsed.data.name },
  });

  return NextResponse.json({ ok: true });
}
