import { Heading, Link, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function TrialDay11Warning(props: TemplateProps) {
  return (
    <EmailLayout preview="3 days left on your trial" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">3 days left</Heading>
      <Text>If you haven't picked a plan, your trial ends Saturday. No card means no surprise charge — your account just goes read-only.</Text>
      <Text>Founding tier is $99/mo (locked, never raises) and includes the notice tool, 500 CRM contacts, and one workflow. Two notices a month covers it.</Text>
      <Text>
        <Link href="https://noticereply.com/settings/billing" className="font-semibold underline">
          → Pick a plan
        </Link>
      </Text>
      <Text>Or hit reply and tell me what's holding you back. I read everything that comes into this inbox.</Text>
      <Signature />
    </EmailLayout>
  );
}
