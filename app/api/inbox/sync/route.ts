import { NextResponse } from 'next/server';
import { syncInbox } from '@/lib/email/gmail';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await syncInbox(50);
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
