export const metadata = { title: 'Data Processing Addendum' };

export default function DpaPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 prose prose-neutral dark:prose-invert">
      <h1 className="font-serif text-4xl">Data Processing Addendum</h1>
      <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>

      <p className="mt-6">This DPA forms part of the NoticeReply Terms of Service when the Customer (your firm) processes personal data of EU/UK/Swiss data subjects through NoticeReply.</p>

      <h2 className="mt-10 font-serif text-2xl">Roles</h2>
      <p>Customer is the Controller. Salisbury Bookkeeping (operator of NoticeReply) is the Processor. Sub-processors are listed in the Privacy Policy and updated whenever changes occur.</p>

      <h2 className="mt-10 font-serif text-2xl">Standard Contractual Clauses</h2>
      <p>The 2021 EU SCCs (Module Two — Controller to Processor) are incorporated by reference. UK addendum and Swiss FADP supplements apply where relevant.</p>

      <h2 className="mt-10 font-serif text-2xl">Customer obligations</h2>
      <ul>
        <li>Have a lawful basis for the personal data you upload to NoticeReply.</li>
        <li>Honor data-subject access / deletion / export requests originating from your contacts (we'll help — email support).</li>
      </ul>

      <h2 className="mt-10 font-serif text-2xl">Audit rights</h2>
      <p>Once per twelve months on 30 days' notice, on a confidential basis, with reasonable scope. SOC 2 reports satisfy this for most firms.</p>

      <h2 className="mt-10 font-serif text-2xl">Sign + countersign</h2>
      <p>For an executed PDF version, email <a href="mailto:support@salisburybookkeeping.com">support@salisburybookkeeping.com</a> with your firm name + signer.</p>
    </article>
  );
}
