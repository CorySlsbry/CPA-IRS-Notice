import { query } from '@/lib/db/pool';
import { VERTICAL_ROUTING, type Vertical } from './auth';
import type { DedupQualifiers } from './normalize';

export type ContactMatch = {
  contactId: string;
  signal: 'email_normalized' | 'apollo_person_id' | 'phone_digits' | 'name_company_key' | 'linkedin_normalized';
  email: string | null;
  tags: string[];
  hasStopTag: boolean;
  stopTag: string | null;
  activeBand: 'short' | 'long' | 'evergreen' | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Find a contact by dedup qualifiers in Jarvis priority order:
 *   email_normalized → apollo_person_id → phone_digits → name_company_key → linkedin_normalized
 *
 * Returns the first hit. Each lookup is an Index Scan against a partial unique
 * index, so p99 stays under 100ms.
 */
export async function findMatch(
  firmId: string,
  q: DedupQualifiers,
  vertical: Vertical | null,
): Promise<ContactMatch | null> {
  const lookups: Array<{ signal: ContactMatch['signal']; column: string; value: string | null }> = [
    { signal: 'email_normalized', column: 'email_normalized', value: q.email_normalized },
    { signal: 'apollo_person_id', column: 'apollo_person_id', value: q.apollo_person_id },
    { signal: 'phone_digits', column: 'phone_digits', value: q.phone_digits },
    { signal: 'name_company_key', column: 'name_company_key', value: q.name_company_key },
    { signal: 'linkedin_normalized', column: 'linkedin_normalized', value: q.linkedin_normalized },
  ];

  for (const { signal, column, value } of lookups) {
    if (!value) continue;
    const rows = await query<{
      id: string;
      email: string | null;
      tags: string[] | null;
      created_at: string;
      updated_at: string;
    }>(
      `select c.id, c.email, c.created_at, c.updated_at,
              array_agg(t.name) filter (where t.name is not null) as tags
         from contacts c
         left join contact_tags ct on ct.contact_id = c.id
         left join tags t on t.id = ct.tag_id
        where c.firm_id = $1 and c.${column} = $2
        group by c.id
        limit 1`,
      [firmId, value],
    );
    const row = rows[0];
    if (!row) continue;
    const tags = row.tags ?? [];
    return buildMatch(signal, row.id, row.email, tags, row.created_at, row.updated_at, vertical);
  }
  return null;
}

function buildMatch(
  signal: ContactMatch['signal'],
  contactId: string,
  email: string | null,
  tags: string[],
  createdAt: string,
  updatedAt: string,
  vertical: Vertical | null,
): ContactMatch {
  let stopTag: string | null = null;
  let hasStopTag = false;
  let activeBand: ContactMatch['activeBand'] = null;

  if (vertical) {
    const stopTags: readonly string[] = VERTICAL_ROUTING[vertical].stopTags;
    stopTag = tags.find((t) => stopTags.includes(t)) ?? null;
    hasStopTag = stopTag !== null;
    const bands = VERTICAL_ROUTING[vertical].bandTags;
    if (tags.includes(bands.evergreen)) activeBand = 'evergreen';
    else if (tags.includes(bands.long)) activeBand = 'long';
    else if (tags.includes(bands.short)) activeBand = 'short';
  }

  return {
    contactId,
    signal,
    email,
    tags,
    hasStopTag,
    stopTag,
    activeBand,
    createdAt,
    updatedAt,
  };
}
