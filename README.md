# NoticeReply

> AI-drafted IRS notice responses with one-click certified mail.
> Plus a built-in CRM, email engine, and website analytics suite for CPA firms.

Production codebase for NoticeReply — a vertical SaaS that bundles two
products into one login:

1. **The wedge** — Snap a photo of an IRS notice, AI classifies and drafts a
   response in under 60 seconds, you review and click "Mail it" to ship a
   certified letter via Lob.
2. **The moat** — A complete CRM + email engine + workflow builder + website
   visitor analytics suite. Replaces HubSpot, ActiveCampaign, and the like.

NoticeReply itself dogfoods the CRM — the trial-nurture sequence runs through
the same workflow runner customers use.

## Stack — all on Google Cloud

- **Next.js 16** App Router, **React 19**, **TypeScript** strict
- **Tailwind 4** + **shadcn/ui** + **framer-motion** + **lucide-react**
- **Cloud SQL Postgres** for data — accessed via `pg` and a thin
  Supabase-compatible query builder (`lib/db/query-builder.ts`)
- **Firebase Auth** for users — session cookies minted server-side via
  the Firebase Admin SDK (`lib/auth/`)
- **Cloud Storage** for notice image uploads
- **Cloud Run** for hosting (Dockerfile + `cloudbuild.yaml` included)
- **Cloud Scheduler** for the workflow tick + Gmail-inbound polls
- **Anthropic SDK** — Sonnet 4.6 for classify + draft, Vision for OCR.
- **Resend** outbound + **Gmail API** inbound (Salisbury Bookkeeping sender — see Email runbook below)
- **Lob** for certified-mail printing
- **Stripe** for subscriptions + Customer Portal
- **React Flow** for the visual workflow builder
- **Vitest** + **Playwright** for tests

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in values — see "Provisioning" below

# Run Cloud SQL Auth Proxy in another terminal
cloud-sql-proxy <PROJECT>:<REGION>:noticereply --port 5432
# Then point DATABASE_URL=postgres://app:<pwd>@127.0.0.1:5432/noticereply

npm run dev                     # http://localhost:3000
```

Run the migrations against Cloud SQL (in order, via psql or the Cloud Console SQL editor):

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_rls.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_seed_starters.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_analytics_views.sql
```

## Provisioning checklist

### One-time GCP setup

1. **Enable APIs:** Cloud Run, Cloud Build, Cloud SQL Admin, Artifact Registry, Secret Manager, Identity Platform (or Firebase Auth), Cloud Storage, Cloud Scheduler.
2. **Create Cloud SQL Postgres 16** instance named `noticereply` (1 vCPU / 4GB is plenty for v1). Create database `noticereply`, role `app` with a strong password.
3. **Create Artifact Registry repo** `noticereply` (Docker, in `us-central1`).
4. **Create Cloud Storage bucket** `noticereply-uploads` (uniform access, regional, lifecycle = delete unattached after 90d).
5. **Create runtime service account** `noticereply-runner@<PROJECT>.iam.gserviceaccount.com` and grant it: `roles/cloudsql.client`, `roles/secretmanager.secretAccessor`, `roles/storage.objectAdmin` on the bucket, `roles/firebaseauth.viewer`.

### Firebase Auth

1. Set up a Firebase project (free Spark tier is fine).
2. Enable Email/Password auth (and any OAuth providers you want).
3. Create a Web App; copy the public config keys to `NEXT_PUBLIC_FIREBASE_*`.
4. **Production:** attach the runtime service account to Cloud Run — no inline credentials needed (Application Default Credentials work).
5. **Local dev:** download a service-account JSON, paste into `FIREBASE_SERVICE_ACCOUNT` env (single-line JSON, escape newlines).

### Resend (email — both domains)

Verify two domains in Resend:
- `salisburybookkeeping.com` (apex — transactional + 1:1 workflow steps)
- `mail.salisburybookkeeping.com` (subdomain — marketing + bulk workflow steps)

DNS records for each are spelled out in the **Email deliverability runbook** below.

### Gmail Workspace OAuth (inbound replies)

