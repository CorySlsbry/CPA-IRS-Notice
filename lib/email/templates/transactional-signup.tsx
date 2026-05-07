import { Heading, Link, Text } from '@react-email/components';
import { EmailLayout } from './_layout';
import type { TemplateProps } from './render';

export function TransactionalSignup(props: TemplateProps) {
  const firstName = (props.contact.first_name as string | undefined) ?? 'there';
  const verifyUrl = (props.contact.verify_url as string | undefined) ?? '#';
  return (
    <EmailLayout preview="Confirm your NoticeReply account" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">One click — you're in</Heading>
      <Text>Hi {firstName} — confirm your email and your trial starts.</Text>
      <Text>
        <Link href={verifyUrl} className="font-semibold underline">
          → Confirm and open NoticeReply
        </Link>
      </Text>
      <Text className="text-[12px] text-neutral-500">If you didn't sign up, ignore this email — nothing happens unless you click.</Text>
    </EmailLayout>
  );
}
