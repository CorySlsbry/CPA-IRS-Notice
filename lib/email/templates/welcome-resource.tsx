import { Heading, Link, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function WelcomeResource(props: TemplateProps) {
  return (
    <EmailLayout preview="The 5-minute notice triage checklist (PDF)" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">Triage checklist (PDF)</Heading>
      <Text>The thing I wish I had on my desk every time a client walked in with an IRS letter.</Text>
      <Text>One page. Five steps. Tells you in under five minutes whether you're looking at a "drop everything" notice or one that can wait until next Tuesday.</Text>
      <Text>
        <Link href="https://noticereply.com/checklist.pdf" className="font-semibold underline">
          → Download the checklist
        </Link>
      </Text>
      <Text>Print it, pin it. Reply if you spot something I missed.</Text>
      <Signature />
    </EmailLayout>
  );
}
