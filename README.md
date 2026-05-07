# NoticeReply

> AI-drafted IRS notice responses with one-click certified mail.
> Plus a built-in CRM, email engine, and website analytics suite for CPA firms.

This is the production codebase for NoticeReply — a vertical SaaS that bundles
two products into one login:

1. **The wedge** — Snap a photo of an IRS notice, AI classifies and drafts a
   response in under 60 seconds, you review and click "Mail it" to ship a
   certified letter via Lob.
2. **The moat** — A complete CRM + email engine + workflow builder + website
   visitor analytics suite. Replaces HubSpot, ActiveCampaign, and the like.

NoticeReply itself dogfoods the CRM — the trial-nurture sequence runs through
the same workflow runner customers use.

## Stack

- **Next.js 16** App Router, **React 19**, **TypeScript** strict
- **Tailwind 4** + **shadcn/ui** + **framer-motion** + **lucide-react**
- **Supabase** for Postgres / Realtime / Auth / Storage
- **Anthropic SDK** — Sonnet 4.6 for classify + draft, Vision for OCR. Aggressive prompt caching.
- **Resend** outbound + **Gmail API** inbound (Salisbury Bookkeeping sender — see Email below)
- **Lob** for certified-mail printing
- **Stripe** for subscriptions + Customer Portal
- **React Flow** for the visual workflow builder
- **Vitest** + **Playwright** for tests

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in values — see "Provisioning" below
npm run dev                     # http://localhost:3000
```

Run the migrations against your Supabase project (in order):

```bash
supabase db push                            # if using the supabase CLI
# or paste each file in supabase/migrations/ into the SQL editor in order
```

Generate the typed Database client after migrations apply:

```bash
SUPABASE_PROJECT_ID=<your-id> npm run db:types
```

## Provisioning checklist

1. **Supabase** — create a new project. Run all 4 migrations in `supabase/migrations/`. Enable Realtime on the `pageviews` table (the last migration does this).
2. **Resend** — verify two domains:
   - `salisburybookkeeping.com` (apex — transactional + 1:1 workflow steps)
   - `mail.salisburybookkeeping.com` (subdomain — marketing + bulk workflow steps)
   See **Email deliverability runbook** below for DNS records.
3. **Google Workspace OAuth** — create an OAuth client (Web Application). Authorize `https://YOUR-APP.com/api/inbox/oauth/callback`. Add `gmail.readonly` + `gmail.modify` scopes. Persist the refresh token to `GOOGLE_OAUTH_REFRESH_TOKEN`.
4. **Stripe** — create the three products + monthly prices. Configure the webhook endpoint at `/api/webhooks/stripe` with `customer.subscription.*` and `checkout.session.completed` events. Save the signing secret.
5. **Lob** — generate a test key first (`sk_test_*`). Production switch happens in `.env.production` only after a manual end-to-end test.
6. **Vercel cron** — already configured in `vercel.json` to hit `/api/workflows/tick` and `/api/inbox/sync` every minute. Set `CRON_SECRET` to a long random string in Vercel env vars.

## Project layout

```
noticereply/
├── app/
│   ├── (marketing)/             ← Public landing pages
│   ├── (auth)/                  ← Signup + login
│   ├── (app)/                   ← Authenticated app
│   │   ├── dashboard/
│   │   ├── notices/
│   │   ├── contacts/
│   │   ├── pipelines/
│   │   ├── tags/
│   │   ├── campaigns/
│   │   ├── workflows/
│   │   ├── forms/
│   │   ├── analytics/
│   │   └── settings/
│   └── api/
│       ├── notices/{classify,draft,mail}/
│       ├── contacts/import/
│       ├── workflows/tick/        ← Vercel cron entry point
│       ├── inbox/sync/            ← Gmail polling
│       ├── track/{pixel.gif,click,visit,event,identify,page-finalize,unsubscribe}/
│       ├── public/v1/{contacts,events,referral/submit}/
│       └── webhooks/{stripe,resend}/
├── lib/
│   ├── ai/                       ← Anthropic + cached prompts
│   ├── email/                    ← Resend sender + Gmail inbound + react-email templates
│   ├── crm/                      ← Segment compiler
│   ├── workflows/                ← Runner + types + ai-step + enrollment
│   ├── analytics/
│   ├── stripe/
│   ├── lob/
│   ├── api/                      ← Public API auth + rate limit
│   └── supabase/                 ← server / browser / admin clients
├── components/
│   ├── marketing/                ← Hero, ValueStack, Comparison, etc.
│   └── ui/                       ← shadcn primitives
├── prompts/                      ← Versioned AI prompts (classify, draft, workflow_ai_step)
├── supabase/migrations/          ← 4 SQL files: init, RLS, seed_starters, analytics_views
├── public/track.js               ← Embeddable visitor-tracking script
└── tests/                        ← Vitest unit + Playwright e2e
```

