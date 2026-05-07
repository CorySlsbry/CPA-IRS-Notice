import type { Metadata } from 'next';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Start your 14-day trial',
  description: 'No card required. Cancel any time.',
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; plan?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="w-full max-w-md">
      <h1 className="font-serif text-3xl md:text-4xl">Start your 14-day trial</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No card. Cancel any time. We email from <code className="rounded bg-secondary px-1">support@salisburybookkeeping.com</code> — replies come straight to me.
      </p>
      <div className="mt-7">
        <SignupForm prefilledEmail={params.email} plan={params.plan} />
      </div>
    </div>
  );
}