Create an OAuth 2.0 Web Application client in your GCP project. Authorize:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`

Get a refresh token via the OAuth playground (one-time) and store it as
`GOOGLE_OAUTH_REFRESH_TOKEN` in Secret Manager.

### Stripe

Create three products + monthly prices ($99, $299, $599). Webhook endpoint at
`/api/webhooks/stripe` listening for `customer.subscription.*` and
`checkout.session.completed`. Save the signing secret.

### Lob

`sk_test_*` key first. Production switch happens by swapping the secret,
no code change.

### Secrets in Secret Manager

Create these secrets and grant `roles/secretmanager.secretAccessor` to the
runtime service account:

```
DATABASE_URL                  postgres://app:<pwd>@/noticereply?host=/cloudsql/<INSTANCE>
FIREBASE_SERVICE_ACCOUNT      {"type":"service_account",...}     # optional on Cloud Run
ANTHROPIC_API_KEY             sk-ant-...
RESEND_API_KEY                re_...
STRIPE_SECRET_KEY             sk_live_...
STRIPE_WEBHOOK_SECRET         whsec_...
STRIPE_PRICE_FOUNDING         price_...
STRIPE_PRICE_STANDARD         price_...
STRIPE_PRICE_PRO              price_...
LOB_API_KEY                   sk_test_... or sk_live_...
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REFRESH_TOKEN
GMAIL_INBOX_USER              support@salisburybookkeeping.com
CRON_SECRET                   <32-char hex>
```

### Cloud Build trigger (GitHub → Cloud Run)

```bash
gcloud beta builds triggers create github \
  --repo-name=CPA-IRS-Notice \
  --repo-owner=CorySlsbry \
  --branch-pattern=^main$ \
  --build-config=cloudbuild.yaml \
  --region=us-central1 \
  --substitutions=_REGION=us-central1,_SERVICE=noticereply,_AR_REPO=noticereply,_CLOUDSQL_INSTANCE=<PROJECT>:us-central1:noticereply,_SERVICE_ACCOUNT=noticereply-runner@<PROJECT>.iam.gserviceaccount.com,_NEXT_PUBLIC_FIREBASE_API_KEY=<key>,_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authdomain>,_NEXT_PUBLIC_FIREBASE_PROJECT_ID=<projid>,_NEXT_PUBLIC_FIREBASE_APP_ID=<appid>
```

After the first push to `main`, Cloud Build will build the Docker image,
push to Artifact Registry, and deploy to Cloud Run.

### Cloud Scheduler (workflow tick + inbox sync)

```bash
# Workflow tick — every minute
gcloud scheduler jobs create http noticereply-tick \
  --location=us-central1 \
  --schedule="* * * * *" \
  --uri="https://<CLOUD_RUN_URL>/api/workflows/tick" \
  --http-method=POST \
  --headers="x-cron-secret=<CRON_SECRET>"

# Gmail inbound — every minute
gcloud scheduler jobs create http noticereply-inbox-sync \
  --location=us-central1 \
  --schedule="* * * * *" \
  --uri="https://<CLOUD_RUN_URL>/api/inbox/sync" \
  --http-method=POST \
  --headers="x-cron-secret=<CRON_SECRET>"
