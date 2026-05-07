import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type AuthedFirm = {
  firmId: string;
  plan: 'founding' | 'standard' | 'pro';
  rateLimit: number;
};

const RATE_BY_PLAN: Record<string, number> = {
  founding: 60,
  standard: 600,
  pro: 6000,
};

/**
 * Authenticate an external API caller using a per-firm key.
 * Keys are stored hashed (sha256) — only the first 4 + last 4 are visible
 * in the UI for the firm's own reference.
 */
export async function authenticateApiKey(req: Request): Promise<AuthedFirm | null> {
  const auth = req.headers.get('authorization');
  const key = auth?.startsWith('Bearer ') ? auth.slice(7) : req.headers.get('x-api-key');
  if (!key) return null;
  const hash = createHash('sha256').update(key).digest('hex');
  const supabase = getSupabaseAdmin();
  const { data: firm } = await supabase
    .from('firms')
    .select('id, plan')
    .eq('api_key_hash', hash)
    .maybeSingle();
  if (!firm) return null;
  return {
    firmId: firm.id as string,
    plan: (firm.plan as 'founding' | 'standard' | 'pro') ?? 'founding',
    rateLimit: RATE_BY_PLAN[firm.plan as string] ?? 60,
  };
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Naive in-process rate limit. Production swaps for Upstash/Redis.
 * Per-firm sliding window on a per-minute basis.
 */
export function rateLimitOk(firmId: string, perMinute: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(firmId);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(firmId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= perMinute;
}
