import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: membership } = await sb
    .from('firm_users')
    .select('firm_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();
  if (!membership || !['owner', 'admin'].includes(membership.role as string)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const key = `nr_live_${randomBytes(32).toString('base64url')}`;
  const hash = createHash('sha256').update(key).digest('hex');

  const admin = getSupabaseAdmin();
  await admin
    .from('firms')
    .update({ api_key_hash: hash, api_key_last4: key.slice(-4) })
    .eq('id', membership.firm_id);

  return NextResponse.json({ key, last4: key.slice(-4) });
}
