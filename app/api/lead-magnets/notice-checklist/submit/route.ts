import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { truncateIp } from '@/app/api/track/visit/route';

export const runtime = 'nodejs';

const inputSchema = z.object({
  email: z.string().email().max(254),
  firmName: z.string().max(120).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://noticereply.com';

export async function POST(req: Request) {
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  const { email, firmName, source } = parsed.data;
  const lower = email.toLowerCase();

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
  const ua = req.headers.get('user-agent') ?? '';

  // 1. Persist to lead_magnet_signups (idempotent on (magnet, email))
  const supabase = getSupabaseAdmin();
  await supabase
    .from('lead_magnet_signups')
    .upsert(
      {
        magnet_id: 'notice-checklist',
        email: lower,
        firm_name: firmName ?? null,
        source: source ?? null,
        utm_source: source ?? null,
        ip_truncated: truncateIp(ip),
        user_agent: ua.slice(0, 500),
      },
      { onConflict: 'magnet_id,email', ignoreDuplicates: true },
    );

  // 2. Send the checklist link via Resend (no firm context required)
  // The "Welcome new subscriber" workflow runs only after the cron
  // imports the contact into a firm — see scripts/import-lead-magnets.sh
  // (or the daily import handler /api/cron/import-lead-magnets).
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const apex = process.env.RESEND_TRANSACTIONAL_DOMAIN || 'salisburybookkeeping.com';
    const fromName = process.env.DEFAULT_FROM_NAME || 'Cory @ Salisbury Bookkeeping';
    const fromUser = (process.env.DEFAULT_FROM_EMAIL || 'support@salisburybookkeeping.com').split('@')[0];

    const text = `Hi ${firmName ? firmName.split(',')[0] : 'there'} —

Here's the checklist:
${SITE}/checklist

One page. Five steps. Tells you in under five minutes whether the notice
on your desk is "drop everything" or one that can wait until next Tuesday.

Quick context: I built NoticeReply because I got tired of drafting the same
five notice responses thirty times a quarter. The checklist is the manual
version I used before the tool existed — still useful even if you don't try
the trial.

If you do want to see the tool run on a real CP2000, the demo is at
${SITE}/#demo (no signup, no card).

Hit reply with questions. I read every one that comes into this inbox.

— Cory
Salisbury Bookkeeping
`;

    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: `${fromName} <${fromUser}@${apex}>`,
        to: [lower],
        replyTo: `${fromUser}@${apex}`,
        subject: 'The 5-Minute IRS Notice Triage Checklist (PDF)',
        text,
        headers: {
          'List-Unsubscribe': `<mailto:${fromUser}@${apex}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        tags: [
          { name: 'category', value: 'lead_magnet' },
          { name: 'magnet', value: 'notice-checklist' },
        ],
      });
    } catch (err) {
      // Log but don't fail the response — the visitor still gets the link in the UI redirect.
      console.error('[lead-magnets] resend send failed', err);
    }
  }

  return NextResponse.json({ ok: true });
}
