import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata = { title: 'Billing' };

export default async function BillingPage() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: membership } = await sb
    .from('firm_users')
    .select('firms(id, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const firm = membership?.firms as
    | { id: string; plan: string; trial_ends_at: string; stripe_customer_id: string | null; stripe_subscription_id: string | null }
    | null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl">Billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">Plan, payment, invoices.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Current plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <Badge variant="gold">{firm?.plan ?? 'founding'}</Badge>
            {firm?.trial_ends_at && new Date(firm.trial_ends_at).getTime() > Date.now() && (
              <span className="ml-3 text-muted-foreground">
                Trial ends {new Date(firm.trial_ends_at).toLocaleDateString()}
              </span>
            )}
          </p>
          {firm?.stripe_subscription_id ? (
            <form action="/api/stripe/portal" method="post">
              <input type="hidden" name="firmId" value={firm.id} />
              <Button type="submit" variant="default">
                Open Stripe billing portal
              </Button>
            </form>
          ) : (
            <form action="/api/stripe/checkout" method="post">
              <input type="hidden" name="firmId" value={firm?.id ?? ''} />
              <input type="hidden" name="plan" value="founding" />
              <Button type="submit" variant="gold">
                Subscribe to Founding ($99/mo)
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Refer-2-for-20%</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Refer 2 CPAs and all three of you get 20% off — for life. Always available, every tier.</p>
          <p className="text-muted-foreground">Share your referral link from any signup or pricing page.</p>
        </CardContent>
      </Card>
    </div>
  );
}
