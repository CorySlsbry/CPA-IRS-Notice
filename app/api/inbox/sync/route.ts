import { NextResponse } from 'next/server';
import { syncInbox } from '@/lib/email/gmail';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // No-op when Gmail OAuth isn't configured yet. The Cloud Scheduler job
  // runs every minute regardless; without these env vars the route would
  // throw and produce noisy 500s in Cloud Logging.
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_OAUTH_CLIENT_ID) {
    return NextResponse.json({ skipped: 'gmail_oauth_not_configured', processed: 0, matched: 0 });
  }
  const result = await syncInbox(50);
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
