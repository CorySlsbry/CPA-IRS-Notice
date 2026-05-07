import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, rateLimitOk } from '@/lib/api/public-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const upsertSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!rateLimitOk(auth.firmId, auth.rateLimit)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contact, error } = await supabase
    .from('contacts')
    .upsert(
      {
        firm_id: auth.firmId,
        email: parsed.data.email.toLowerCase(),
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        phone: parsed.data.phone,
        job_title: parsed.data.job_title,
        source: parsed.data.source,
        custom_fields: parsed.data.custom_fields ?? {},
      },
      { onConflict: 'firm_id,email' },
    )
    .select('id, email, first_name, last_name')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const tagName of parsed.data.tags ?? []) {
    const { data: tag } = await supabase
      .from('tags')
      .upsert({ firm_id: auth.firmId, name: tagName }, { onConflict: 'firm_id,name' })
      .select('id')
      .single();
    if (tag && contact) {
      await supabase
        .from('contact_tags')
        .upsert({ contact_id: contact.id, tag_id: tag.id, firm_id: auth.firmId }, { onConflict: 'contact_id,tag_id' });
    }
  }

  return NextResponse.json({ contact });
}

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('contacts')
    .select('id, email, first_name, last_name, lifecycle_stage, lead_score, created_at')
    .eq('firm_id', auth.firmId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data });
}
