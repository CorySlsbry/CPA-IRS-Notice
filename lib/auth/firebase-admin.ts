import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let _app: App | null = null;
let _auth: Auth | null = null;

/**
 * Firebase Admin SDK singleton. Credentials come from one of:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env (path to JSON) — Cloud Run sets this automatically when a service account is attached
 *   2. FIREBASE_SERVICE_ACCOUNT env (full JSON inline) — local dev
 *   3. Cloud Run default credentials (recommended in production)
 */
function getApp(): App {
  if (_app) return _app;
  const apps = getApps();
  if (apps.length > 0) {
    _app = apps[0]!;
    return _app;
  }
  const inlineCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inlineCreds) {
    const parsed = JSON.parse(inlineCreds) as { project_id: string; client_email: string; private_key: string };
    _app = initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      }),
      projectId: parsed.project_id,
    });
    return _app;
  }
  // Falls back to Application Default Credentials (Cloud Run, gcloud auth).
  _app = initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID,
  });
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getApp());
  return _auth;
}

export type SessionUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/**
 * Verify a Firebase session cookie and return the authenticated user.
 * Returns null on any failure (invalid token, expired, revoked).
 */
export async function verifySessionCookie(cookie: string | undefined): Promise<SessionUser | null> {
  if (!cookie) return null;
  try {
    const decoded = await getFirebaseAuth().verifySessionCookie(cookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified ?? false,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null,
    };
  } catch {
    return null;
  }
}

/** Mint a session cookie from a Firebase ID token. */
export async function createSessionCookie(idToken: string, expiresInMs: number = 14 * 24 * 60 * 60 * 1000): Promise<string> {
  return getFirebaseAuth().createSessionCookie(idToken, { expiresIn: expiresInMs });
}