```

## Project layout

```
noticereply/
├── app/
│   ├── (marketing)/             ← Public landing pages (Hormozi above-fold spec)
│   ├── (auth)/                  ← Signup + login (Firebase Auth)
│   ├── (app)/                   ← Authenticated app
│   └── api/
│       ├── auth/{session,bootstrap}/  ← Mint session cookie + first-time signup
│       ├── notices/{classify,draft,mail}/
│       ├── contacts/import/
│       ├── workflows/tick/        ← Cloud Scheduler entry point
│       ├── inbox/sync/            ← Gmail polling
│       ├── analytics/live/        ← Polling endpoint replacing Realtime
│       ├── track/{pixel.gif,click,visit,event,identify,page-finalize,unsubscribe}/
│       ├── public/v1/{contacts,events,referral/submit}/
│       └── webhooks/{stripe,resend}/
├── lib/
│   ├── ai/                       ← Anthropic + cached prompts
│   ├── auth/                     ← Firebase Admin (server) + client + session cookies
│   ├── db/                       ← pg pool + Supabase-compatible query builder
│   ├── storage/                  ← Cloud Storage helpers
│   ├── email/                    ← Resend sender + Gmail inbound + react-email templates
│   ├── crm/                      ← Segment compiler
│   ├── workflows/                ← Runner + types + ai-step + enrollment
│   ├── stripe/, lob/             ← External SDK wrappers
│   ├── api/                      ← Public API auth + rate limit
│   └── supabase/                 ← Compat shims (now backed by lib/db + lib/auth)
├── components/
│   ├── marketing/                ← Hero, ValueStack, Comparison, etc.
│   └── ui/                       ← shadcn primitives
├── prompts/                      ← Versioned AI prompts (classify, draft, workflow_ai_step)
├── supabase/migrations/          ← 4 SQL files: init, rls (optional), seed_starters, analytics_views
├── public/track.js               ← Embeddable visitor-tracking script
├── tests/                        ← Vitest unit + Playwright e2e
├── Dockerfile                    ← Multi-stage Next.js standalone for Cloud Run
├── cloudbuild.yaml               ← Cloud Build → Artifact Registry → Cloud Run
└── README.md                     ← This file
```

## Email deliverability runbook

Per the build memory: **all NoticeReply outbound email sends from
`support@salisburybookkeeping.com`**. Replies land in a real
human-monitored Google Workspace inbox.

### Sending architecture

| Use case | Service | Sending domain |
|---|---|---|
| Cold outreach, marketing, nurture, bulk | Resend | `mail.salisburybookkeeping.com` (subdomain) |
| Transactional, 1:1 workflow steps | Resend | `salisburybookkeeping.com` (apex) |
| Inbound replies | Gmail (Workspace) | apex |

`lib/email/sender.ts` routes by `category` to the right Resend domain. The
suppression list is shared across all categories.

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

Enforced in `lib/email/sender.ts` → `getDailyCap`.

### Inbound reply capture

Cloud Scheduler hits `/api/inbox/sync` every 60s. Gmail API pulls recent
inbox messages, matches each to the originating `email_sends.message_id`
via `In-Reply-To` + `References` headers, persists to `inbound_messages`,
writes an `email_reply` activity to the contact timeline, and (if the
reply contains "unsubscribe" / "remove me") auto-suppresses.

## Architecture notes (post-Supabase)

The original NoticeReply was built on Supabase. We migrated to Cloud SQL +
Firebase Auth + Cloud Run to consolidate on Google Cloud. The migration
preserves **everything** that was in the schema and AI/email/workflow
modules — only the data-access transport and auth provider changed.

### Compatibility shim

The 40+ files that imported from `@/lib/supabase/*` did NOT need to change.
The shim layer (`lib/supabase/admin.ts`, `server.ts`, `browser.ts`) now
exposes the same surface area but routes:

- `getSupabaseAdmin().from('table').select(...).eq(...)` → `pg` query via `lib/db/query-builder.ts`
- `createSupabaseServerClient().auth.getUser()` → Firebase session cookie verification via `lib/auth/`
- `createSupabaseBrowserClient().auth.signInWithPassword(...)` → Firebase Auth client SDK

### What changed

- `auth.users` (Supabase-only) → `users` table that stores `firebase_uid`
- The `handle_new_user` trigger that fired on `auth.users` insert is gone — bootstrap moved to `/api/auth/bootstrap` (Firebase ID token verify → users + firms + firm_users + `seed_starter_assets()` in one transaction)
- RLS is no longer load-bearing — the app role connects with full access and tenant filtering happens via `firm_id` filters in every query (the lib/db query builder forwards them transparently)
- Realtime live-visitors became a 5-second poll against `/api/analytics/live`
- Vercel cron → Cloud Scheduler hitting Cloud Run with `x-cron-secret` header

## Verification

```bash
npm run typecheck     # tsc --noEmit
npm run lint
npm run test          # vitest run
npm run dev           # http://localhost:3000
npm run test:e2e      # Playwright
npm run fallow
npm run format:check
```

## Compliance + security

- Taxpayer PII encrypted at rest using Postgres `pgcrypto`
- TLS-only (Cloud Run default)
- Tenant filtering via `firm_id` in every query (lib/db query builder)
- Audit log: every status / data change captured via `activities` + `events` tables
- Tracking script: EU IP truncation, no cookies before consent, DNT respected
- Public API: per-firm key (sha256-hashed at rest) + plan-tier rate limits
- Stripe + Resend webhook signatures verified before write
- Firebase session cookies are httpOnly + Secure + SameSite=Lax

## Built by

[Salisbury Bookkeeping](https://salisburybookkeeping.com) — Tucson, AZ.

NoticeReply is **software**. Every IRS notice response is reviewed and signed
by a CPA, who is solely responsible for its content. Same liability profile
as ProSeries or Lacerte.
