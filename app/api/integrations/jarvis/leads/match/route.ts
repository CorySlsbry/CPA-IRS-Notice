import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkJarvisToken, getJarvisDefaultFirmId, isKnownVertical, VERTICAL_ROUTING, type Vertical } from '@/lib/jarvis/auth';
import { computeQualifiers, splitFullName } from '@/lib/jarvis/normalize';
import { findMatch } from '@/lib/jarvis/match';

export const runtime = 'nodejs';
export const maxDuration = 10;

const matchSchema = z.object({
  vertical: z.string().optional(),
  email: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  full_name: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedin_url: z.string().optional().nullable(),
  apollo_person_id: z.string().optional().nullable(),
  external_id: z.string().optional().nullable(),
});

/**
 * Read-only, write-nothing match. Jarvis calls this BEFORE deciding whether
 * to spend an Apollo credit / push. Designed for p99 ≤ 100ms — every signal
 * lookup is a partial-unique-index probe.
 */
export async function POST(req: Request) {
  const auth = checkJarvisToken(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const firmId = getJarvisDefaultFirmId();
  if (!firmId) {
    return NextResponse.json({ error: 'firm_not_configured' }, { status: 503 });
  }

  let parsed: z.infer<typeof matchSchema>;
  try {
    parsed = matchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'validation_failed', details: (err as z.ZodError).flatten() }, { status: 400 });
  }

  const verticalParam = parsed.vertical;
  if (verticalParam && !isKnownVertical(verticalParam)) {
    return NextResponse.json({ error: 'unknown_vertical', vertical: verticalParam }, { status: 400 });
  }
  const vertical: Vertical | null = (verticalParam as Vertical | undefined) ?? null;

  let firstName = parsed.first_name ?? null;
  let lastName = parsed.last_name ?? null;
  if ((!firstName || !lastName) && parsed.full_name) {
    const split = splitFullName(parsed.full_name);
    firstName = firstName ?? split.first;
    lastName = lastName ?? split.last;
  }

  const qualifiers = computeQualifiers({
    email: parsed.email,
    phone: parsed.phone,
    linkedinUrl: parsed.linkedin_url,
    firstName,
    lastName,
    companyName: parsed.company_name,
    apolloPersonId: parsed.apollo_person_id,
    externalId: parsed.external_id,
  });

  const match = await findMatch(firmId, qualifiers, vertical);
  if (!match) {
    return NextResponse.json({ matched: false });
  }

  const verticalContext = vertical
    ? {
        vertical,
        trigger_tag_applied: match.tags.includes(VERTICAL_ROUTING[vertical].triggerTag),
        active_band: match.activeBand,
      }
    : null;

  return NextResponse.json({
    matched: true,
    signal: match.signal,
    contact_id: match.contactId,
    tags: match.tags,
    has_stop_tag: match.hasStopTag,
    stop_tag: match.stopTag,
    vertical_context: verticalContext,
    created_at: match.createdAt,
    updated_at: match.updatedAt,
  });
}
