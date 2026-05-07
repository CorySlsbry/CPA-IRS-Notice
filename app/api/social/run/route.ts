import { NextResponse } from 'next/server';
import { tickSocialQueue } from '@/lib/social/post-runner';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron-driven scheduled-post runner. Cloud Scheduler hits this every
 * minute alongside the workflow tick.
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await tickSocialQueue({ limit: 100 });
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
