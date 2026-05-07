import { getAccessToken, markAccountStatus } from './encrypt';

/**
 * Facebook + Instagram via the Meta Graph API. One client handles both —
 * Instagram for Business is owned by a Facebook Page, so the Page token
 * is what we send for both surfaces (with the IG Business Account ID for IG
 * endpoints).
 *
 * Auth: long-lived Page token (60 days). When a token expires we mark the
 * account `expired` and surface a reconnect prompt in the UI.
 *
 * Permissions needed for full functionality:
 *   - pages_manage_posts            (create posts)
 *   - pages_read_engagement         (read post reactions / comments)
 *   - pages_messaging               (send DMs)
 *   - instagram_basic               (read IG profile)
 *   - instagram_content_publish     (publish IG posts)
 *   - instagram_manage_comments     (read + reply to comments)  ← App Review pending
 *   - instagram_manage_messages     (send IG DMs)               ← App Review pending
 */

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type PostInput = {
  body: string;
  /** HTTPS URLs of images. Single image first; carousel uses up to 10. */
  mediaUrls?: string[];
  /** External link to attach (Facebook only). */
  linkUrl?: string;
};

export type PostResult = {
  externalId: string;
  externalUrl: string | null;
};

/**
 * Publish a Facebook Page post. `accountExternalId` is the FB Page ID.
 */
export async function publishFacebookPost(
  accountId: string,
  pageId: string,
  input: PostInput,
): Promise<PostResult> {
  const token = await getAccessToken(accountId);
  if (!token) throw new Error('account_token_missing');

  const params = new URLSearchParams({
    message: input.body,
    access_token: token,
  });
  if (input.linkUrl) params.set('link', input.linkUrl);

  const endpoint = input.mediaUrls && input.mediaUrls.length > 0 ? 'photos' : 'feed';
  const url = `${GRAPH_BASE}/${pageId}/${endpoint}`;

  if (input.mediaUrls && input.mediaUrls[0]) {
    params.set('url', input.mediaUrls[0]);
  }

  const r = await fetch(url, { method: 'POST', body: params });
  const body = (await r.json()) as { id?: string; post_id?: string; error?: { code: number; message: string } };
  if (!r.ok || body.error) {
    if (r.status === 401 || body.error?.code === 190) {
      await markAccountStatus(accountId, 'expired');
    }
    throw new Error(body.error?.message ?? `meta_post_failed_${r.status}`);
  }
  const externalId = body.post_id ?? body.id ?? '';
  return {
    externalId,
    externalUrl: externalId ? `https://www.facebook.com/${externalId}` : null,
  };
}

/**
 * Publish an Instagram post. Two-step: create container, then publish.
 * `accountExternalId` is the IG Business Account ID.
 */
export async function publishInstagramPost(
  accountId: string,
  igUserId: string,
  input: PostInput,
): Promise<PostResult> {
  const token = await getAccessToken(accountId);
  if (!token) throw new Error('account_token_missing');
  if (!input.mediaUrls || input.mediaUrls.length === 0) {
    throw new Error('instagram_requires_media');
  }

  // Step 1: create media container
  const containerParams = new URLSearchParams({
    image_url: input.mediaUrls[0]!,
    caption: input.body,
    access_token: token,
  });
  const containerR = await fetch(`${GRAPH_BASE}/${igUserId}/media`, { method: 'POST', body: containerParams });
  const containerJson = (await containerR.json()) as { id?: string; error?: { code: number; message: string } };
  if (!containerR.ok || containerJson.error || !containerJson.id) {
    if (containerR.status === 401 || containerJson.error?.code === 190) {
      await markAccountStatus(accountId, 'expired');
    }
    throw new Error(containerJson.error?.message ?? `ig_container_failed_${containerR.status}`);
  }

  // Step 2: publish
  const publishParams = new URLSearchParams({
    creation_id: containerJson.id,
    access_token: token,
  });
  const publishR = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, { method: 'POST', body: publishParams });
  const publishJson = (await publishR.json()) as { id?: string; error?: { code: number; message: string } };
  if (!publishR.ok || publishJson.error || !publishJson.id) {
    throw new Error(publishJson.error?.message ?? `ig_publish_failed_${publishR.status}`);
  }

  return {
    externalId: publishJson.id,
    externalUrl: `https://www.instagram.com/p/${publishJson.id}`,
  };
}

/**
 * Send a DM in response to a Facebook comment. Requires pages_messaging scope.
 * Comment-triggered DMs are subject to Meta's "private replies" policy:
 * one DM per commenter per ~24h, only when responding to their public comment.
 */
export async function sendFacebookDm(
  accountId: string,
  pageId: string,
  recipientExternalId: string,
  body: string,
): Promise<{ messageId: string }> {
  const token = await getAccessToken(accountId);
  if (!token) throw new Error('account_token_missing');

  const r = await fetch(`${GRAPH_BASE}/${pageId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientExternalId },
      message: { text: body },
      messaging_type: 'RESPONSE',
      access_token: token,
    }),
  });
  const json = (await r.json()) as { message_id?: string; error?: { message: string } };
  if (!r.ok || json.error || !json.message_id) {
    throw new Error(json.error?.message ?? `fb_dm_failed_${r.status}`);
  }
  return { messageId: json.message_id };
}

/**
 * Send an IG private reply to a comment. Requires
 * instagram_manage_messages scope (PENDING APP REVIEW per Jarvis memory).
 *
 * Behavior until the scope is live: this function throws
 * `scope_not_yet_approved` and the comment-handler stores the DM in
 * social_dms with status='blocked' so it surfaces in the UI but doesn't
 * crash the flow.
 */
export async function sendInstagramDm(
  accountId: string,
  igUserId: string,
  commentId: string,
  body: string,
): Promise<{ messageId: string }> {
  const token = await getAccessToken(accountId);
  if (!token) throw new Error('account_token_missing');

  // The Instagram private-reply endpoint POSTs to the comment_id, not the user id.
  const r = await fetch(`${GRAPH_BASE}/${igUserId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: body },
      access_token: token,
    }),
  });
  const json = (await r.json()) as { message_id?: string; error?: { message: string; code: number } };
  if (!r.ok || json.error || !json.message_id) {
    if (json.error?.code === 200) {
      throw new Error('scope_not_yet_approved');
    }
    throw new Error(json.error?.message ?? `ig_dm_failed_${r.status}`);
  }
  return { messageId: json.message_id };
}

/** Subscribe a Facebook Page to webhooks for the configured app. One-time per page. */
export async function subscribePageToWebhooks(
  accountId: string,
  pageId: string,
  fields: string[] = ['feed', 'mention', 'messages', 'messaging_postbacks'],
): Promise<void> {
  const token = await getAccessToken(accountId);
  if (!token) throw new Error('account_token_missing');
  await fetch(`${GRAPH_BASE}/${pageId}/subscribed_apps`, {
    method: 'POST',
    body: new URLSearchParams({ subscribed_fields: fields.join(','), access_token: token }),
  });
}
