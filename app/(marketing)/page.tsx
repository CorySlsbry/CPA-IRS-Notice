import type { Metadata } from 'next';
import { Hero } from '@/components/marketing/hero';
import { LiveDemo } from '@/components/marketing/live-demo';
import { ValueStack } from '@/components/marketing/value-stack';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { CaseStudy } from '@/components/marketing/case-study';
import { RoiCalculator } from '@/components/marketing/roi-calculator';
import { CrmShowcase } from '@/components/marketing/crm-showcase';
import { Comparison } from '@/components/marketing/comparison';
import { FounderStory } from '@/components/marketing/founder';
import { Testimonials } from '@/components/marketing/testimonials';
import { Pricing } from '@/components/marketing/pricing';
import { Faq } from '@/components/marketing/faq';
import { FinalCta } from '@/components/marketing/final-cta';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <ProductSchema />
      <FaqSchema />
      <Hero />
      {/* Per Sabrina §20 "user gets value within 90 seconds" rule — public demo right after hero */}
      <LiveDemo />
      <CaseStudy />
      <ValueStack />
      <HowItWorks />
      {/* Per Sabrina §21 "save time / make money" pitch formula — math up front, before pricing */}
      <RoiCalculator />
      <CrmShowcase />
      <Comparison />
      <FounderStory />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}

function ProductSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'NoticeReply',
    description:
      'AI-drafted IRS notice responses with one-click certified mail. Plus a built-in CRM, email engine, and website analytics for CPA firms.',
    brand: { '@type': 'Brand', name: 'NoticeReply' },
    offers: [
      {
        '@type': 'Offer',
        name: 'Founding tier',
        price: '99',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '99',
          priceCurrency: 'USD',
          unitText: 'MONTH',
        },
      },
      { '@type': 'Offer', name: 'Standard tier', price: '299', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro tier', price: '599', priceCurrency: 'USD' },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function FaqSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is this legal? Are we allowed to send AI-drafted responses to the IRS?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Yes. Every response is reviewed and signed by you, the CPA. NoticeReply is software, just like ProSeries or Lacerte. The CPA remains responsible for the content.',
        },
      },
      {
        '@type': 'Question',
        name: 'How accurate is the notice classification and draft?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Classification accuracy is ~98% on the top 5 notice types in our test set. Anything below 0.6 confidence triggers a CPA-review prompt automatically.',
        },
      },
      {
        '@type': 'Question',
        name: 'What happens if I cancel?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            '30 days of read-only access — every draft, contact, workflow stays viewable. CSV export of everything. Nothing held hostage.',
        },
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
