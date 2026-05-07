import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { renderEmail } from './templates/render';
import { isSuppressed } from './deliverability';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY missing');
  _resend = new Resend(key);
  return _resend;
}

export type SendCategory = 'marketing' | 'transactional' | 'workflow_personal' | 'workflow_bulk';

export type SendArgs = {
  firmId: string;
  contactId?: string;
  to: string;
  category: SendCategory;
  subject: string;
  /** React-email component name registered in templates/render.ts */
  template: string;
  props?: Record<string, unknown>;
  /** Override default sender display name, e.g. for white-label. */
  fromName?: string;
  /** Optional reply-to override. */
  replyTo?: string;
  /** Tied to a campaign or workflow run. */
  campaignId?: string;
  workflowRunId?: string;
};

export type SendResult =
  | { status: 'sent'; messageId: string; emailSendId: string; resendId: string }
  | { status: 'suppressed'; reason: string }
  | { status: 'rate_limited'; reason: string };

const APEX = process.env.RESEND_TRANSACTIONAL_DOMAIN ?? 'salisburybookkeeping.com';
const SUBDOMAIN = process.env.RESEND_MARKETING_DOMAIN ?? 'mail.salisburybookkeeping.com';
const DEFAULT_FROM_USER = (process.env.DEFAULT_FROM_EMAIL ?? 'support@salisburybookkeeping.com').split('@')[0]!;
const DEFAULT_FROM_NAME = process.env.DEFAULT_FROM_NAME ?? 'Cory @ Salisbury Bookkeeping';

/**
 * Per memory (project_noticereply_email_sender.md):
 *   - marketing / bulk / cold / nurture → mail.salisburybookkeeping.com (subdomain)
 *   - transactional / workflow_personal → salisburybookkeeping.com (apex)
 * The single suppression list applies across BOTH.
 */
function fromAddressFor(category: SendCategory, fromName: string): string {
  const useSubdomain = category === 'marketing' || category === 'workflow_bulk';
  const domain = useSubdomain ? SUBDOMAIN : APEX;
  return `${fromName} <${DEFAULT_FROM_USER}@${domain}>`;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const supabase = getSupabaseAdmin();

  // 1. Suppression check — applies to ALL categories.
  if (await isSuppressed(args.firmId, args.to)) {
    return { status: 'suppressed', reason: 'suppression_list' };
  }

  // 2. Test allowlist gate (dev only).
  const allowlist = (process.env.EMAIL_TEST_ALLOWLIST ?? '').trim();
  if (allowlist && !allowlist.split(',').map((s) => s.trim().toLowerCase()).includes(args.to.toLowerCase())) {
    return { status: 'rate_limited', reason: 'not_in_test_allowlist' };
  }

  // 3. Warmup cap check (subdomain only — apex assumed warm).
  if (args.category === 'marketing' || args.category === 'workflow_bulk') {
    const cap = await getDailyCap(args.firmId, SUBDOMAIN);
    if (cap.used >= cap.limit) {
      return { status: 'rate_limited', reason: `daily_cap_${cap.limit}_reached` };
    }
  }

  // 4. Render react-email template.
  const fromName = args.fromName ?? DEFAULT_FROM_NAME;
  const fromAddress = fromAddressFor(args.category, fromName);
  const replyTo = args.replyTo ?? `${DEFAULT_FROM_USER}@${APEX}`;
  const { html, text } = await renderEmail(args.template, {
    contact: args.props ?? {},
    firmId: args.firmId,
    subject: args.subject,
    unsubUrl: unsubscribeUrl(args.firmId, args.to),
  });

  // 5. Persist email_send row up front so opens/clicks can be tied back.
  const messageId = `<${crypto.randomUUID()}@${args.category === 'marketing' ? SUBDOMAIN : APEX}>`;
  const { data: sendRow, error: sendErr } = await supabase
    .from('email_sends')
    .insert({
      firm_id: args.firmId,
      contact_id: args.contactId ?? null,
      campaign_id: args.campaignId ?? null,
      workflow_run_id: args.workflowRunId ?? null,
      to_email: args.to,
      from_email: `${DEFAULT_FROM_USER}@${args.category === 'marketing' ? SUBDOMAIN : APEX}`,
      category: args.category,
      subject: args.subject,
      message_id: messageId,
    })
    .select('id')
    .single();
  if (sendErr || !sendRow) throw new Error(`email_sends insert failed: ${sendErr?.message}`);

  // 6. Hand off to Resend.
  const resend = getResend();
  const result = await resend.emails.send({
    from: fromAddress,
    to: [args.to],
    replyTo: replyTo,
    subject: args.subject,
    html,
    text,
    headers: {
      'Message-ID': messageId,
      'List-Unsubscribe': `<${unsubscribeUrl(args.firmId, args.to)}>, <mailto:${DEFAULT_FROM_USER}@${APEX}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'category', value: args.category },
      { name: 'firm_id', value: args.firmId },
    ],
  });

  if (result.error) {
    await supabase.from('email_sends').update({ metadata: { send_error: result.error.message } }).eq('id', sendRow.id);
    throw new Error(`Resend send failed: ${result.error.message}`);
  }

  await supabase
    .from('email_sends')
    .update({ resend_id: result.data?.id, sent_at: new Date().toISOString() })
    .eq('id', sendRow.id);

  // Log activity.
  if (args.contactId) {
    await supabase.from('activities').insert({
      firm_id: args.firmId,
      contact_id: args.contactId,
      type: 'email_sent',
      payload: {
        email_send_id: sendRow.id,
        subject: args.subject,
        category: args.category,
        campaign_id: args.campaignId ?? null,
        workflow_run_id: args.workflowRunId ?? null,
      },
    });
  }

  return {
    status: 'sent',
    messageId,
    emailSendId: sendRow.id,
    resendId: result.data?.id ?? '',
  };
}

function unsubscribeUrl(firmId: string, email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const token = Buffer.from(`${firmId}:${email}`).toString('base64url');
  return `${base}/api/track/unsubscribe?t=${token}`;
}

async function getDailyCap(
  firmId: string,
  domain: string,
): Promise<{ used: number; limit: number }> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: domainRow }, { count }] = await Promise.all([
    supabase
      .from('sending_domains')
      .select('daily_cap, warmup_started_at, warmup_day, status')
      .eq('domain', domain)
      .or(`firm_id.eq.${firmId},firm_id.is.null`)
      .order('firm_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('email_sends')
      .select('id', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .gte('sent_at', since)
      .in('category', ['marketing', 'workflow_bulk']),
  ]);

  // Default warmup ladder per memory: 50/200/1000 days 1-3/4-7/8-14, unrestricted thereafter.
  let limit = domainRow?.daily_cap ?? 50;
  if (domainRow?.warmup_started_at) {
    const days = Math.floor(
      (Date.now() - new Date(domainRow.warmup_started_at).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 3) limit = 50;
    else if (days < 7) limit = 200;
    else if (days < 14) limit = 1000;
    else limit = 50_000;
  }

  return { used: count ?? 0, limit };
}
