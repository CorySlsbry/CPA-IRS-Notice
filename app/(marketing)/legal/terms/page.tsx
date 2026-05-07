export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 prose prose-neutral dark:prose-invert">
      <h1 className="font-serif text-4xl">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>

      <p className="mt-6">NoticeReply is software operated by Salisbury Bookkeeping (Power 22, LLC and affiliates). By using NoticeReply you agree to these terms. Plain language version below — full legal version sent on request.</p>

      <h2 className="mt-10 font-serif text-2xl">Service description</h2>
      <p>NoticeReply provides AI-assisted drafting of IRS-notice responses, certified-mail integration via Lob, and a CRM + analytics suite for CPA firms. NoticeReply is software. The CPA reviews and signs every response and is solely responsible for its content, accuracy, and the practitioner's compliance with Circular 230, IRS rules, and applicable state laws.</p>

      <h2 className="mt-10 font-serif text-2xl">Liability</h2>
      <p>To the maximum extent permitted by law, NoticeReply's aggregate liability for any claim is limited to the fees you paid us in the 12 months preceding the claim. We don't represent your client at appeals, in Tax Court, or before any state tax authority — that's your job as the practitioner.</p>

      <h2 className="mt-10 font-serif text-2xl">Acceptable use</h2>
      <p>Don't upload notices belonging to clients without authorization. Don't probe the system for vulnerabilities outside our security disclosure program. Don't use NoticeReply to spam — every outbound email engine here is rate-limited and reputation-tracked.</p>

      <h2 className="mt-10 font-serif text-2xl">Cancellation</h2>
      <p>Month-to-month, cancel any time from <code>/settings/billing</code>. After cancellation you keep 30 days of read-only access. CSV export is always available.</p>

      <h2 className="mt-10 font-serif text-2xl">Contact</h2>
      <p>Questions? Hit reply to any email — they all come to <a href="mailto:support@salisburybookkeeping.com">support@salisburybookkeeping.com</a>, a real human inbox.</p>
    </article>
  );
}
