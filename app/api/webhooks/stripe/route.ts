import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const stripe = getStripe();
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: 'missing_signature' }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `invalid_signature: ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const plan = priceId === process.env.STRIPE_PRICE_PRO ? 'pro' : priceId === process.env.STRIPE_PRICE_STANDARD ? 'standard' : 'founding';
      await supabase
        .from('firms')
        .update({ plan, stripe_subscription_id: sub.id })
        .eq('stripe_customer_id', sub.customer as string);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from('firms')
        .update({ stripe_subscription_id: null })
        .eq('stripe_customer_id', sub.customer as string);
      break;
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.client_reference_id) {
        await supabase
          .from('firms')
          .update({ stripe_customer_id: session.customer as string })
          .eq('id', session.client_reference_id);
      }
      break;
    }
    default:
      // Other events — accept but no-op.
      break;
  }

  return NextResponse.json({ received: true });
}
