import { Storage } from '@google-cloud/storage';

let _storage: Storage | null = null;

function getStorage(): Storage {
  if (_storage) return _storage;
  _storage = new Storage();
  return _storage;
}

const BUCKET = process.env.GCS_BUCKET_UPLOADS ?? 'noticereply-uploads';

/**
 * Upload a buffer (e.g. notice image) and return both the gs:// path
 * and a short-lived signed URL the UI can render.
 */
export async function uploadBuffer(opts: {
  firmId: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
}): Promise<{ gsPath: string; signedUrl: string }> {
  const storage = getStorage();
  const bucket = storage.bucket(BUCKET);
  const objectName = `firms/${opts.firmId}/${Date.now()}-${sanitize(opts.filename)}`;
  const file = bucket.file(objectName);
  await file.save(opts.buffer, {
    contentType: opts.contentType,
    resumable: false,
    metadata: { cacheControl: 'private, max-age=300' },
  });
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
    version: 'v4',
  });
  return { gsPath: `gs://${BUCKET}/${objectName}`, signedUrl };
}

/** Generate a fresh signed URL for an existing gs:// path. */
export async function signedUrlFor(gsPath: string, ttlMs = 60 * 60 * 1000): Promise<string> {
  if (!gsPath.startsWith('gs://')) return gsPath;
  const without = gsPath.slice('gs://'.length);
  const slash = without.indexOf('/');
  const bucketName = without.slice(0, slash);
  const objectName = without.slice(slash + 1);
  const [url] = await getStorage().bucket(bucketName).file(objectName).getSignedUrl({
    action: 'read',
    expires: Date.now() + ttlMs,
    version: 'v4',
  });
  return url;
}

function sanitize(s: string): string {
  return s.replace(/[^\w.\-]/g, '_').slice(0, 80);
}
