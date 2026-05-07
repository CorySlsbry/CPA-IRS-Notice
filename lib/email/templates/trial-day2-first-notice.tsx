import { Heading, Link, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function TrialDay2FirstNotice(props: TemplateProps) {
  return (
    <EmailLayout preview="Snap your first notice (2-min walkthrough)" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">2 minutes — first notice</Heading>
      <Text>If you haven't run a notice through yet, here's exactly what I do:</Text>
      <Text>1. Snap the front page with your phone (camera, not scanner — works fine).</Text>
      <Text>2. Drop it on the dashboard. Pick the strategy from the dropdown.</Text>
      <Text>3. Read the draft. Edit anything you don't like. Click Mail.</Text>
      <Text>The only step that takes brainpower is step 3 — and that's the part where you actually earn the fee.</Text>
      <Text>
        <Link href="https://noticereply.com/dashboard" className="font-semibold underline">
          → Open the dashboard
        </Link>
      </Text>
      <Signature />
    </EmailLayout>
  );
}
