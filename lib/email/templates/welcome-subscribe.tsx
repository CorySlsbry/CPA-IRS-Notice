import { Heading, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function WelcomeSubscribe(props: TemplateProps) {
  return (
    <EmailLayout preview="You are in. Here is what to expect." unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">You're in</Heading>
      <Text>Quick map of what shows up in this inbox:</Text>
      <Text>1. The 5-minute notice triage checklist (PDF) — coming Friday.</Text>
      <Text>2. A short story about a CP2000 that almost cost a client $14K — coming Tuesday.</Text>
      <Text>3. An offer to try the tool free for 14 days — only if you want it.</Text>
      <Text>That's the whole sequence. If you ever want out, the unsubscribe is at the bottom and works in one click.</Text>
      <Signature />
    </EmailLayout>
  );
}
