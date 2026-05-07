import { NextResponse } from 'next/server';
import { suppress } from '@/lib/email/deliverability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('t');
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  let firmId = '';
  let email = '';
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    [firmId, email] = decoded.split(':');
  } catch {
    return NextResponse.json({ error: 'bad_token' }, { status: 400 });
  }
  if (!firmId || !email) return NextResponse.json({ error: 'bad_token' }, { status: 400 });

  await suppress(firmId, email, 'unsubscribe', 'one_click');

  return new NextResponse(
    `<!doctype html>
<html><head><meta charset="utf-8"/><title>You're unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 24px;color:#1f2937}h1{font-size:28px;margin:0 0 12px}p{line-height:1.6;color:#4b5563}.btn{display:inline-block;margin-top:16px;padding:10px 18px;background:#1e3a8a;color:#fff;text-decoration:none;border-radius:8px}</style>
</head><body>
<h1>You're unsubscribed.</h1>
<p>${escape(email)} won't get any more email from us. If you change your mind, just reply to a previous one and I'll add you back.</p>
<p><a class="btn" href="/">← Back to NoticeReply</a></p>
<p style="margin-top:48px;font-size:12px;color:#9ca3af">— Cory · Salisbury Bookkeeping</p>
</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
