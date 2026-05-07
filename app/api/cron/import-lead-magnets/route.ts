import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { enrollContact } from '@/lib/workflows/enroll';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron-driven import of pending lead-magnet signups into the marketing
 * firm's CRM. Once a contact is created, the form_submit-triggered
 * "Welcome new subscriber" workflow takes over.
 *
 * Cloud Scheduler hits this every 5 min with x-cron-secret header.
 *
 * Set MARKETING_FIRM_ID in Secret Manager to the firm UUID that should
 * receive the imported contacts. Without it, signups are stored but
 * never imported — manual import via psql is the fallback.
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const marketingFirmId = process.env.MARKETING_FIRM_ID;
  if (!marketingFirmId) {
    return NextResponse.json({ skipped: 'MARKETING_FIRM_ID not set', imported: 0 });
  }

  const supabase = getSupabaseAdmin();
  const { data: pending, error } = await supabase
    .from('lead_magnet_signups')
    .select('id, magnet_id, email, firm_name, utm_source, utm_medium, utm_campaign')
    .is('imported_at', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let imported = 0;
  for (const row of (pending ?? []) as Array<{
    id: string;
    magnet_id: string;
    email: string;
    firm_name: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
  }>) {
    const { data: contact } = await supabase
      .from('contacts')
      .upsert(
        {
          firm_id: marketingFirmId,
          email: row.email.toLowerCase(),
          source: `lead_magnet:${row.magnet_id}`,
          lifecycle_stage: 'subscriber',
          custom_fields: { firm_name: row.firm_name },
          first_touch_utm: row.utm_source
            ? { source: row.utm_source, medium: row.utm_medium, campaign: row.utm_campaign }
            : null,
        },
        { onConflict: 'firm_id,email' },
      )
      .select('id')
      .single();

    if (contact) {
      await enrollContact({
        firmId: marketingFirmId,
        contactId: contact.id as string,
        trigger: { type: 'form_submit' },
      });
      await supabase
        .from('lead_magnet_signups')
        .update({ imported_to_firm_id: marketingFirmId, imported_at: new Date().toISOString() })
        .eq('id', row.id);
      imported += 1;
    }
  }

  return NextResponse.json({ imported, total_pending: pending?.length ?? 0 });
}

export async function GET(req: Request) {
  return POST(req);
}
