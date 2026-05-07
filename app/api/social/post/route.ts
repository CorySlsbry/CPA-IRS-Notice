import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { tickSocialQueue } from '@/lib/social/post-runner';

export const runtime = 'nodejs';

const inputSchema = z.object({
  accountId: z.string().uuid(),
  body: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  linkUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
});

/**
 * Create a social post — either schedule it or publish immediately.
 * Server endpoint for the in-app composer.
 */
export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Verify the user has access to the account's firm
  const { data: account } = await admin
    .from('social_accounts')
    .select('id, firm_id, platform, status')
    .eq('id', parsed.data.accountId)
    .single();
  if (!account) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
  if (account.status !== 'connected') {
    return NextResponse.json({ error: 'account_not_connected' }, { status: 400 });
  }

  const { data: membership } = await sb
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .eq('firm_id', account.firm_id as string)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const isImmediate = !parsed.data.scheduledAt;
  const status = isImmediate ? 'scheduled' : 'scheduled';
  const scheduledAt = parsed.data.scheduledAt ?? new Date().toISOString();

  const { data: row, error: insertErr } = await admin
    .from('social_posts')
    .insert({
      firm_id: account.firm_id,
      account_id: account.id,
      platform: account.platform,
      body: parsed.data.body,
      media_urls: parsed.data.mediaUrls ?? null,
      link_url: parsed.data.linkUrl ?? null,
      scheduled_at: scheduledAt,
      status,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (insertErr || !row) return NextResponse.json({ error: insertErr?.message ?? 'insert_failed' }, { status: 500 });

  if (isImmediate) {
    // Run the queue once now so the user sees the post hit Meta synchronously.
    await tickSocialQueue({ limit: 5 });
  }

  return NextResponse.json({ id: row.id, scheduledAt, immediate: isImmediate });
}
