import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="mt-2 font-serif text-5xl">Couldn't find that.</h1>
        <p className="mt-3 text-muted-foreground">Probably moved. Or never existed. Either way — not here.</p>
        <Button asChild variant="gold" className="mt-5">
          <Link href="/">← Back home</Link>
        </Button>
      </div>
    </div>
  );
}
