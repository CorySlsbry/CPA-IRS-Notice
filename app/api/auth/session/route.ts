import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createSessionCookie } from '@/lib/auth/firebase-admin';
import { sessionCookieName, sessionCookieOptions } from '@/lib/auth/session';

export const runtime = 'nodejs';

const inputSchema = z.object({ idToken: z.string().min(20) });

export async function POST(req: Request) {
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  const cookie = await createSessionCookie(parsed.data.idToken);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, cookie, sessionCookieOptions);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  return NextResponse.json({ ok: true });
}
