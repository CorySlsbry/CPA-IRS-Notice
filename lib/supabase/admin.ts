/**
 * COMPATIBILITY SHIM (post-migration to Cloud SQL Postgres + Firebase Auth).
 *
 * This file used to expose a Supabase service-role client. Now it returns a
 * tiny Supabase-compatible query builder backed by `pg` (lib/db/) so the
 * 40+ consumer files don't have to change shape. The function name is kept
 * as `getSupabaseAdmin()` to minimize diff churn — the underlying transport
 * is Cloud SQL Postgres via lib/db.
 */

import { getPool } from '@/lib/db/pool';
import { clientFor, type QueryBuilderClient } from '@/lib/db/query-builder';

export function getSupabaseAdmin(): QueryBuilderClient {
  return clientFor(getPool());
}
