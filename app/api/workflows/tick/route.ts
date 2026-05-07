import { NextResponse } from 'next/server';
import { tickWorkflows } from '@/lib/workflows/runner';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await tickWorkflows({ limit: 200 });
  return NextResponse.json(result);
}

// Vercel Cron sends GET requests with the auth header.
export async function GET(req: Request) {
  return POST(req);
}
