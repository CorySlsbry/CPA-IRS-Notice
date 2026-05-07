/**
 * COMPATIBILITY SHIM (post-migration to Cloud SQL Postgres + Firebase Auth).
 *
 * `createSupabaseServerClient()` used to return a Supabase server client
 * with a session-aware cookie reader. Now it returns a minimal compatible
 * surface: query-builder methods backed by Cloud SQL, plus a `.auth.getUser()`
 * that verifies the Firebase session cookie.
 *
 * Consumer call shape stays:
 *   const sb = await createSupabaseServerClient();
 *   const { data: { user } } = await sb.auth.getUser();
 *   const { data } = await sb.from('contacts').select(...).eq(...);
 */

import { getPool } from '@/lib/db/pool';
import { clientFor, type QueryBuilderClient } from '@/lib/db/query-builder';
import { getCurrentUser } from '@/lib/auth/session';
import type { SessionUser } from '@/lib/auth/firebase-admin';

export type ServerClient = QueryBuilderClient & {
  auth: {
    getUser(): Promise<{ data: { user: { id: string; email: string | null } | null }; error: null }>;
  };
};

export async function createSupabaseServerClient(): Promise<ServerClient> {
  const builder = clientFor(getPool());
  return {
    ...builder,
    auth: {
      async getUser() {
        const u: SessionUser | null = await getCurrentUser();
        if (!u) return { data: { user: null }, error: null };
        // Map Firebase UID to our `users.id` (uuid). users.firebase_uid is unique.
        // Cache lookup hits a single query — cheap.
        const lookup = await builder.from('users').select('id, email').eq('firebase_uid', u.uid).maybeSingle();
        const row = lookup.data as { id: string; email: string | null } | null;
        if (!row) return { data: { user: null }, error: null };
        return { data: { user: { id: row.id, email: row.email } }, error: null };
      },
    },
  };
}
