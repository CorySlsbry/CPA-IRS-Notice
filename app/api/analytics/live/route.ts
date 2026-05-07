import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { query } from '@/lib/db/pool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const since = url.searchParams.get('since');
  const sinceClause = since ? 'and pv.occurred_at > $2' : '';

  const rows = await query<{ id: string; path: string; occurred_at: string }>(
    `select pv.id, pv.path, pv.occurred_at
     from pageviews pv
     join firm_users fu on fu.firm_id = pv.firm_id
     join users u on u.id = fu.user_id
     where u.firebase_uid = $1
       and pv.occurred_at >= now() - interval '5 minutes'
       ${sinceClause}
     order by pv.occurred_at desc
     limit 12`,
    since ? [user.uid, since] : [user.uid],
  );

  return NextResponse.json({ pageviews: rows });
}
