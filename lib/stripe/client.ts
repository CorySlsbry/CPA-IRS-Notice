import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  _stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia', typescript: true });
  return _stripe;
}

export const PRICE_IDS = {
  founding: process.env.STRIPE_PRICE_FOUNDING ?? '',
  standard: process.env.STRIPE_PRICE_STANDARD ?? '',
  pro: process.env.STRIPE_PRICE_PRO ?? '',
} as const;

export type Plan = keyof typeof PRICE_IDS;

export const PLAN_DETAILS: Record<Plan, { price: number; name: string; tag?: string }> = {
  founding: { price: 99, name: 'Founding', tag: 'Locks for life' },
  standard: { price: 299, name: 'Standard', tag: 'Most popular' },
  pro: { price: 599, name: 'Pro' },
};
