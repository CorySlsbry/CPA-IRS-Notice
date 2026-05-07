import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const inputSchema = z.object({
  firmId: z.string().uuid(),
  anonId: z.string().min(8),
  sessionId: z.string().min(8),
  path: z.string(),
  ms_on_page: z.number().int().nonnegative(),
  scroll_depth_pct: z.number().int().min(0).max(100),
  ts: z.string(),
});

export async function POST(req: Request) {
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const v = parsed.data;
  // Best-effort update of the most recent matching pageview.
  const { data: pv } = await supabase
    .from('pageviews')
    .select('id')
    .eq('firm_id', v.firmId)
    .eq('path', v.path)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pv) {
    await supabase
      .from('pageviews')
      .update({ ms_on_page: v.ms_on_page, scroll_depth_pct: v.scroll_depth_pct })
      .eq('id', pv.id);
  }
  return NextResponse.json({ ok: true });
}
