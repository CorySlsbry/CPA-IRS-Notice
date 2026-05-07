import { ImportClient } from './import-client';

export const metadata = { title: 'Import contacts' };

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl">Import contacts</h1>
      <p className="mt-1 text-sm text-muted-foreground">CSV with one row per contact. We dedupe on email.</p>
      <div className="mt-8">
        <ImportClient />
      </div>
    </div>
  );
}
