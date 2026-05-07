import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Repeat, Zap } from 'lucide-react';

export const metadata = { title: 'Workflows' };

export default async function WorkflowsPage() {
  const sb = await createSupabaseServerClient();
  const { data: workflows } = await sb
    .from('workflows')
    .select('id, name, archetype, status, description, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Three archetypes — short-term campaigns, long-term nurture, evergreen behavior. Pre-loaded starters ready to fork.
          </p>
        </div>
        <Button asChild variant="gold" size="lg">
          <Link href="/workflows/new">+ New workflow</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <ArchetypeBlurb
          icon={<Zap className="size-5 text-accent" />}
          name="Short-term"
          body="5-30 day promos. Trial-end pushes, feature launches, tax-season activation."
        />
        <ArchetypeBlurb
          icon={<Calendar className="size-5 text-accent" />}
          name="Long-term"
          body="30-365 days. Cold-lead nurture, customer onboarding, quarterly newsletters."
        />
        <ArchetypeBlurb
          icon={<Repeat className="size-5 text-accent" />}
          name="Evergreen"
          body="Behavior-triggered. Welcome new subscribers, re-engage cold contacts, milestone follow-ups."
        />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">All workflows</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(workflows ?? []).map((w) => (
              <li key={w.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    <Link href={`/workflows/${w.id}`} className="hover:underline">
                      {w.name}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">{w.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{w.archetype}</Badge>
                  <Badge variant={w.status === 'active' ? 'green' : 'secondary'}>{w.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ArchetypeBlurb({ icon, name, body }: { icon: React.ReactNode; name: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-serif text-lg">{name}</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
