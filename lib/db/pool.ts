import { Pool, type PoolClient } from 'pg';

/**
 * Cloud SQL Postgres pool. Two connection strategies are supported:
 *
 * 1. Cloud Run with Cloud SQL Auth Proxy (recommended):
 *    Set DATABASE_URL=postgres://app:<pwd>@/noticereply?host=/cloudsql/<INSTANCE>
 *    Cloud Run mounts the Unix socket at /cloudsql/<INSTANCE> automatically
 *    when the cloudsql-instances annotation is present.
 *
 * 2. Local dev / direct TCP:
 *    Set DATABASE_URL=postgres://app:<pwd>@127.0.0.1:5432/noticereply
 *    (run `cloud-sql-proxy <INSTANCE> --port 5432` in a separate terminal)
 *
 * The pool is shared across all server-side code paths.
 */

let _pool: Pool | null = null;

/**
 * Returns the Pool, lazily constructing it on first use. We deliberately do
 * NOT throw at module-import time, because Next.js evaluates server modules
 * at build/prerender time when DATABASE_URL is intentionally absent. The
 * error is deferred until an actual query — which the (app) routes only
 * reach at request time, after Cloud Run has injected the secret.
 */
export function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL missing — set it via Secret Manager (production) or .env.local (dev)',
    );
  }
  _pool = new Pool({
    connectionString,
    max: parseInt(process.env.DATABASE_MAX_CONNECTIONS ?? '5', 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'noticereply',
  });
  _pool.on('error', (err) => {
    console.error('[db.pool] idle client error', err);
  });
  return _pool;
}

/** Generic parameterized query helper. Returns rows. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(sql, [...params]);
  return result.rows;
}

/** Run a callback inside a transaction; auto-commits on success, rolls back on throw. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
