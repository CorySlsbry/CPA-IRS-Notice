import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function isSuppressed(firmId: string, email: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('suppressions')
    .select('email')
    .eq('firm_id', firmId)
    .eq('email', email.toLowerCase())
    .maybeSingle();
  return !!data;
}

export async function suppress(
  firmId: string,
  email: string,
  reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual',
  detail?: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('suppressions')
    .upsert(
      { firm_id: firmId, email: email.toLowerCase(), reason, reason_detail: detail ?? null },
      { onConflict: 'firm_id,email' },
    );

  // Mirror onto the contact record so segment filters see it.
  const field = reason === 'unsubscribe' ? 'unsubscribed_at' : reason === 'bounce' ? 'bounced_at' : 'marked_spam_at';
  await supabase
    .from('contacts')
    .update({ [field]: new Date().toISOString() })
    .eq('firm_id', firmId)
    .eq('email', email.toLowerCase());
}

const UNSUB_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\btake me off\b/i,
  /\bplease stop\b/i,
  /\bopt[- ]?out\b/i,
];

export function looksLikeUnsubscribe(body: string): boolean {
  return UNSUB_PATTERNS.some((re) => re.test(body));
}
