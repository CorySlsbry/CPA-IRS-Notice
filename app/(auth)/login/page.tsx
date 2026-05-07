import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Log in to NoticeReply',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="w-full max-w-md">
      <h1 className="font-serif text-3xl md:text-4xl">Welcome back.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pick up where you left off.</p>
      <div className="mt-7">
        <LoginForm next={params.next} />
      </div>
    </div>
  );
}
