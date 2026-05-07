import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const inputSchema = z.object({
  firmId: z.string().uuid(),
  anonId: z.string().min(8),
  sessionId: z.string().min(8),
  contactId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  properties: z.record(z.string(), z.unknown()).optional(),
  ts: z.string(),
});

export async function POST(req: Request) {
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const e = parsed.data;

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('firm_id', e.firmId)
    .eq('anon_id', e.anonId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from('events').insert({
    firm_id: e.firmId,
    session_id: session?.id ?? null,
    contact_id: e.contactId ?? null,
    name: e.name,
    properties: e.properties ?? {},
  });

  return NextResponse.json({ ok: true });
}
