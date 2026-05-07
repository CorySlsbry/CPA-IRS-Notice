import { Heading, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function TrialDay9Workflow(props: TemplateProps) {
  return (
    <EmailLayout preview="Build your first workflow (steal mine)" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">Steal this workflow</Heading>
      <Text>Mid-trial. Quick one.</Text>
      <Text>Here's the workflow that's saved my practice the most billable hours: <strong>"New notice uploaded → notify client → 3-day check-in."</strong></Text>
      <Text>Trigger: notice uploaded. Action 1: send the client a templated "we've got it, drafting now" email. Wait 3 days. Action 2: if response not mailed, ping me. That's it.</Text>
      <Text>Took me 4 minutes to build in the visual editor. It's been running 8 months without me touching it.</Text>
      <Text>Open Workflows → New → drop the same nodes in. Or copy mine — there's a "Notice client comms" starter on your dashboard.</Text>
      <Signature />
    </EmailLayout>
  );
}
