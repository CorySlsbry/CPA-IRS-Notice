import { Heading, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function CpaIntro(props: TemplateProps) {
  const firstName = (props.contact.first_name as string | undefined) ?? 'there';
  const firmName = (props.contact.company_name as string | undefined) ?? 'your firm';
  return (
    <EmailLayout preview="Quick question from another small CPA shop" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">{firstName} — quick one</Heading>
      <Text>I'm Cory. I run Salisbury Bookkeeping (small shop, mostly small-biz tax + bookkeeping in Tucson + Phoenix) and I built a tool I think {firmName} could use.</Text>
      <Text>Half-context: my partners and I were drafting the same five notice responses 30 times a quarter. CP2000s, CP14s, the works. So I trained Claude on the IRC citations, hooked up Lob for certified mail, and now we draft → mail in 6 minutes flat.</Text>
      <Text>Now I'm letting other CPA firms use it. $99/mo founding tier. You snap the notice, AI drafts the response, you review and click Mail. Lob prints + mails certified.</Text>
      <Text>Not pitching — just curious if it'd save you any time. Reply and I'll send a 2-minute Loom of it running on a real CP2000.</Text>
      <Signature />
    </EmailLayout>
  );
}
