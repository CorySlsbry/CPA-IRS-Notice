import { tx, query } from '@/lib/db/pool';

/**
 * Token encryption for social_accounts. Tokens are written with
 * pgp_sym_encrypt(token, key) where the key comes from the
 * SOCIAL_TOKEN_KEY env var (which Cloud Run reads from Secret Manager).
 *
 * The key is passed via SET LOCAL app.token_key inside a transaction so
 * it's only visible to the encryption function and never logged.
 */
function getTokenKey(): string {
  const key = process.env.SOCIAL_TOKEN_KEY;
  if (!key) {
    throw new Error(
      'SOCIAL_TOKEN_KEY missing — set it in Secret Manager. Generate with: openssl rand -base64 64',
    );
  }
  return key;
}

/** Encrypt + write the access token + (optional) refresh token for an account. */
export async function setAccountTokens(
  accountId: string,
  args: { accessToken: string; refreshToken?: string; expiresAt?: Date },
): Promise<void> {
  await tx(async (client) => {
    await client.query(`set local app.token_key = $1`, [getTokenKey()]);
    await client.query(
      `update social_accounts
         set access_token_encrypted = pgp_sym_encrypt($2::text, current_setting('app.token_key')),
             refresh_token_encrypted = case when $3::text is not null
               then pgp_sym_encrypt($3::text, current_setting('app.token_key'))
               else refresh_token_encrypted end,
             expires_at = $4,
             status = 'connected',
             updated_at = now()
       where id = $1`,
      [accountId, args.accessToken, args.refreshToken ?? null, args.expiresAt ?? null],
    );
  });
}

/** Read a decrypted access token. Server-side only, never returned to the browser. */
export async function getAccessToken(accountId: string): Promise<string | null> {
  return tx(async (client) => {
    await client.query(`set local app.token_key = $1`, [getTokenKey()]);
    const r = await client.query<{ token: string | null }>(
      `select pgp_sym_decrypt(access_token_encrypted, current_setting('app.token_key'))::text as token
         from social_accounts
        where id = $1`,
      [accountId],
    );
    return r.rows[0]?.token ?? null;
  });
}

/** Mark an account expired/revoked when an API call returns 401. */
export async function markAccountStatus(
  accountId: string,
  status: 'expired' | 'revoked' | 'paused' | 'connected',
): Promise<void> {
  await query(`update social_accounts set status = $2, updated_at = now() where id = $1`, [accountId, status]);
}
