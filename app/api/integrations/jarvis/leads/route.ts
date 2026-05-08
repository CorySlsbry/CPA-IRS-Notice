import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, tx } from '@/lib/db/pool';
import { checkJarvisToken, getJarvisDefaultFirmId, isKnownVertical, VERTICAL_ROUTING, type Vertical } from '@/lib/jarvis/auth';
import { computeQualifiers, normalizeCompany, splitFullName } from '@/lib/jarvis/normalize';
import { findMatch } from '@/lib/jarvis/match';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Mode A/B/C dispatch lives in this file. POST = create lead. GET = lookup. ─

// ╔══════════════════════════════════════════════════════════════════════════
// ║ POST /api/integrations/jarvis/leads
// ╠══════════════════════════════════════════════════════════════════════════
const postBodySchema = z.object({
  vertical: z.string(),
  contact: z.object({
    email: z.string().email().optional().nullable(),
    full_name: z.string().optional().nullable(),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    linkedin_url: z.string().optional().nullable(),
  }),
  company: z
    .object({
      name: z.string().optional().nullable(),
      type: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
      country: z.string().optional().nullable(),
      locations_count: z.union([z.string(), z.number()]).optional().nullable(),
    })
    .optional()
    .nullable(),
  lead: z
    .object({
      source: z.string().optional().nullable(),
      interest: z.string().optional().nullable(),
      utm_source: z.string().optional().nullable(),
      utm_medium: z.string().optional().nullable(),
      utm_campaign: z.string().optional().nullable(),
      utm_term: z.string().optional().nullable(),
      utm_content: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      raw_payload: z.unknown().optional().nullable(),
    })
    .optional()
    .nullable(),
  tags: z.array(z.string()).default([]),
  external_id: z.string().optional().nullable(),
  apollo_person_id: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = checkJarvisToken(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const firmId = getJarvisDefaultFirmId();
  if (!firmId) {
    return NextResponse.json(
      { error: 'firm_not_configured', detail: 'Set JARVIS_DEFAULT_FIRM_ID or MARKETING_FIRM_ID secret to the target firm UUID.' },
      { status: 503 },
    );
  }

  let parsed: z.infer<typeof postBodySchema>;
  try {
    parsed = postBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'validation_failed', details: (err as z.ZodError).flatten() }, { status: 400 });
  }

  if (!isKnownVertical(parsed.vertical)) {
    return NextResponse.json({ error: 'unknown_vertical', vertical: parsed.vertical }, { status: 400 });
  }
  const vertical: Vertical = parsed.vertical;

  if (!parsed.contact.email && !parsed.contact.phone && !parsed.apollo_person_id) {
    return NextResponse.json({ error: 'missing_identity', detail: 'one of contact.email, contact.phone, or apollo_person_id required' }, { status: 400 });
  }

  // Split full_name → first/last when individual fields not supplied
  let firstName = parsed.contact.first_name ?? null;
  let lastName = parsed.contact.last_name ?? null;
  if ((!firstName || !lastName) && parsed.contact.full_name) {
    const split = splitFullName(parsed.contact.full_name);
    firstName = firstName ?? split.first;
    lastName = lastName ?? split.last;
  }

  const qualifiers = computeQualifiers({
    email: parsed.contact.email,
    phone: parsed.contact.phone,
    linkedinUrl: parsed.contact.linkedin_url,
    firstName,
    lastName,
    companyName: parsed.company?.name,
    apolloPersonId: parsed.apollo_person_id,
    externalId: parsed.external_id,
  });

  try {
    const result = await tx(async (client) => {
      // 1. Existing-contact lookup in priority order
      let matchSignal: 'email_normalized' | 'apollo_person_id' | 'phone_digits' | 'name_company_key' | null = null;
      let contactId: string | null = null;

      const lookups: Array<[typeof matchSignal, string]> = [
        ['email_normalized', 'email_normalized'],
        ['apollo_person_id', 'apollo_person_id'],
        ['phone_digits', 'phone_digits'],
        ['name_company_key', 'name_company_key'],
      ];
      for (const [signal, column] of lookups) {
        const value = qualifiers[column as keyof typeof qualifiers];
        if (!value) continue;
        const r = await client.query<{ id: string }>(
          `select id from contacts where firm_id = $1 and ${column} = $2 limit 1`,
          [firmId, value],
        );
        if (r.rowCount && r.rowCount > 0) {
          contactId = r.rows[0]!.id;
          matchSignal = signal;
          break;
        }
      }

      // 2. Upsert company
      let companyId: string | null = null;
      if (parsed.company?.name) {
        const companyDomain = parsed.company.website
          ? parsed.company.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() || null
          : null;
        const cRes = await client.query<{ id: string }>(
          `insert into companies (firm_id, name, domain, custom_fields)
           values ($1, $2, $3, $4)
           on conflict (firm_id, domain) where domain is not null
           do update set name = coalesce(nullif(companies.name,''), excluded.name)
           returning id`,
          [
            firmId,
            parsed.company.name,
            companyDomain,
            JSON.stringify({
              type: parsed.company.type,
              city: parsed.company.city,
              state: parsed.company.state,
              country: parsed.company.country,
              locations_count: parsed.company.locations_count,
            }),
          ],
        );
        companyId = cRes.rows[0]?.id ?? null;
      }

      // 3. Insert or merge contact
      let isFreshInsert = false;
      if (contactId) {
        // Conservative merge — never overwrite existing non-empty values
        await client.query(
          `update contacts set
             email             = coalesce(nullif(email::text, '')::citext, $2::citext),
             phone             = coalesce(nullif(phone, ''),               $3),
             linkedin_url      = coalesce(nullif(linkedin_url, ''),        $4),
             first_name        = coalesce(nullif(first_name, ''),          $5),
             last_name         = coalesce(nullif(last_name, ''),           $6),
             job_title         = coalesce(nullif(job_title, ''),           $7),
             company_id        = coalesce(company_id,                       $8),
             company_name_at_capture = coalesce(nullif(company_name_at_capture, ''), $9),
             apollo_person_id  = coalesce(nullif(apollo_person_id, ''),    $10),
             external_id       = coalesce(nullif(external_id, ''),         $11),
             source            = coalesce(nullif(source, ''),              $12),
             updated_at        = now()
           where id = $1`,
          [
            contactId,
            parsed.contact.email,
            parsed.contact.phone,
            parsed.contact.linkedin_url,
            firstName,
            lastName,
            parsed.contact.title ?? parsed.contact.role,
            companyId,
            parsed.company?.name,
            parsed.apollo_person_id,
            parsed.external_id,
            parsed.lead?.source ?? 'jarvis',
          ],
        );
      } else {
        const insertRes = await client.query<{ id: string }>(
          `insert into contacts
             (firm_id, email, phone, linkedin_url, first_name, last_name, job_title,
              company_id, company_name_at_capture, apollo_person_id, external_id, source, lifecycle_stage)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'lead')
           returning id`,
          [
            firmId,
            parsed.contact.email,
            parsed.contact.phone,
            parsed.contact.linkedin_url,
            firstName,
            lastName,
            parsed.contact.title ?? parsed.contact.role,
            companyId,
            parsed.company?.name ?? null,
            parsed.apollo_person_id,
            parsed.external_id,
            parsed.lead?.source ?? 'jarvis',
          ],
        );
        contactId = insertRes.rows[0]!.id;
        isFreshInsert = true;
      }

      // 4. Compute target tag set + honor stop tags
      const triggerTag = VERTICAL_ROUTING[vertical].triggerTag;
      const stopTags: readonly string[] = VERTICAL_ROUTING[vertical].stopTags;
      const existingTagsRes = await client.query<{ name: string }>(
        `select t.name from contact_tags ct
           join tags t on t.id = ct.tag_id
          where ct.contact_id = $1`,
        [contactId],
      );
      const existingTags = existingTagsRes.rows.map((r) => r.name);
      const stopTagBlocked = existingTags.find((t) => stopTags.includes(t)) ?? null;
      const triggerTagApplied = stopTagBlocked === null;

      const incomingExtras = (parsed.tags ?? []).filter((t) => !stopTags.includes(t));
      const allTags = new Set<string>([...existingTags, ...incomingExtras]);
      if (triggerTagApplied) allTags.add(triggerTag);

      // 5. Upsert each tag + link to contact
      for (const tagName of allTags) {
        const tagRes = await client.query<{ id: string }>(
          `insert into tags (firm_id, name) values ($1, $2)
             on conflict (firm_id, name) do update set name = excluded.name
             returning id`,
          [firmId, tagName],
        );
        const tagId = tagRes.rows[0]!.id;
        await client.query(
          `insert into contact_tags (firm_id, contact_id, tag_id)
             values ($1, $2, $3)
             on conflict (contact_id, tag_id) do nothing`,
          [firmId, contactId, tagId],
        );
      }

      // 6. Fire workflows for any newly-applied tag (especially trigger tag)
      const newlyApplied = [...allTags].filter((t) => !existingTags.includes(t));
      for (const tagName of newlyApplied) {
        await client.query(
          `insert into activities (firm_id, contact_id, type, payload)
             values ($1, $2, 'tag_added', $3)`,
          [firmId, contactId, JSON.stringify({ tag: tagName })],
        );
        // Enroll in any active workflow whose trigger_json matches this tag
        await client.query(
          `insert into workflow_runs (firm_id, workflow_id, contact_id, status, next_run_at, context)
             select $1, w.id, $2, 'running', now(),
                    jsonb_build_object('trigger', jsonb_build_object('type','tag_added','tag',$3::text))
               from workflows w
              where w.firm_id = $1
                and w.status = 'active'
                and w.trigger_json @> jsonb_build_object('type','tag_added','tag',$3::text)
             on conflict do nothing`,
          [firmId, contactId, tagName],
        );
      }

      // 7. Always create a fresh lead row
      const leadRes = await client.query<{ id: string }>(
        `insert into leads
           (firm_id, contact_id, company_id, vertical, source, interest,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            notes, raw_payload, external_id, apollo_person_id,
            trigger_tag_applied, stop_tag_blocked, match_signal)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         returning id`,
        [
          firmId,
          contactId,
          companyId,
          vertical,
          parsed.lead?.source ?? 'cold',
          parsed.lead?.interest ?? null,
          parsed.lead?.utm_source ?? null,
          parsed.lead?.utm_medium ?? null,
          parsed.lead?.utm_campaign ?? null,
          parsed.lead?.utm_term ?? null,
          parsed.lead?.utm_content ?? null,
          parsed.lead?.notes ?? null,
          parsed.lead?.raw_payload ? JSON.stringify(parsed.lead.raw_payload) : null,
          parsed.external_id ?? null,
          parsed.apollo_person_id ?? null,
          triggerTagApplied,
          stopTagBlocked,
          matchSignal,
        ],
      );
      const leadId = leadRes.rows[0]!.id;

      return {
        leadId,
        contactId,
        companyId,
        matchSignal,
        isFreshInsert,
        triggerTagApplied,
        stopTagBlocked,
        appliedTags: [...allTags],
      };
    });

    return NextResponse.json({
      ok: true,
      lead_id: result.leadId,
      contact_id: result.contactId,
      company_id: result.companyId,
      vertical,
      match_signal: result.matchSignal,
      is_fresh_insert: result.isFreshInsert,
      trigger_tag_applied: result.triggerTagApplied,
      stop_tag_blocked: result.stopTagBlocked,
      applied_tags: result.appliedTags,
      dedup_qualifiers: qualifiers,
    });
  } catch (err) {
    console.error('[jarvis.leads.POST]', { external_id: parsed.external_id, error: (err as Error).message });
    return NextResponse.json({ error: 'db_error', detail: (err as Error).message }, { status: 500 });
  }
}

