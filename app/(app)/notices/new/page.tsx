import type { Metadata } from 'next';
import { UploadNoticeClient } from './upload-client';

export const metadata: Metadata = { title: 'New notice' };

export default function NewNoticePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl">New IRS notice</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Snap or drop the notice. We'll classify it (60s), draft a response (60s), and you review.
      </p>
      <div className="mt-8">
        <UploadNoticeClient />
      </div>
    </div>
  );
}