## Email deliverability runbook

Per the build memory: **all NoticeReply outbound email sends from
`support@salisburybookkeeping.com`**. This is peer-to-peer authority for
CPA-to-CPA selling. Replies land in a real human-monitored Google Workspace
inbox.

### Sending architecture

| Use case | Service | Sending domain |
|---|---|---|
| Cold outreach, marketing campaigns, nurture, bulk | Resend | `mail.salisburybookkeeping.com` (subdomain) |
| Transactional, 1:1 workflow steps | Resend | `salisburybookkeeping.com` (apex) |
| Inbound replies | Gmail (Workspace) | apex |

`lib/email/sender.ts` routes by `category` to the right Resend domain. The
suppression list is shared across all categories (single source of truth in
Postgres).

### DNS records

**Apex `salisburybookkeeping.com`:**

```
TXT  @                v=spf1 include:_spf.google.com include:_spf.resend.com -all
TXT  google._domainkey   (Workspace DKIM — already configured)
TXT  resend._domainkey   (Resend apex DKIM — provided by Resend)
TXT  _dmarc           v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@salisburybookkeeping.com; ruf=mailto:dmarc@salisburybookkeeping.com; fo=1
```

**Subdomain `mail.salisburybookkeeping.com`:**

```
TXT  @                    v=spf1 include:_spf.resend.com -all
TXT  resend._domainkey    (Resend subdomain DKIM — separate key)
MX   @                    feedback-smtp.us-east-1.amazonses.com
TXT  @                    v=DMARC1; p=quarantine; rua=mailto:dmarc@salisburybookkeeping.com
```

After 14 days clean, tighten apex DMARC to `p=reject`.

### Warmup ladder (subdomain only — apex is established)

| Days | Daily cap |
|------|-----------|
| 1-3  | 50        |
| 4-7  | 200       |
| 8-14 | 1,000     |
| 15+  | unrestricted (within Resend plan) |

Enforced in `lib/email/sender.ts` → `getDailyCap`. Bulk sends that exceed the
cap defer to the next day automatically.

### Suppression rules

- **Hard bounce** → auto-suppress + mirror onto `contacts.bounced_at`
- **Complaint** → auto-suppress + mirror onto `contacts.marked_spam_at` + alert firm
- **Unsubscribe** (link click OR reply with "unsubscribe" / "remove me") → auto-suppress + mirror onto `contacts.unsubscribed_at`
- Suppression list is per-firm. Manual entries via admin UI.
- Mandatory `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header on every send.

### Inbound reply capture

Gmail API polls every 60s via `/api/inbox/sync`. New messages are matched to
the originating `email_sends.message_id` via `In-Reply-To` + `References`
headers, persisted to `inbound_messages`, and an `email_reply` activity is
written to the contact timeline. Replies trigger any `email_replied`
workflow.

## How to add a new IRS notice type

1. Add the enum value in `supabase/migrations/000X_add_notice_type.sql`:
   ```sql
   alter type notice_type add value if not exists 'CP-NEW';
   ```
2. Update `lib/ai/classify-notice.ts` `noticeTypeEnum` to include it.
3. Optionally add a strategy template hint in `prompts/draft_response.v1.md`.
4. Bump the prompt version (`v1` → `v2`) — keep both files for rollback.

## How to author a workflow archetype starter

Edit `supabase/migrations/0003_seed_starters.sql`. The `seed_starter_assets`
function runs on every new firm signup. Add another `insert into workflows ...`
block following the existing pattern. Use the visual editor at
`/workflows/[id]` to design the graph, then copy the JSON.

## AI cost targets

- **Classify (Vision OCR + JSON extraction):** < $0.05 per notice
- **Draft response:** < $0.45 per notice
- **Workflow AI step:** < $0.02 per call (cached system prompts; small token budget)

Total target: < $0.50 per notice processed end-to-end.

## Verification

```bash
npm run typecheck           # tsc --noEmit
npm run lint                # next lint
npm run test                # vitest run
npm run test:e2e            # playwright (requires npm run dev to be cold-startable)
npm run fallow              # AI-slop static analysis
npm run format:check        # prettier
```

## Compliance + security

- Taxpayer PII encrypted at rest using Postgres `pgcrypto`
- TLS-only (Vercel default)
- RLS enabled on every tenant table — see `supabase/migrations/0002_rls.sql`
- Audit log: every status / data change is captured via `activities` + `events` tables
- Tracking script: EU IP truncation, no cookies before consent, DNT respected
- Public API: per-firm key (sha256-hashed at rest) + plan-tier rate limits
- Stripe + Resend webhook signatures verified before write

## Built by

[Salisbury Bookkeeping](https://salisburybookkeeping.com) — Tucson, AZ.

NoticeReply is **software**. Every IRS notice response is reviewed and signed
by a CPA, who is solely responsible for its content. Same liability profile
as ProSeries or Lacerte.
