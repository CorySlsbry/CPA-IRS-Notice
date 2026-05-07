import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Email settings' };

export default function EmailSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl">Email + sending domain</h1>
      <p className="mt-1 text-sm text-muted-foreground">Where your outbound mail leaves from + the warmup ramp.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Default sender — Salisbury Bookkeeping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            All outbound NoticeReply marketing, nurture, and transactional emails default to{' '}
            <code className="rounded bg-secondary px-1">support@salisburybookkeeping.com</code>. Replies thread back into the activity timeline of the relevant contact within 60 seconds.
          </p>
          <div className="rounded-md border border-border bg-secondary/30 p-4 font-mono text-xs">
            <div>Marketing/bulk → mail.salisburybookkeeping.com (subdomain)</div>
            <div>Transactional/1:1 → salisburybookkeeping.com (apex)</div>
            <div>Inbound → support@salisburybookkeeping.com (Google Workspace)</div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Domain warmup — mail. subdomain</CardTitle>
        </CardHeader>
        <CardContent>
          <Status label="Day 1-3" cap="50/day" status="active" />
          <Status label="Day 4-7" cap="200/day" status="upcoming" />
          <Status label="Day 8-14" cap="1,000/day" status="upcoming" />
          <Status label="Day 15+" cap="50,000/day (plan limit)" status="upcoming" />
          <p className="mt-3 text-xs text-muted-foreground">
            Bulk sends that exceed today's cap are queued for tomorrow. Apex sends are not capped.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">DNS records</CardTitle>
        </CardHeader>
        <CardContent>
          <Dns hostname="@ (apex)" type="TXT" value="v=spf1 include:_spf.google.com include:_spf.resend.com -all" />
          <Dns hostname="resend._domainkey" type="TXT" value="(provided by Resend)" />
          <Dns hostname="_dmarc" type="TXT" value="v=DMARC1; p=quarantine; rua=mailto:dmarc@salisburybookkeeping.com" />
          <Dns hostname="mail (subdomain)" type="TXT" value="v=spf1 include:_spf.resend.com -all" />
          <Dns hostname="resend._domainkey.mail" type="TXT" value="(provided by Resend — separate key)" />
        </CardContent>
      </Card>
    </div>
  );
}

function Status({ label, cap, status }: { label: string; cap: string; status: 'active' | 'upcoming' }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span>
        <span className="font-medium">{label}</span> <span className="text-muted-foreground">— {cap}</span>
      </span>
      <Badge variant={status === 'active' ? 'green' : 'outline'}>{status}</Badge>
    </div>
  );
}

function Dns({ hostname, type, value }: { hostname: string; type: string; value: string }) {
  return (
    <div className="border-b border-border py-2 text-xs last:border-0">
      <span className="font-mono font-semibold">{hostname}</span> <span className="text-muted-foreground">— {type}</span>
      <pre className="mt-1 overflow-x-auto rounded bg-secondary/50 px-2 py-1 font-mono text-[11px]">{value}</pre>
    </div>
  );
}
