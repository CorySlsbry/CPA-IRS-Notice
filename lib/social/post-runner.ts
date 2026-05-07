import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { publishFacebookPost, publishInstagramPost } from './meta';

/**
 * Scheduled-post executor. Picks up due posts (status=scheduled,
 * scheduled_at <= now()) and publishes them. Mirrors the workflow runner's
 * tick semantics — idempotent, logs failures to the row.
 *
 * Cloud Scheduler hits /api/social/run every minute alongside the
 * workflow tick.
 */

export type RunResult = {
  picked: number;
  published: number;
  failed: number;
};

export async function tickSocialQueue(opts?: { limit?: number }): Promise<RunResult> {
  const limit = opts?.limit ?? 100;
  const supabase = getSupabaseAdmin();

  const { data: due, error } = await supabase
    .from('social_posts')
    .select('id, firm_id, account_id, platform, body, media_urls, link_url')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let published = 0;
  let failed = 0;

  for (const post of (due ?? []) as Array<{
    id: string;
    firm_id: string;
    account_id: string;
    platform: 'facebook' | 'instagram' | 'x' | 'linkedin';
    body: string;
    media_urls: string[] | null;
    link_url: string | null;
  }>) {
    // Mark publishing first (claim the row)
    const { data: claimed } = await supabase
      .from('social_posts')
      .update({ status: 'publishing' })
      .eq('id', post.id)
      .eq('status', 'scheduled')
      .select('id')
      .single();
    if (!claimed) continue; // someone else picked it up

    // Need the account's external_id (FB Page ID / IG Business User ID)
    const { data: account } = await supabase
      .from('social_accounts')
      .select('external_id, status')
      .eq('id', post.account_id)
      .single();
    if (!account || (account.status as string) !== 'connected') {
      await supabase
        .from('social_posts')
        .update({ status: 'failed', error: 'account_not_connected' })
        .eq('id', post.id);
      failed += 1;
      continue;
    }

    try {
      let result: { externalId: string; externalUrl: string | null };
      if (post.platform === 'facebook') {
        result = await publishFacebookPost(post.account_id, account.external_id as string, {
          body: post.body,
          mediaUrls: post.media_urls ?? [],
          linkUrl: post.link_url ?? undefined,
        });
      } else if (post.platform === 'instagram') {
        result = await publishInstagramPost(post.account_id, account.external_id as string, {
          body: post.body,
          mediaUrls: post.media_urls ?? [],
        });
      } else {
        throw new Error(`platform_not_implemented:${post.platform}`);
      }

      await supabase
        .from('social_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          external_post_id: result.externalId,
          external_url: result.externalUrl,
          error: null,
        })
        .eq('id', post.id);
      published += 1;
    } catch (err) {
      const message = (err as Error).message ?? 'unknown';
      await supabase.from('social_posts').update({ status: 'failed', error: message }).eq('id', post.id);
      failed += 1;
    }
  }

  return { picked: due?.length ?? 0, published, failed };
}
