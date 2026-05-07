import { NextResponse } from 'next/server';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';

export const runtime = 'nodejs';

const inputSchema = z.object({
  me: z.string().email(),
  friends: z.array(z.string().email()).length(2),
});

const codeGen = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'sharklasers.com', 'yopmail.com',
]);

function isDisposable(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return DISPOSABLE_DOMAINS.has(domain);
}

export async function POST(req: Request) {
  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_emails' }, { status: 400 });

  const { me, friends } = parsed.data;
  const allEmails = [me, ...friends].map((e) => e.toLowerCase());
  if (new Set(allEmails).size !== 3) {
    return NextResponse.json({ error: 'duplicate_emails' }, { status: 400 });
  }
  if (allEmails.some(isDisposable)) {
    return NextResponse.json({ error: 'disposable_email_blocked' }, { status: 400 });
  }

  const code = `REFER2-${codeGen()}`;

  // TODO: persist to a referrals table once we have it; out of scope for v1 SQL.
  // For now, fire-and-forget the welcome emails.

  // Use Resend directly so referral emails don't require a firm context.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const fromAddress = `${process.env.DEFAULT_FROM_NAME ?? 'Cory @ Salisbury Bookkeeping'} <support@${process.env.RESEND_TRANSACTIONAL_DOMAIN ?? 'salisburybookkeeping.com'}>`;
    const subject = `Your 20% off NoticeReply code: ${code}`;
    const text = (recipient: string) => `Hi —

You're getting this because ${recipient === me ? 'you' : me} just started a referral chain. All three of you get 20% off NoticeReply for life when you sign up with this code:

${code}

Apply at checkout. Locks for life on any tier.

→ https://noticereply.com/signup?code=${encodeURIComponent(code)}

— Cory
Salisbury Bookkeeping
`;
    await Promise.all(
      allEmails.map((to) =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ from: fromAddress, to: [to], subject, text: text(to) }),
        }).catch(() => null),
      ),
    );
  }

  return NextResponse.json({ ok: true, code });
}
