import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiKeyClient } from './api-key-client';

export const metadata = { title: 'API + webhooks' };

export default function ApiSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl">API + webhooks</h1>
      <p className="mt-1 text-sm text-muted-foreground">Wire NoticeReply into Zapier, Make, custom code, or your existing stack.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Your API key</CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeyClient />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <Endpoint method="POST" path="/api/public/v1/contacts" body="Upsert a contact (dedupe by email). Optionally pass tags + custom_fields." />
          <Endpoint method="GET" path="/api/public/v1/contacts" body="List contacts (limit + offset). Default 50, max 200." />
          <Endpoint method="POST" path="/api/public/v1/events" body="Fire a custom event. Triggers any 'custom_event' workflows." />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Tracking script embed</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded bg-secondary/50 p-3 font-mono text-xs">
{`<script async src="https://noticereply.com/track.js"
  data-firm="<YOUR_FIRM_ID>"></script>`}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            One line in your site &lt;head&gt;. Real-time visitor map turns on. Identify visitors by calling{' '}
            <code className="rounded bg-secondary px-1">nr.identify(email, traits)</code> when they sign up.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Endpoint({ method, path, body }: { method: string; path: string; body: string }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <p className="font-mono text-xs">
        <span className="rounded bg-accent/20 px-1.5 py-0.5 font-semibold">{method}</span> <span>{path}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
