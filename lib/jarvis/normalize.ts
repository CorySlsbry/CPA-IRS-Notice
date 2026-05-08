/**
 * Server-side normalization helpers — MUST match Jarvis-side implementation
 * verbatim or hashes diverge across systems.
 *
 * Mirror of supabase/migrations/0008_jarvis_dedup.sql functions, but in TS
 * for use in /match (read-only, doesn't pass through SQL triggers).
 */

const COMPANY_SUFFIX_RE =
  /[\s,]+(corporation|enterprises|holdings|services|company|p\.c\.|p\.a\.|group|corp\.?|llc\.?|llp\.?|ltd\.?|inc\.?|pa\.?|pc\.?|co\.?)$/gi;
const COMPANY_PUNCT_RE = /[.,&'/()\[\]]/g;
const WHITESPACE_RE = /\s+/g;

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const v = email.toLowerCase().trim();
  return v || null;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits || null;
}

export function normalizeLinkedin(url: string | null | undefined): string | null {
  if (!url) return null;
  let v = url.toLowerCase().trim();
  v = v.split('?')[0]!;
  v = v.replace(/\/+$/, '');
  return v || null;
}

export function normalizeCompany(name: string | null | undefined): string | null {
  if (!name) return null;
  let v = name.toLowerCase().trim();
  v = v.replace(COMPANY_SUFFIX_RE, '');
  v = v.replace(COMPANY_PUNCT_RE, '');
  v = v.replace(WHITESPACE_RE, ' ').trim();
  return v || null;
}

export function computeNameCompanyKey(
  first: string | null | undefined,
  last: string | null | undefined,
  company: string | null | undefined,
): string | null {
  const name = `${(first ?? '').trim()} ${(last ?? '').trim()}`.trim().toLowerCase().replace(WHITESPACE_RE, ' ');
  const co = normalizeCompany(company);
  if (!name || !co) return null;
  return `${name}|${co}`;
}

/** Split a "Full Name" string into first + last using last-token-as-last rule. */
export function splitFullName(full: string | null | undefined): { first: string | null; last: string | null } {
  if (!full) return { first: null, last: null };
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0]!, last: null };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1]! };
}

export type DedupQualifiers = {
  email_normalized: string | null;
  phone_digits: string | null;
  linkedin_normalized: string | null;
  name_company_key: string | null;
  apollo_person_id: string | null;
  external_id: string | null;
};

export function computeQualifiers(args: {
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  apolloPersonId?: string | null;
  externalId?: string | null;
}): DedupQualifiers {
  let first = args.firstName ?? null;
  let last = args.lastName ?? null;
  if ((!first || !last) && args.fullName) {
    const split = splitFullName(args.fullName);
    first = first ?? split.first;
    last = last ?? split.last;
  }
  return {
    email_normalized: normalizeEmail(args.email),
    phone_digits: normalizePhone(args.phone),
    linkedin_normalized: normalizeLinkedin(args.linkedinUrl),
    name_company_key: computeNameCompanyKey(first, last, args.companyName),
    apollo_person_id: args.apolloPersonId ?? null,
    external_id: args.externalId ?? null,
  };
}
