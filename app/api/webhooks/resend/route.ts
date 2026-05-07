import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { suppress } from '@/lib/email/deliverability';

export const runtime = 'nodejs';

const eventSchema = z.object({
  type: z.enum([
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.bounced',
    'email.complained',
    'email.opened',
    'email.clicked',
    'email.failed',
  ]),
  data: z.object({
    email_id: z.string().optional(),
    to: z.union([z.string(), z.array(z.string())]).optional(),
    headers: z.record(z.string(), z.string()).optional(),
  }),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const e = parsed.data;
  const messageId = e.data.headers?.['Message-ID'] ?? e.data.headers?.['message-id'];

  if (!messageId) return NextResponse.json({ ok: true });

  const { data: send } = await supabase
    .from('email_sends')
    .select('id, firm_id, contact_id, to_email')
    .eq('message_id', messageId)
    .maybeSingle();
  if (!send) return NextResponse.json({ ok: true });

  switch (e.type) {
    case 'email.delivered':
      await supabase.from('email_sends').update({ delivered_at: new Date().toISOString() }).eq('id', send.id);
      break;
    case 'email.bounced':
      await supabase.from('email_sends').update({ bounced_at: new Date().toISOString() }).eq('id', send.id);
      await suppress(send.firm_id, send.to_email as string, 'bounce', 'resend_webhook');
      break;
    case 'email.complained':
      await supabase.from('email_sends').update({ complained_at: new Date().toISOString() }).eq('id', send.id);
      await suppress(send.firm_id, send.to_email as string, 'complaint', 'resend_webhook');
      break;
    default:
      break;
  }
  return NextResponse.json({ ok: true });
}
