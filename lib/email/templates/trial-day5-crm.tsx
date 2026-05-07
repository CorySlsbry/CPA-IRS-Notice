import { Heading, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function TrialDay5Crm(props: TemplateProps) {
  return (
    <EmailLayout preview="You also have a CRM in there" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">Quick FYI</Heading>
      <Text>You probably noticed the Contacts tab. That's not decoration — it's the same CRM I run my own firm on.</Text>
      <Text>If you're paying HubSpot or ActiveCampaign for taxpayer-client comms, you can dump the CSV in there today and cancel the other one. Same workflows, same email tracking, same analytics. I built it because none of them fit a CPA practice.</Text>
      <Text>Tag a few clients, save a segment ("Q1 1040 filers"), send a one-off broadcast. Tell me what's missing and I'll fix it.</Text>
      <Signature />
    </EmailLayout>
  );
}
