/**
 * Token auth for /api/integrations/jarvis/*. Accepts EITHER:
 *   - `X-Jarvis-Token: <token>` (preferred)
 *   - `Authorization: Bearer <token>` (back-compat with original spec)
 *
 * Why both: Cloud Run's frontend proxy intercepts requests carrying
 * `Authorization: Bearer ...` when the token doesn't validate as a Google
 * ID token, returning 502 BEFORE the container sees the request — even
 * with allUsers/run.invoker on the service. The custom header routes
 * around this entirely.
 */
export function checkJarvisToken(
  req: Request,
): { ok: true } | { ok: false; status: number; body: Record<string, unknown> } {
  const expected = process.env.JARVIS_INGEST_TOKEN;
  if (!expected) {
    return { ok: false, status: 503, body: { error: 'jarvis_token_not_configured' } };
  }
  const fromCustom = req.headers.get('x-jarvis-token');
  const fromAuth = req.headers.get('authorization');
  let token: string | null = null;
  if (fromCustom) token = fromCustom.trim();
  else if (fromAuth && fromAuth.startsWith('Bearer ')) token = fromAuth.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, status: 401, body: { error: 'missing_token', detail: 'send X-Jarvis-Token header' } };
  }
  if (token !== expected) {
    return { ok: false, status: 401, body: { error: 'invalid_token' } };
  }
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the firm_id Jarvis leads land in. Single-tenant for now.
 * Validates UUID format so a placeholder ("TODO_set_after_first_signup")
 * doesn't pass through and explode at the SQL layer with a cast error.
 */
export function getJarvisDefaultFirmId(): string | null {
  const raw = process.env.JARVIS_DEFAULT_FIRM_ID ?? process.env.MARKETING_FIRM_ID ?? null;
  if (!raw) return null;
  if (!UUID_RE.test(raw)) return null;
  return raw;
}

/** Stop tags per vertical — operator-curated. */
export const VERTICAL_ROUTING = {
  cpa_irs_notices: {
    triggerTag: 'cpa-irs-cold-queue',
    stopTags: ['cpa-irs-booked-call', 'cpa-irs-client', 'cpa-irs-lost', 'do-not-contact'] as const,
    /** Active band signals which stage of the chain a contact is in. */
    bandTags: {
      short: 'cpa-irs-cold-queue',
      long: 'cpa-irs-short-nurture-complete',
      evergreen: 'cpa-irs-long-nurture-complete',
    },
  },
} as const;

export type Vertical = keyof typeof VERTICAL_ROUTING;

export function isKnownVertical(v: string): v is Vertical {
  return v in VERTICAL_ROUTING;
}
