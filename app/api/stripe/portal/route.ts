import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = z.object({ firmId: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: firm } = await admin
    .from('firms')
    .select('id, stripe_customer_id')
    .eq('id', parsed.data.firmId)
    .single();
  if (!firm?.stripe_customer_id) return NextResponse.json({ error: 'no_customer' }, { status: 400 });

  const portal = await getStripe().billingPortal.sessions.create({
    customer: firm.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
