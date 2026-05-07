import { Heading, Link, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function WelcomeOffer(props: TemplateProps) {
  return (
    <EmailLayout preview="14 days, no card. Snap one notice and see." unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">14 days, no card</Heading>
      <Text>If the checklist landed for you, the next step is to actually try the tool.</Text>
      <Text>14-day trial, no card required. You can have your first AI-drafted response back in under a minute. Compare it to one you've already sent. If it's not 80% there, you'll know inside ten minutes.</Text>
      <Text>
        <Link href="https://noticereply.com/signup" className="font-semibold underline">
          → Start the trial
        </Link>
      </Text>
      <Text>That's the last email of this short welcome sequence. After this, I only show up if I have something genuinely useful — usually 1-2x a month.</Text>
      <Signature />
    </EmailLayout>
  );
}
