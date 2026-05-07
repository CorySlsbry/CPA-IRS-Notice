/**
 * COMPATIBILITY SHIM (post-migration to Firebase Auth).
 *
 * Original `createSupabaseBrowserClient()` returned a Supabase JS client
 * with `.auth.signUp`, `.auth.signInWithPassword`, `.auth.signOut`, and
 * `.from(...)` for client-side reads. We replace those with:
 *   - Firebase Auth client SDK for auth methods
 *   - Stub channel/removeChannel for the realtime-replaced code path
 *
 * Most callers use only the .auth.* methods, which are wired below.
 */

'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseClientAuth } from '@/lib/auth/firebase-client';

type SignInResult =
  | { data: { user: { id: string; email: string | null }; session: { idToken: string } }; error: null }
  | { data: { user: null; session: null }; error: { message: string } };

type SignUpResult = SignInResult;

type SignOutResult = { error: null } | { error: { message: string } };

type AuthGetUserResult = {
  data: { user: { id: string; email: string | null } | null };
  error: null;
};

async function mintServerSession(idToken: string): Promise<void> {
  const r = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) throw new Error('failed to start session');
}

function asAuthUser(user: FirebaseUser): { id: string; email: string | null } {
  return { id: user.uid, email: user.email };
}

export type BrowserClient = {
  auth: {
    signUp(args: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }): Promise<SignUpResult>;
    signInWithPassword(args: { email: string; password: string }): Promise<SignInResult>;
    signOut(): Promise<SignOutResult>;
    getUser(): Promise<AuthGetUserResult>;
  };
  /** Channel API kept as a no-op surface for the realtime-replaced code path. */
  channel(_name: string): {
    on(_event: string, _config: unknown, _cb: (...args: unknown[]) => void): { subscribe(): { unsubscribe(): void } };
  };
  removeChannel(_channel: unknown): void;
};

export function createSupabaseBrowserClient(): BrowserClient {
  const auth = getFirebaseClientAuth();
  return {
    auth: {
      async signUp({ email, password, options }) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          const idToken = await cred.user.getIdToken();
          await fetch('/api/auth/bootstrap', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ idToken, metadata: options?.data ?? {} }),
          });
          await mintServerSession(idToken);
          return {
            data: { user: asAuthUser(cred.user), session: { idToken } },
            error: null,
          };
        } catch (err) {
          return { data: { user: null, session: null }, error: { message: (err as Error).message } };
        }
      },

      async signInWithPassword({ email, password }) {
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          const idToken = await cred.user.getIdToken();
          await mintServerSession(idToken);
          return {
            data: { user: asAuthUser(cred.user), session: { idToken } },
            error: null,
          };
        } catch (err) {
          return { data: { user: null, session: null }, error: { message: (err as Error).message } };
        }
      },

      async signOut() {
        try {
          await fbSignOut(auth);
          await fetch('/api/auth/session', { method: 'DELETE' });
          return { error: null };
        } catch (err) {
          return { error: { message: (err as Error).message } };
        }
      },

      async getUser() {
        const u = auth.currentUser;
        return { data: { user: u ? asAuthUser(u) : null }, error: null };
      },
    },

    channel() {
      return {
        on() {
          return { subscribe: () => ({ unsubscribe: () => {} }) };
        },
      };
    },
    removeChannel() {},
  };
}
