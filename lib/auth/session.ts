import { cookies } from 'next/headers';
import { verifySessionCookie, type SessionUser } from './firebase-admin';

const SESSION_COOKIE_NAME = '__Secure-nr-session';

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionCookie(cookie);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthorized');
  return user;
}

export const sessionCookieName = SESSION_COOKIE_NAME;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 14 * 24 * 60 * 60,
};
