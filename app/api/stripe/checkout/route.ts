import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe, PRICE_IDS, type Plan } from '@/lib/stripe/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const inputSchema = z.object({
  plan: z.enum(['founding', 'standard', 'pro']),
  firmId: z.string().uuid(),
});

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const { data: membership } = await sb
    .from('firm_users')
    .select('role, firm_id')
    .eq('user_id', user.id)
    .eq('firm_id', parsed.data.firmId)
    .maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role as string)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data: firm } = await admin
    .from('firms')
    .select('id, name, stripe_customer_id')
    .eq('id', parsed.data.firmId)
    .single();
  if (!firm) return NextResponse.json({ error: 'firm_not_found' }, { status: 404 });

  const stripe = getStripe();
  let customerId = firm.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: firm.name,
      metadata: { firm_id: firm.id, supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin.from('firms').update({ stripe_customer_id: customerId }).eq('id', firm.id);
  }

  const priceId = PRICE_IDS[parsed.data.plan as Plan];
  if (!priceId) {
    return NextResponse.json({ error: 'price_not_configured' }, { status: 500 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: firm.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 14 },
    allow_promotion_codes: true,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
