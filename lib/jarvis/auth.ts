/**
 * Bearer-token auth for /api/integrations/jarvis/*. The token is rotated
 * out-of-band — Jarvis side has its own JARVIS_INGEST_TOKEN env var that
 * must match.
 */

export function checkJarvisToken(req: Request): { ok: true } | { ok: false; status: number; body: { error: string } } {
  const expected = process.env.JARVIS_INGEST_TOKEN;
  if (!expected) {
    return { ok: false, status: 503, body: { error: 'jarvis_token_not_configured' } };
  }
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return { ok: false, status: 401, body: { error: 'missing_bearer' } };
  }
  const token = auth.slice('Bearer '.length).trim();
  if (token !== expected) {
    return { ok: false, status: 401, body: { error: 'invalid_token' } };
  }
  return { ok: true };
}

/** Resolve the firm_id Jarvis leads land in. Single-tenant for now. */
export function getJarvisDefaultFirmId(): string | null {
  return process.env.JARVIS_DEFAULT_FIRM_ID ?? process.env.MARKETING_FIRM_ID ?? null;
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
