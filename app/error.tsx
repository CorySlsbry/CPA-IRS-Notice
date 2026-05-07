'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div className="max-w-md">
        <p className="font-mono text-xs text-muted-foreground">{error.digest ?? 'error'}</p>
        <h1 className="mt-2 font-serif text-4xl">Something cracked.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sorry — try once more. If this keeps happening, hit reply to any email and tell me what you were doing.
        </p>
        <Button variant="gold" className="mt-5" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
