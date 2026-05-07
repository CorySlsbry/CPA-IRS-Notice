import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirebaseAuth } from '@/lib/auth/firebase-admin';
import { tx } from '@/lib/db/pool';

export const runtime = 'nodejs';

const inputSchema = z.object({
  idToken: z.string().min(20),
  metadata: z
    .object({
      firm_name: z.string().optional(),
      signer_name: z.string().optional(),
      initial_plan: z.enum(['founding', 'standard', 'pro']).optional(),
    })
    .partial()
    .optional(),
});

/**
 * First-time-signup bootstrap: verify the Firebase ID token, then create
 * the `users` row + a personal `firms` row + 3 starter workflows.
 *
 * Replaces the Postgres `handle_new_user` trigger that fired on
 * `auth.users` insert — which doesn't exist outside Supabase.
 */
export async function POST(req: Request) {
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const decoded = await getFirebaseAuth().verifyIdToken(parsed.data.idToken);
  const meta = parsed.data.metadata ?? {};
  const fallbackFirmName = `${(decoded.email ?? 'firm').split('@')[0]} CPA`;

  const result = await tx(async (client) => {
    // Idempotent: do nothing if this firebase_uid is already provisioned.
    const existing = await client.query<{ id: string }>(
      'select id from users where firebase_uid = $1',
      [decoded.uid],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return { firmId: null, userId: existing.rows[0]!.id, alreadyProvisioned: true };
    }

    // Create the user row.
    const userInsert = await client.query<{ id: string }>(
      'insert into users (firebase_uid, email, full_name) values ($1, $2, $3) returning id',
      [decoded.uid, decoded.email ?? null, meta.signer_name ?? decoded.name ?? null],
    );
    const userId = userInsert.rows[0]!.id;

    // Create the firm.
    const firmInsert = await client.query<{ id: string }>(
      `insert into firms (name, slug, default_signer_name, plan)
       values ($1, substring(md5($2 || extract(epoch from now())::text), 1, 12), $3, 'founding')
       returning id`,
      [meta.firm_name ?? fallbackFirmName, decoded.uid, meta.signer_name ?? null],
    );
    const firmId = firmInsert.rows[0]!.id;

    await client.query(
      "insert into firm_users (firm_id, user_id, role) values ($1, $2, 'owner')",
      [firmId, userId],
    );

    // Seed default pipeline + tags + 3 starter workflows.
    await client.query('select seed_starter_assets($1)', [firmId]);

    return { firmId, userId, alreadyProvisioned: false };
  });

  return NextResponse.json(result);
}
