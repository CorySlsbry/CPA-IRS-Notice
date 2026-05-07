import type { Metadata } from 'next';
import { Pricing } from '@/components/marketing/pricing';
import { Faq } from '@/components/marketing/faq';
import { FinalCta } from '@/components/marketing/final-cta';

export const metadata: Metadata = {
  title: 'Pricing — $99 / $299 / $599',
  description:
    'Founding $99/mo locks for life — first 100 CPA firms only. Standard $299/mo. Pro $599/mo. 14-day free trial, no card.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6 md:pt-24 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">Simple. Locked. Always-on referral.</p>
        <h1 className="mt-2 font-serif text-balance text-4xl md:text-6xl">Pricing that pays for itself in two notices.</h1>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">
          Refer 2 CPAs at any tier and all three of you get 20% off for life. The discount is always available — every tier, every plan, no exclusions.
        </p>
      </div>
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
