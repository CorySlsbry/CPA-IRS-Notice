import { Heading, Link, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function TrialDay14Close(props: TemplateProps) {
  return (
    <EmailLayout preview="Your trial just ended — here is what unlocks" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">Trial's done</Heading>
      <Text>Your read-only access stays for 30 days — every draft, every contact, every workflow. Nothing's gone.</Text>
      <Text>If you upgrade, everything turns back on. Founding tier is $99/mo and locks for life.</Text>
      <Text>
        <Link href="https://noticereply.com/settings/billing" className="font-semibold underline">
          → Reactivate
        </Link>
      </Text>
      <Text>If it wasn't a fit, I'd love a one-line reply on what was missing. That's how the next version gets better.</Text>
      <Signature />
    </EmailLayout>
  );
}
