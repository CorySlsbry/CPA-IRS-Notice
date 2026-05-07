import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).max(5000),
  mapping: z.record(z.string(), z.string()),
});

const VALID_TARGETS = new Set([
  'email',
  'first_name',
  'last_name',
  'phone',
  'job_title',
  'company_name',
  'lifecycle_stage',
  'source',
  'tags',
]);

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { data: membership } = await sb
    .from('firm_users')
    .select('firm_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();
  if (!membership) return NextResponse.json({ error: 'no_firm' }, { status: 403 });

  const admin = getSupabaseAdmin();
  const firmId = membership.firm_id as string;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const tagCache = new Map<string, string>();

  // Resolve company by name once.
  const companyByName = new Map<string, string>();

  for (const row of parsed.data.rows) {
    const fields: Record<string, string | string[]> = {};
    for (const [src, target] of Object.entries(parsed.data.mapping)) {
      if (!VALID_TARGETS.has(target)) continue;
      const value = row[src]?.trim();
      if (!value) continue;
      if (target === 'tags') {
        fields.tags = value.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
      } else {
        fields[target] = value;
      }
    }

    const email = (fields.email as string | undefined)?.toLowerCase();
    if (!email) {
      skipped += 1;
      continue;
    }

    let companyId: string | null = null;
    const companyName = fields.company_name as string | undefined;
    if (companyName) {
      const cached = companyByName.get(companyName.toLowerCase());
      if (cached) {
        companyId = cached;
      } else {
        const { data: company } = await admin
          .from('companies')
          .upsert({ firm_id: firmId, name: companyName }, { onConflict: 'firm_id,domain' })
          .select('id')
          .single();
        if (company?.id) {
          companyId = company.id as string;
          companyByName.set(companyName.toLowerCase(), companyId);
        }
      }
    }

    const upsert = {
      firm_id: firmId,
      email,
      first_name: fields.first_name as string | undefined,
      last_name: fields.last_name as string | undefined,
      phone: fields.phone as string | undefined,
      job_title: fields.job_title as string | undefined,
      company_id: companyId,
      source: (fields.source as string) ?? 'csv_import',
      lifecycle_stage: (fields.lifecycle_stage as string) ?? 'lead',
    };

    const { data, error } = await admin
      .from('contacts')
      .upsert(upsert, { onConflict: 'firm_id,email', ignoreDuplicates: false })
      .select('id, created_at')
      .single();
    if (error || !data) {
      skipped += 1;
      continue;
    }

    if (Math.abs(new Date(data.created_at).getTime() - Date.now()) < 5000) created += 1;
    else updated += 1;

    const tags = fields.tags as string[] | undefined;
    if (tags?.length) {
      for (const tagName of tags) {
        let tagId = tagCache.get(tagName);
        if (!tagId) {
          const { data: tag } = await admin
            .from('tags')
            .upsert({ firm_id: firmId, name: tagName }, { onConflict: 'firm_id,name' })
            .select('id')
            .single();
          if (!tag) continue;
          tagId = tag.id as string;
          tagCache.set(tagName, tagId);
        }
        await admin
          .from('contact_tags')
          .upsert({ firm_id: firmId, contact_id: data.id, tag_id: tagId }, { onConflict: 'contact_id,tag_id' });
      }
    }
  }

  return NextResponse.json({ created, updated, skipped, total: parsed.data.rows.length });
}
