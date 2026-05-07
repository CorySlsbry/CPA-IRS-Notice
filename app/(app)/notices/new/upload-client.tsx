'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, ImagePlus, Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Page = { base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; preview: string; name: string };

export function UploadNoticeClient() {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const next: Page[] = [];
    for (const f of Array.from(files)) {
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) continue;
      const base64 = await fileToBase64(f);
      next.push({
        base64,
        mediaType: f.type as Page['mediaType'],
        preview: URL.createObjectURL(f),
        name: f.name,
      });
    }
    setPages((p) => [...p, ...next].slice(0, 8));
  }

  async function submit() {
    if (pages.length === 0) {
      toast.error('Add at least one page first.');
      return;
    }
    setBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { data: userResp } = await sb.auth.getUser();
      const userId = userResp.user?.id;
      if (!userId) throw new Error('not_signed_in');

      // 1. Get firm_id (most users have one).
      const { data: membership } = await sb
        .from('firm_users')
        .select('firm_id')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true })
        .limit(1)
        .single();
      const firmId = membership?.firm_id as string | undefined;
      if (!firmId) throw new Error('no_firm');

      // 2. Insert the notice row.
      const { data: notice, error: insErr } = await sb
        .from('notices')
        .insert({ firm_id: firmId, status: 'uploaded', uploaded_by: userId, raw_image_pages: pages.map((p) => ({ name: p.name })) })
        .select('id')
        .single();
      if (insErr || !notice) throw new Error(insErr?.message ?? 'create_failed');

      // 3. Send to classifier.
      const r = await fetch('/api/notices/classify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          noticeId: notice.id,
          pages: pages.map((p) => ({ base64: p.base64, mediaType: p.mediaType })),
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? 'classify_failed');
      }
      toast.success('Classified — opening review.');
      router.push(`/notices/${notice.id}`);
    } catch (err) {
      toast.error((err as Error).message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-0">
          <label
            htmlFor="file"
            className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-accent hover:bg-accent/5"
          >
            <Upload className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-serif text-lg">Drop the notice here</p>
            <p className="mt-1 text-sm text-muted-foreground">PNG, JPEG, or WEBP. Up to 8 pages.</p>
            <input
              id="file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => onFiles(e.currentTarget.files)}
            />
          </label>
        </CardContent>
      </Card>

      {pages.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {pages.map((p) => (
            <div key={p.name} className="relative aspect-[5/6] overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={p.name} className="size-full object-cover" />
              <span className="absolute bottom-1 right-1 rounded bg-card/80 px-1.5 py-0.5 text-[10px]">{p.name}</span>
            </div>
          ))}
          <button
            onClick={() => document.getElementById('file')?.click()}
            className="grid aspect-[5/6] place-items-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent"
          >
            <ImagePlus className="size-7" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button onClick={submit} variant="gold" size="lg" disabled={busy || pages.length === 0}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Classifying…
            </>
          ) : (
            'Classify notice →'
          )}
        </Button>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}
