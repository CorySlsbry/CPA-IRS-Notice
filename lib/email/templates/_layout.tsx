import { Body, Container, Head, Html, Preview, Tailwind, Text } from '@react-email/components';
import type { ReactNode } from 'react';

export type EmailLayoutProps = {
  preview: string;
  unsubUrl: string;
  children: ReactNode;
};

/**
 * Plain, conversational email shell. No banner image, no branded chrome —
 * Cory's nurture sequences need to look like a real CPA wrote them, not
 * a marketing-automation drip. Per memory: "max 1 image, conversational."
 */
export function EmailLayout({ preview, unsubUrl, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans text-[16px] leading-relaxed text-neutral-900">
          <Container className="mx-auto max-w-[560px] px-6 py-8">
            {children}
            <Text className="mt-10 text-[12px] leading-snug text-neutral-500">
              Salisbury Bookkeeping · 1234 Tax Lane · Tucson, AZ 85701
              <br />
              You can{' '}
              <a href={unsubUrl} className="text-neutral-500 underline">
                unsubscribe
              </a>{' '}
              any time. I read every reply.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export function Signature() {
  return (
    <Text className="mt-6">
      — Cory
      <br />
      Salisbury Bookkeeping
      <br />
      <a href="mailto:support@salisburybookkeeping.com" className="text-neutral-700 underline">
        support@salisburybookkeeping.com
      </a>
      <br />
      <span className="text-neutral-500">P.S. Reply to this email — I read every one.</span>
    </Text>
  );
}
