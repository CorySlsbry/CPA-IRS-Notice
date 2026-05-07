import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/utils';

export const metadata = { title: 'Contact' };

export default async function ContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();

  const [{ data: contact }, { data: activities }, { data: tags }] = await Promise.all([
    sb.from('contacts').select('*').eq('id', id).maybeSingle(),
    sb
      .from('activities')
      .select('id, type, payload, occurred_at')
      .eq('contact_id', id)
      .order('occurred_at', { ascending: false })
      .limit(50),
    sb
      .from('contact_tags')
      .select('tag:tags(name, color)')
      .eq('contact_id', id),
  ]);

  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Button asChild variant="ghost" size="sm">
        <Link href="/contacts">
          <ArrowLeft className="size-4" /> All contacts
        </Link>
      </Button>

      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr,18rem]">
        <div>
          <h1 className="font-serif text-3xl">
            {contact.first_name ?? ''} {contact.last_name ?? '— no name —'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {contact.email}
            {contact.phone && <> · {contact.phone}</>}
            {contact.job_title && <> · {contact.job_title}</>}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="outline">{contact.lifecycle_stage}</Badge>
            {tags?.map(({ tag }: { tag: { name: string; color: string } | null }) =>
              tag ? (
                <Badge key={tag.name} style={{ backgroundColor: `${tag.color}33`, color: tag.color }}>
                  {tag.name}
                </Badge>
              ) : null,
            )}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {(activities ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="relative border-l border-border pl-5">
                  {activities?.map((a) => (
                    <li key={a.id} className="mb-5 last:mb-0">
                      <span className="absolute -left-1.5 mt-1 size-3 rounded-full border border-card bg-accent" />
                      <p className="text-sm">
                        <code className="font-mono text-xs text-muted-foreground">{a.type}</code>{' '}
                        <span className="text-muted-foreground">— {formatRelative(a.occurred_at)}</span>
                      </p>
                      {a.payload && Object.keys(a.payload as object).length > 0 && (
                        <pre className="mt-1 overflow-x-auto rounded bg-secondary/50 p-2 text-[11px] text-muted-foreground">
                          {JSON.stringify(a.payload, null, 2)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-serif text-4xl">{contact.lead_score}</p>
              <p className="mt-1 text-xs text-muted-foreground">Higher = warmer.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custom fields</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs">{JSON.stringify(contact.custom_fields ?? {}, null, 2)}</pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
