import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComposeClient } from './compose-client';

export const metadata = { title: 'Compose post' };

export default async function ComposePage() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: membership } = await sb
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const firmId = (membership?.firm_id as string | undefined) ?? null;
  if (!firmId) return null;

  const { data: accounts } = await sb
    .from('social_accounts')
    .select('id, platform, display_name, username, status')
    .eq('firm_id', firmId)
    .eq('status', 'connected');

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Button asChild variant="ghost" size="sm">
        <Link href="/social">
          <ArrowLeft className="size-4" /> Social
        </Link>
      </Button>
      <h1 className="mt-3 font-serif text-3xl">New post</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick the account, write the body, optionally schedule.</p>

      <div className="mt-8">
        <ComposeClient accounts={(accounts ?? []) as Array<{ id: string; platform: string; display_name: string; username: string | null }>} />
      </div>
    </div>
  );
}
