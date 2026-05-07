'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    router.push('/login');
    router.refresh();
  }
  return (
    <Button variant="ghost" size="sm" className="mt-2 w-full justify-start px-0 text-xs text-muted-foreground" onClick={logout}>
      Log out
    </Button>
  );
}
