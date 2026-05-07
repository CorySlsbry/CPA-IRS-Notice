import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UAParser } from 'ua-parser-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const inputSchema = z.object({
  firmId: z.string().uuid(),
  anonId: z.string().min(8),
  sessionId: z.string().min(8),
  contactId: z.string().uuid().nullable().optional(),
  url: z.string().url(),
  path: z.string(),
  title: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
  utms: z.record(z.string(), z.string()).optional(),
  ts: z.string(),
});

export async function POST(req: Request) {
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const v = parsed.data;
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  const ua = new UAParser(req.headers.get('user-agent') ?? '').getResult();

  // Find or create the session row.
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('firm_id', v.firmId)
    .eq('anon_id', v.anonId)
    .gte('started_at', new Date(Date.now() - 30 * 60_000).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let sessionId = existing?.id as string | undefined;
  if (!sessionId) {
    const { data: created } = await supabase
      .from('sessions')
      .insert({
        firm_id: v.firmId,
        anon_id: v.anonId,
        contact_id: v.contactId ?? null,
        utm_source: v.utms?.utm_source,
        utm_medium: v.utms?.utm_medium,
        utm_campaign: v.utms?.utm_campaign,
        utm_term: v.utms?.utm_term,
        utm_content: v.utms?.utm_content,
        referrer: v.referrer,
        landing_path: v.path,
        device: ua.device.type ?? 'desktop',
        browser: ua.browser.name,
        os: ua.os.name,
        ip_truncated: truncateIp(ip ?? ''),
      })
      .select('id')
      .single();
    sessionId = created?.id;
  }

  if (sessionId) {
    await supabase.from('pageviews').insert({
      firm_id: v.firmId,
      session_id: sessionId,
      url: v.url,
      path: v.path,
      title: v.title ?? null,
      referrer: v.referrer ?? null,
    });
    if (v.contactId) {
      await supabase.from('activities').insert({
        firm_id: v.firmId,
        contact_id: v.contactId,
        type: 'page_view',
        payload: { path: v.path, url: v.url },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

/** GDPR: store /24 for IPv4, /48 for IPv6. Sufficient for geo, insufficient to identify. */
export function truncateIp(ip: string): string {
  if (!ip) return '';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 3).join(':') + '::';
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return ip;
}
