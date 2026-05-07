import { Heading, Text } from '@react-email/components';
import { EmailLayout, Signature } from './_layout';
import type { TemplateProps } from './render';

export function TrialDay0Welcome(props: TemplateProps) {
  const firstName = (props.contact.first_name as string | undefined) ?? 'there';
  return (
    <EmailLayout
      preview="Welcome to NoticeReply — start with one notice"
      unsubUrl={props.unsubUrl}
    >
      <Heading className="text-[20px] font-semibold">Welcome, {firstName}.</Heading>
      <Text>I'm Cory. I run Salisbury Bookkeeping out of Tucson and built NoticeReply because I got tired of spending 90 minutes drafting a CP2000 response that I'd already drafted 40 times before.</Text>
      <Text>Your trial gives you 14 days, no card. Here's the only thing I'd ask you to do today:</Text>
      <Text className="font-semibold">Snap a photo of one IRS notice — any notice you've already replied to — and run it through.</Text>
      <Text>You'll see your draft come back in under 60 seconds with the IRC citations already inline. Compare it to what you actually mailed. If it's not 80% there, hit reply and tell me where it missed.</Text>
      <Text>That's it. No 47-step onboarding. One notice, one comparison, one honest reaction.</Text>
      <Signature />
    </EmailLayout>
  );
}
