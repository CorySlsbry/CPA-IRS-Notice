import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1×1 transparent GIF.
const GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sendId = searchParams.get('s');
  if (sendId) {
    const supabase = getSupabaseAdmin();
    const { data: send } = await supabase
      .from('email_sends')
      .select('id, firm_id, contact_id, opened_at, open_count')
      .eq('id', sendId)
      .single();
    if (send) {
      await supabase
        .from('email_sends')
        .update({
          opened_at: send.opened_at ?? new Date().toISOString(),
          open_count: ((send.open_count as number) ?? 0) + 1,
        })
        .eq('id', sendId);
      await supabase.from('email_events').insert({
        firm_id: send.firm_id,
        email_send_id: sendId,
        type: 'open',
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
        user_agent: req.headers.get('user-agent'),
      });
      if (send.contact_id) {
        await supabase.from('activities').insert({
          firm_id: send.firm_id,
          contact_id: send.contact_id,
          type: 'email_open',
          payload: { email_send_id: sendId },
        });
      }
    }
  }
  return new NextResponse(GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
