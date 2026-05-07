import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { looksLikeUnsubscribe, suppress } from './deliverability';

let _client: ReturnType<typeof google.gmail> | null = null;

function getGmail() {
  if (_client) return _client;
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  _client = google.gmail({ version: 'v1', auth: oauth2 });
  return _client;
}

/**
 * Pull recent inbox messages and persist any reply we haven't seen yet.
 * Threaded back to email_sends via Message-ID + In-Reply-To headers.
 */
export async function syncInbox(limit = 25): Promise<{ processed: number; matched: number }> {
  const gmail = getGmail();
  const supabase = getSupabaseAdmin();
  const me = process.env.GMAIL_INBOX_USER ?? 'me';

  const list = await gmail.users.messages.list({
    userId: me,
    q: 'in:inbox newer_than:1d -from:me',
    maxResults: limit,
  });

  let processed = 0;
  let matched = 0;
  for (const m of list.data.messages ?? []) {
    if (!m.id) continue;
    const { data: alreadySeen } = await supabase
      .from('inbound_messages')
      .select('id')
      .eq('gmail_message_id', m.id)
      .maybeSingle();
    if (alreadySeen) continue;

    const full = await gmail.users.messages.get({ userId: me, id: m.id, format: 'full' });
    const headers = (full.data.payload?.headers ?? []).reduce<Record<string, string>>((acc, h) => {
      if (h.name && h.value) acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});

    const fromEmail = extractEmail(headers['from'] ?? '');
    const inReplyTo = headers['in-reply-to'] ?? null;
    const references = headers['references'] ?? null;
    const subject = headers['subject'] ?? '';
    const receivedAt = new Date(parseInt(full.data.internalDate ?? `${Date.now()}`, 10)).toISOString();

    const bodyText = decodePart(full.data.payload, 'text/plain');
    const bodyHtml = decodePart(full.data.payload, 'text/html');

    // Match to original send.
    let matchedSend: { id: string; firm_id: string; contact_id: string | null } | null = null;
    if (inReplyTo) {
      const { data } = await supabase
        .from('email_sends')
        .select('id, firm_id, contact_id')
        .eq('message_id', inReplyTo)
        .maybeSingle();
      matchedSend = (data as typeof matchedSend) ?? null;
    }
    if (!matchedSend && references) {
      const idsInReferences = references.split(/\s+/).filter(Boolean);
      for (const ref of idsInReferences.reverse()) {
        const { data } = await supabase
          .from('email_sends')
          .select('id, firm_id, contact_id')
          .eq('message_id', ref)
          .maybeSingle();
        if (data) {
          matchedSend = data as typeof matchedSend;
          break;
        }
      }
    }

    if (!matchedSend) {
      // Persist as orphan inbound — no firm match.
      processed += 1;
      continue;
    }

    const isUnsub = looksLikeUnsubscribe(bodyText ?? '');

    await supabase.from('inbound_messages').insert({
      firm_id: matchedSend.firm_id,
      gmail_message_id: m.id,
      in_reply_to_message_id: inReplyTo,
      references_header: references,
      matched_email_send_id: matchedSend.id,
      contact_id: matchedSend.contact_id,
      from_email: fromEmail,
      to_email: extractEmail(headers['to'] ?? ''),
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      raw_headers: headers,
      received_at: receivedAt,
      processed_at: new Date().toISOString(),
      is_unsubscribe: isUnsub,
    });

    await supabase
      .from('email_sends')
      .update({ replied_at: receivedAt })
      .eq('id', matchedSend.id);

    if (matchedSend.contact_id) {
      await supabase.from('activities').insert({
        firm_id: matchedSend.firm_id,
        contact_id: matchedSend.contact_id,
        type: isUnsub ? 'email_unsubscribe' : 'email_reply',
        payload: { gmail_message_id: m.id, subject },
      });
    }

    if (isUnsub) {
      await suppress(matchedSend.firm_id, fromEmail, 'unsubscribe', 'reply_keyword');
    }

    // Add Gmail label so we don't reprocess.
    try {
      await gmail.users.messages.modify({
        userId: me,
        id: m.id,
        requestBody: { addLabelIds: await ensureLabel('nr/processed') },
      });
    } catch {
      // Non-fatal.
    }

    processed += 1;
    matched += 1;
  }

  return { processed, matched };
}

let _labelId: string[] | null = null;
async function ensureLabel(name: string): Promise<string[]> {
  if (_labelId) return _labelId;
  const gmail = getGmail();
  const me = process.env.GMAIL_INBOX_USER ?? 'me';
  const labels = await gmail.users.labels.list({ userId: me });
  const existing = labels.data.labels?.find((l) => l.name === name);
  if (existing?.id) {
    _labelId = [existing.id];
    return _labelId;
  }
  const created = await gmail.users.labels.create({
    userId: me,
    requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
  });
  _labelId = created.data.id ? [created.data.id] : [];
  return _labelId;
}

function extractEmail(header: string): string {
  const m = header.match(/<([^>]+)>/);
  return (m ? m[1] : header).trim().toLowerCase();
}

function decodePart(
  payload: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: unknown[] } | undefined,
  mimeType: 'text/plain' | 'text/html',
): string | null {
  if (!payload) return null;
  if (payload.mimeType === mimeType && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  for (const p of payload.parts ?? []) {
    const decoded = decodePart(p as Parameters<typeof decodePart>[0], mimeType);
    if (decoded) return decoded;
  }
  return null;
}
