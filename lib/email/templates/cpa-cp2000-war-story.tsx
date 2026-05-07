import { Heading, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function CpaCp2000WarStory(props: TemplateProps) {
  return (
    <EmailLayout preview="How a $14K CP2000 became a 6-minute win" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">$14,000 CP2000 — 6 minutes</Heading>
      <Text>Real example from last Tuesday.</Text>
      <Text>Client got a CP2000. IRS said they missed $43K in 1099 income, owed $14,623.42 plus interest. Standard "we matched 1099 to your 1040 and they don't agree" letter.</Text>
      <Text>Old workflow: pull return, find the brokerage 1099 the IRS missed, draft a 2-page response citing IRC §61 + §6201, attach the brokerage statement, sign, scan, mail certified. Easily 90 minutes.</Text>
      <Text>New workflow: snap the front of the notice on my phone. NoticeReply pulled the year, the amount, the IRS reasoning. I dropped in two lines of context ("brokerage 1099 was attached as Schedule D, page 47"). Got the draft back in 47 seconds. Edited two sentences. Clicked Mail. Lob printed + mailed certified that afternoon.</Text>
      <Text>Same fee to the client ($349). Same outcome. 6 minutes of my time instead of 90.</Text>
      <Text>If you want to try it on one of yours, hit reply.</Text>
      <Signature />
    </EmailLayout>
  );
}
