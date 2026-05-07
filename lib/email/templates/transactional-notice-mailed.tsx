import { Heading, Text } from '@react-email/components';
import { EmailLayout } from './_layout';
import type { TemplateProps } from './render';

export function TransactionalNoticeMailed(props: TemplateProps) {
  const taxpayer = (props.contact.taxpayer_name as string | undefined) ?? 'your client';
  const trackingId = (props.contact.tracking_id as string | undefined) ?? '';
  const expectedDate = (props.contact.expected_delivery_date as string | undefined) ?? '';
  return (
    <EmailLayout preview="Notice response mailed certified" unsubUrl={props.unsubUrl}>
      <Heading className="text-[20px] font-semibold">Mailed</Heading>
      <Text>The IRS notice response for <strong>{taxpayer}</strong> dropped in the mail this morning, certified.</Text>
      {trackingId && <Text>Tracking: <code>{trackingId}</code></Text>}
      {expectedDate && <Text>Expected delivery: {expectedDate}</Text>}
      <Text>You'll get another email when the carrier confirms delivery.</Text>
    </EmailLayout>
  );
}
