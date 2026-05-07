'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { toast } from 'sonner';

type Props = { prefilledEmail?: string; plan?: string };

export function SignupForm({ prefilledEmail, plan }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [firmName, setFirmName] = useState('');
  const [signerName, setSignerName] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            firm_name: firmName,
            signer_name: signerName,
            initial_plan: plan ?? 'founding',
          },
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.user) {
        router.push('/dashboard');
        router.refresh();
        return;
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="firm">Firm name</Label>
        <Input
          id="firm"
          value={firmName}
          onChange={(e) => setFirmName(e.target.value)}
          required
          placeholder="Smith CPA, LLC"
        />
      </div>
      <div>
        <Label htmlFor="signer">Your name (defaults as letter signer)</Label>
        <Input
          id="signer"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          required
          placeholder="Pat Smith, CPA"
        />
      </div>
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={10}
        />
        <p className="mt-1 text-xs text-muted-foreground">10+ chars. Mix of letters and numbers.</p>
      </div>
      <Button type="submit" size="lg" variant="gold" disabled={submitting}>
        {submitting ? 'Creating your firm…' : 'Start free trial'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
