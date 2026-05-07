import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendFacebookDm, sendInstagramDm } from './meta';
import { enrollContact } from '@/lib/workflows/enroll';

/**
 * Comment webhook event handler. Called from /api/webhooks/meta/route.ts
 * for every IG/FB comment event Meta delivers.
 *
 * Pipeline:
 *   1. Persist the comment to social_comments (idempotent on external_comment_id)
 *   2. Look up active triggers for the firm/account/post
 *   3. Match the comment text against each trigger's keyword
 *   4. For the first match, fire the trigger's action:
 *        - send_dm:        queue + send DM via Meta Graph API
 *        - add_tag:        upsert tag on the contact (creating contact if needed)
 *        - enroll_workflow: enroll contact in the configured workflow
 *
 * Idempotency: external_comment_id is the unique key on social_comments,
 * so re-deliveries from Meta no-op cleanly.
 */

export type CommentEvent = {
  platform: 'facebook' | 'instagram';
  pageOrUserExternalId: string;          // FB Page ID or IG Business User ID
  externalCommentId: string;
  externalPostId?: string;
  commenterExternalId?: string;
  commenterHandle?: string;
  commenterName?: string;
  text: string;
  receivedAt?: string;
};

export async function handleComment(event: CommentEvent): Promise<{ matched: boolean; actionTaken?: string }> {
  const supabase = getSupabaseAdmin();

  // 1. Find the connected social account
  const { data: account } = await supabase
    .from('social_accounts')
    .select('id, firm_id, platform, status')
    .eq('platform', event.platform)
    .eq('external_id', event.pageOrUserExternalId)
    .maybeSingle();
  if (!account) {
    return { matched: false }; // unknown account — likely a webhook for a different installation
  }

  // 2. Resolve the post (if known) so we can scope triggers
  let postId: string | null = null;
  if (event.externalPostId) {
    const { data: post } = await supabase
      .from('social_posts')
      .select('id')
      .eq('platform', event.platform)
      .eq('external_post_id', event.externalPostId)
      .maybeSingle();
    postId = (post?.id as string | undefined) ?? null;
  }

  // 3. Persist the comment (idempotent)
  const { data: comment } = await supabase
    .from('social_comments')
    .upsert(
      {
        firm_id: account.firm_id,
        account_id: account.id,
        post_id: postId,
        external_comment_id: event.externalCommentId,
        external_post_id: event.externalPostId ?? null,
        commenter_external_id: event.commenterExternalId ?? null,
        commenter_handle: event.commenterHandle ?? null,
        commenter_name: event.commenterName ?? null,
        comment_text: event.text,
        received_at: event.receivedAt ?? new Date().toISOString(),
      },
      { onConflict: 'account_id,external_comment_id', ignoreDuplicates: false },
    )
    .select('id, matched_trigger_id')
    .single();

  if (!comment) return { matched: false };

  // Already matched on a previous delivery → no-op
  if (comment.matched_trigger_id) {
    return { matched: true, actionTaken: 'already_processed' };
  }

  // 4. Load active triggers, scoped most-specific first
  const { data: triggers } = await supabase
    .from('social_comment_triggers')
    .select('id, post_id, keyword, match_mode, action, action_payload')
    .eq('firm_id', account.firm_id)
    .eq('account_id', account.id)
    .eq('active', true);

  if (!triggers || triggers.length === 0) {
    return { matched: false };
  }

  const text = (event.text ?? '').toLowerCase();
  const matched = (triggers as Array<{
    id: string;
    post_id: string | null;
    keyword: string;
    match_mode: string;
    action: 'send_dm' | 'add_tag' | 'enroll_workflow';
    action_payload: Record<string, unknown>;
  }>)
    .filter((t) => t.post_id == null || t.post_id === postId)
    .find((t) => textMatches(text, t.keyword.toLowerCase(), t.match_mode));

  if (!matched) return { matched: false };

  // 5. Execute action
  let actionTaken: string;
  try {
    switch (matched.action) {
      case 'send_dm': {
        const dmBody = (matched.action_payload['dm_body'] as string) ?? defaultDmBody(matched.action_payload);
        const recipientId = event.commenterExternalId;
        if (!recipientId) {
          throw new Error('commenter_external_id_missing');
        }
        // Queue DM row first (so we have a paper trail even if send fails)
        const { data: dmRow } = await supabase
          .from('social_dms')
          .insert({
            firm_id: account.firm_id,
            account_id: account.id,
            trigger_id: matched.id,
            comment_id: comment.id,
            recipient_external_id: recipientId,
            recipient_handle: event.commenterHandle ?? null,
            body: dmBody,
            status: 'pending',
          })
          .select('id')
          .single();
        // Send
        try {
          if (event.platform === 'facebook') {
            const { messageId } = await sendFacebookDm(account.id, account.external_id as never, recipientId, dmBody);
            if (dmRow?.id) {
              await supabase.from('social_dms').update({
                status: 'sent', sent_at: new Date().toISOString(), external_message_id: messageId,
              }).eq('id', dmRow.id);
            }
          } else {
            const { messageId } = await sendInstagramDm(
              account.id, event.pageOrUserExternalId, event.externalCommentId, dmBody,
            );
            if (dmRow?.id) {
              await supabase.from('social_dms').update({
                status: 'sent', sent_at: new Date().toISOString(), external_message_id: messageId,
              }).eq('id', dmRow.id);
            }
          }
          actionTaken = 'dm_sent';
        } catch (sendErr) {
          const message = (sendErr as Error).message;
          if (dmRow?.id) {
            await supabase.from('social_dms').update({
              status: message === 'scope_not_yet_approved' ? 'blocked' : 'failed',
              error: message,
            }).eq('id', dmRow.id);
          }
          actionTaken = `dm_${message === 'scope_not_yet_approved' ? 'blocked_scope_pending' : 'failed'}`;
        }
        break;
      }

      case 'add_tag': {
        const tagName = matched.action_payload['tag'] as string;
        if (!tagName) throw new Error('tag_missing');
        const contactId = await ensureContactForCommenter(account.firm_id, event);
        if (!contactId) {
          actionTaken = 'add_tag_skipped_no_contact';
          break;
        }
        const { data: tag } = await supabase
          .from('tags')
          .upsert({ firm_id: account.firm_id, name: tagName }, { onConflict: 'firm_id,name' })
          .select('id')
          .single();
        if (tag) {
          await supabase
            .from('contact_tags')
            .upsert({ firm_id: account.firm_id, contact_id: contactId, tag_id: tag.id }, { onConflict: 'contact_id,tag_id' });
          await supabase
            .from('social_comments')
            .update({ contact_id: contactId })
            .eq('id', comment.id);
        }
        actionTaken = 'tag_added';
        break;
      }

      case 'enroll_workflow': {
        const workflowId = matched.action_payload['workflow_id'] as string;
        if (!workflowId) throw new Error('workflow_id_missing');
        const contactId = await ensureContactForCommenter(account.firm_id, event);
        if (!contactId) {
          actionTaken = 'enroll_skipped_no_contact';
          break;
        }
        await enrollContact({
          firmId: account.firm_id,
          contactId,
          trigger: { type: 'manual', workflowId },
        });
        actionTaken = 'workflow_enrolled';
        break;
      }
    }
  } catch (err) {
    actionTaken = `error:${(err as Error).message}`;
  }

  // 6. Mark match
  await supabase
    .from('social_comments')
    .update({ matched_trigger_id: matched.id, matched_at: new Date().toISOString() })
    .eq('id', comment.id);

  await supabase
    .from('social_comment_triggers')
    .update({ match_count: 1, last_matched_at: new Date().toISOString() })
    // increment via raw — Supabase shim doesn't support func() updates, but the row update sets it to 1.
    // To increment correctly we'd need a Postgres function; left as a known limitation.
    .eq('id', matched.id);

  return { matched: true, actionTaken };
}