// ╔══════════════════════════════════════════════════════════════════════════
// ║ GET /api/integrations/jarvis/leads — Mode A/B/C
// ╠══════════════════════════════════════════════════════════════════════════
export async function GET(req: Request) {
  const auth = checkJarvisToken(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const firmId = getJarvisDefaultFirmId();
  if (!firmId) {
    return NextResponse.json({ error: 'firm_not_configured' }, { status: 503 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  const contactId = url.searchParams.get('contact_id');
  const since = url.searchParams.get('since');
  const cursor = url.searchParams.get('cursor');
  const verticalParam = url.searchParams.get('vertical');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);

  if (verticalParam && !isKnownVertical(verticalParam)) {
    return NextResponse.json({ error: 'unknown_vertical' }, { status: 400 });
  }
  const vertical = verticalParam as Vertical | null;

  // ─── Mode A: single email ────────────────────────────────────────────────
  if (email) {
    const lower = email.toLowerCase().trim();
    const lead = await loadLeadByEmail(firmId, lower, vertical);
    return NextResponse.json(lead ? { found: true, lead } : { found: false, email: lower });
  }

  // ─── Mode B: single contact_id ───────────────────────────────────────────
  if (contactId) {
    const lead = await loadLeadByContactId(firmId, contactId, vertical);
    return NextResponse.json(lead ? { found: true, lead } : { found: false, contact_id: contactId });
  }

  // ─── Mode C: paginated since-cursor ──────────────────────────────────────
  if (!since) {
    return NextResponse.json({ error: 'missing_since', detail: 'Mode C requires ?since=<ISO8601>' }, { status: 400 });
  }
  const sinceDate = new Date(since);
  if (Number.isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: 'invalid_since' }, { status: 400 });
  }

  let cursorTime: string | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const [t, id] = decoded.split('|');
      cursorTime = t!;
      cursorId = id!;
    } catch {
      return NextResponse.json({ error: 'invalid_cursor' }, { status: 400 });
    }
  }

  const verticalFilter = vertical ? `and l.vertical = $${cursorTime ? 5 : 3}` : '';
  const params: unknown[] = [firmId, sinceDate.toISOString()];
  if (cursorTime) params.push(cursorTime, cursorId);
  if (vertical) params.push(vertical);
  params.push(limit + 1);

  const cursorClause = cursorTime ? `and (l.updated_at, l.id) > ($3::timestamptz, $4::uuid)` : '';
  const sql = `
    select l.*
      from leads l
     where l.firm_id = $1
       and l.updated_at >= $2::timestamptz
       ${cursorClause}
       ${verticalFilter}
     order by l.updated_at asc, l.id asc
     limit $${params.length}
  `;
  const rows = await query<LeadRow>(sql, params);

  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);
  const last = slice[slice.length - 1];
  const next_cursor =
    hasMore && last ? Buffer.from(`${last.updated_at}|${last.id}`).toString('base64') : null;

  const leads = await Promise.all(slice.map((r) => leadRowToShape(firmId, r, vertical)));

  return NextResponse.json({
    leads,
    next_cursor,
    count: leads.length,
    has_more: hasMore,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type LeadRow = {
  id: string;
  firm_id: string;
  contact_id: string;
  company_id: string | null;
  vertical: string;
  source: string | null;
  interest: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  notes: string | null;
  external_id: string | null;
  apollo_person_id: string | null;
  trigger_tag_applied: boolean | null;
  stop_tag_blocked: string | null;
  match_signal: string | null;
  created_at: string;
  updated_at: string;
};

async function loadLeadByEmail(firmId: string, emailNorm: string, vertical: Vertical | null) {
  const rows = await query<LeadRow & { contact_email: string | null; full_name: string | null; phone: string | null; title: string | null; company_name: string | null; company_type: string | null; tags: string[] | null }>(
    `select l.*, c.email::text as contact_email, c.full_name, c.phone, c.job_title as title,
            co.name as company_name, co.custom_fields->>'type' as company_type,
            array_agg(t.name) filter (where t.name is not null) as tags
       from leads l
       join contacts c on c.id = l.contact_id
  left join companies co on co.id = l.company_id
  left join contact_tags ct on ct.contact_id = c.id
  left join tags t on t.id = ct.tag_id
      where l.firm_id = $1 and c.email_normalized = $2
        ${vertical ? 'and l.vertical = $3' : ''}
      group by l.id, c.email, c.full_name, c.phone, c.job_title, co.name, co.custom_fields
      order by l.updated_at desc
      limit 1`,
    vertical ? [firmId, emailNorm, vertical] : [firmId, emailNorm],
  );
  const r = rows[0];
  if (!r) return null;
  return shapeLead(r, vertical);
}

async function loadLeadByContactId(firmId: string, contactId: string, vertical: Vertical | null) {
  const rows = await query<LeadRow & { contact_email: string | null; full_name: string | null; phone: string | null; title: string | null; company_name: string | null; company_type: string | null; tags: string[] | null }>(
    `select l.*, c.email::text as contact_email, c.full_name, c.phone, c.job_title as title,
            co.name as company_name, co.custom_fields->>'type' as company_type,
            array_agg(t.name) filter (where t.name is not null) as tags
       from leads l
       join contacts c on c.id = l.contact_id
  left join companies co on co.id = l.company_id
  left join contact_tags ct on ct.contact_id = c.id
  left join tags t on t.id = ct.tag_id
      where l.firm_id = $1 and l.contact_id = $2
        ${vertical ? 'and l.vertical = $3' : ''}
      group by l.id, c.email, c.full_name, c.phone, c.job_title, co.name, co.custom_fields
      order by l.updated_at desc
      limit 1`,
    vertical ? [firmId, contactId, vertical] : [firmId, contactId],
  );
  const r = rows[0];
  if (!r) return null;
  return shapeLead(r, vertical);
}

async function leadRowToShape(firmId: string, r: LeadRow, vertical: Vertical | null) {
  const enrichRes = await query<{ contact_email: string | null; full_name: string | null; phone: string | null; title: string | null; company_name: string | null; company_type: string | null; tags: string[] | null; dedup: unknown }>(
    `select c.email::text as contact_email, c.full_name, c.phone, c.job_title as title,
            co.name as company_name, co.custom_fields->>'type' as company_type,
            c.jarvis_dedup_qualifiers as dedup,
            array_agg(t.name) filter (where t.name is not null) as tags
       from contacts c
  left join companies co on co.id = c.company_id
  left join contact_tags ct on ct.contact_id = c.id
  left join tags t on t.id = ct.tag_id
      where c.firm_id = $1 and c.id = $2
      group by c.id, co.name, co.custom_fields`,
    [firmId, r.contact_id],
  );
  const e = enrichRes[0];
  return shapeLead({ ...r, ...(e ?? {}) } as LeadRow & Record<string, unknown>, vertical, e?.dedup);
}

function shapeLead(r: LeadRow & Record<string, unknown>, vertical: Vertical | null, dedupOverride?: unknown) {
  const tags = ((r.tags as string[] | null) ?? []) as string[];
  let stopTag: string | null = null;
  let activeBand: 'short' | 'long' | 'evergreen' | null = null;
  if (vertical) {
    const stops: readonly string[] = VERTICAL_ROUTING[vertical].stopTags;
    stopTag = tags.find((t) => stops.includes(t)) ?? null;
    const bands = VERTICAL_ROUTING[vertical].bandTags;
    if (tags.includes(bands.evergreen)) activeBand = 'evergreen';
    else if (tags.includes(bands.long)) activeBand = 'long';
    else if (tags.includes(bands.short)) activeBand = 'short';
  }
  return {
    lead_id: r.id,
    contact_id: r.contact_id,
    company_id: r.company_id,
    vertical: r.vertical,
    email: (r.contact_email as string | null) ?? null,
    full_name: (r.full_name as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    title: (r.title as string | null) ?? null,
    company_name: (r.company_name as string | null) ?? null,
    company_type: (r.company_type as string | null) ?? null,
    external_id: r.external_id,
    source: r.source,
    tags,
    active_band: activeBand,
    has_stop_tag: stopTag !== null,
    stop_tag: stopTag,
    created_at: r.created_at,
    updated_at: r.updated_at,
    dedup_qualifiers: dedupOverride ?? null,
  };
}
