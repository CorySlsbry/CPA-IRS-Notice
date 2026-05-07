import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  _client = new Anthropic({ apiKey, timeout: 120_000 });
  return _client;
}

export const MODELS = {
  primary: process.env.ANTHROPIC_MODEL_PRIMARY ?? 'claude-sonnet-4-6',
  fallback: process.env.ANTHROPIC_MODEL_FALLBACK ?? 'claude-opus-4-7',
  vision: process.env.ANTHROPIC_MODEL_VISION ?? 'claude-sonnet-4-6',
} as const;

/**
 * Per-1K token pricing in USD (input / cache_read / output) for the
 * models we use. Updated 2026-05; verify before invoicing.
 */
const PRICING: Record<string, { input: number; cacheRead: number; output: number }> = {
  'claude-sonnet-4-6': { input: 0.003, cacheRead: 0.0003, output: 0.015 },
  'claude-opus-4-7': { input: 0.015, cacheRead: 0.0015, output: 0.075 },
  'claude-haiku-4-5': { input: 0.0008, cacheRead: 0.00008, output: 0.004 },
};

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/**
 * Conservative cost estimate. Cache-creation tokens billed at full input
 * rate; cache-read tokens at the discounted rate. Returns dollars.
 */
export function estimateCostUsd(usage: Usage, model = MODELS.primary): number {
  const p = PRICING[model] ?? PRICING['claude-sonnet-4-6']!;
  const cached = usage.cache_read_input_tokens ?? 0;
  const fresh = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0);
  const out = usage.output_tokens;
  return ((fresh / 1000) * p.input) + ((cached / 1000) * p.cacheRead) + ((out / 1000) * p.output);
}

/**
 * Per the landing-page-failures memory: never silently accept a
 * truncated response. Use this guard before persisting any AI output.
 */
export function assertNotTruncated(stopReason: string | null | undefined, ctx: string): void {
  if (stopReason === 'max_tokens') {
    throw new Error(`AI output truncated at max_tokens during ${ctx}. Retry with shorter inputs or higher max_tokens.`);
  }
}