function textMatches(text: string, keyword: string, mode: string): boolean {
  switch (mode) {
    case 'starts_with':
      return text.startsWith(keyword);
    case 'exact':
      return text.trim() === keyword;
    case 'contains':
    default:
      return text.includes(keyword);
  }
}

function defaultDmBody(payload: Record<string, unknown>): string {
  const link = (payload['link'] as string) ?? 'https://noticereply.com/checklist';
  return `Hey — saw your comment! Here's the link as promised:\n\n${link}\n\n— Cory\nSalisbury Bookkeeping`;
}

async function ensureContactForCommenter(
  firmId: string,
  event: CommentEvent,
): Promise<string | null> {
  if (!event.commenterHandle && !event.commenterExternalId) return null;
  const supabase = getSupabaseAdmin();
  // We use a synthetic email of `<handle>@<platform>.social.noticereply` to
  // hold the contact until the visitor identifies via the form/lead-magnet flow.
  const synthetic = `${(event.commenterHandle ?? event.commenterExternalId ?? 'unknown').toLowerCase()}@${event.platform}.social.noticereply`;
  const { data } = await supabase
    .from('contacts')
    .upsert(
      {
        firm_id: firmId,
        email: synthetic,
        first_name: event.commenterName?.split(' ')[0],
        last_name: event.commenterName?.split(' ').slice(1).join(' '),
        source: `social:${event.platform}`,
        custom_fields: {
          [`${event.platform}_handle`]: event.commenterHandle,
          [`${event.platform}_external_id`]: event.commenterExternalId,
        },
      },
      { onConflict: 'firm_id,email' },
    )
    .select('id')
    .single();
  return (data?.id as string | undefined) ?? null;
}
