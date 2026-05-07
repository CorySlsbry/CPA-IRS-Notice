export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 prose prose-neutral dark:prose-invert">
      <h1 className="font-serif text-4xl">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>

      <p className="mt-6">We collect the minimum needed to make NoticeReply work and we don't sell your data. Period.</p>

      <h2 className="mt-10 font-serif text-2xl">What we collect</h2>
      <ul>
        <li>Account info you give us: email, password (hashed), firm name, signer name.</li>
        <li>Notice images you upload — encrypted at rest in Supabase Storage.</li>
        <li>Taxpayer PII you enter in your CRM — encrypted at rest with Postgres pgcrypto.</li>
        <li>Email opens / clicks for messages we send (so you can see analytics).</li>
        <li>Anonymous website analytics from your firm's own site if you embed our tracking script — first-party only.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">What we don't do</h2>
      <ul>
        <li>We don't train AI models on your data. Each firm's prompts are isolated.</li>
        <li>We don't use Google Analytics, Facebook Pixel, or third-party trackers.</li>
        <li>We don't sell, rent, or share your contact lists with anyone.</li>
        <li>We don't store full credit-card numbers — Stripe handles that.</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">GDPR + CCPA</h2>
      <p>If you're an EU or California resident, you have rights to access, delete, and export your data. Email <a href="mailto:support@salisburybookkeeping.com">support@salisburybookkeeping.com</a> with the request and we'll handle it within 30 days.</p>

      <h2 className="mt-10 font-serif text-2xl">Sub-processors</h2>
      <ul>
        <li>Supabase — Postgres, Auth, Storage, Realtime</li>
        <li>Vercel — hosting</li>
        <li>Anthropic — AI inference (zero-retention enabled)</li>
        <li>Resend — outbound email</li>
        <li>Google Workspace — inbound email parsing</li>
        <li>Lob — certified mail printing</li>
        <li>Stripe — payments</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">Security</h2>
      <p>SOC 2 Type 1 audit in progress. TLS everywhere. RLS on every multi-tenant table. Encrypted PII at rest. If you find a vulnerability, please email <a href="mailto:security@salisburybookkeeping.com">security@salisburybookkeeping.com</a> — bounty program coming soon.</p>
    </article>
  );
}
