import { NextResponse } from 'next/server';
import { handleComment, type CommentEvent } from '@/lib/social/comment-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Meta Webhooks receiver for both Facebook + Instagram.
 *
 * GET = verification handshake when registering the webhook.
 * POST = event delivery (page changes, comments, messages, etc).
 *
 * Configure in your Meta App dashboard:
 *   Callback URL: https://<CLOUD_RUN_URL>/api/webhooks/meta
 *   Verify token: matches META_WEBHOOK_VERIFY_TOKEN env var
 *   Subscriptions: page (feed, mention) + instagram (comments, mentions)
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const verifyToken = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!expected) {
    return NextResponse.json({ error: 'verify_token_not_configured' }, { status: 500 });
  }
  if (mode === 'subscribe' && verifyToken === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

type FacebookChange = {
  field: string;
  value: {
    item?: string;
    verb?: string;
    comment_id?: string;
    post_id?: string;
    parent_id?: string;
    sender_id?: string;
    sender_name?: string;
    message?: string;
    created_time?: number;
    from?: { id: string; name?: string };
  };
};

type FacebookEntry = {
  id: string;
  time: number;
  changes?: FacebookChange[];
};

type InstagramEntry = {
  id: string;
  time: number;
  changes?: Array<{
    field: 'comments' | 'mentions';
    value: {
      id?: string;
      text?: string;
      from?: { id?: string; username?: string };
      media?: { id?: string };
      parent_id?: string;
    };
  }>;
};

type WebhookBody = {
  object: 'page' | 'instagram';
  entry: (FacebookEntry | InstagramEntry)[];
};

export async function POST(req: Request) {
  const body = (await req.json()) as WebhookBody;
  // TODO: verify X-Hub-Signature-256 against META_APP_SECRET. We accept
  // unsigned in dev; signature verification lands once the App is live.

  const platform: 'facebook' | 'instagram' = body.object === 'instagram' ? 'instagram' : 'facebook';
  const events: CommentEvent[] = [];

  for (const entry of body.entry ?? []) {
    if (platform === 'facebook') {
      const fb = entry as FacebookEntry;
      for (const change of fb.changes ?? []) {
        if (change.field !== 'feed') continue;
        const v = change.value;
        if (v.item !== 'comment' || v.verb !== 'add' || !v.comment_id) continue;
        events.push({
          platform: 'facebook',
          pageOrUserExternalId: fb.id,
          externalCommentId: v.comment_id,
          externalPostId: v.post_id ?? v.parent_id,
          commenterExternalId: v.from?.id ?? v.sender_id,
          commenterName: v.from?.name ?? v.sender_name,
          text: v.message ?? '',
          receivedAt: v.created_time ? new Date(v.created_time * 1000).toISOString() : undefined,
        });
      }
    } else {
      const ig = entry as InstagramEntry;
      for (const change of ig.changes ?? []) {
        if (change.field !== 'comments') continue;
        const v = change.value;
        if (!v.id) continue;
        events.push({
          platform: 'instagram',
          pageOrUserExternalId: ig.id,
          externalCommentId: v.id,
          externalPostId: v.media?.id,
          commenterExternalId: v.from?.id,
          commenterHandle: v.from?.username,
          text: v.text ?? '',
        });
      }
    }
  }

  // Process in parallel — handler is idempotent and side-effect-bounded
  await Promise.allSettled(events.map((e) => handleComment(e)));
  return NextResponse.json({ received: events.length });
}
