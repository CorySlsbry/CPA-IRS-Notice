# NoticeReply — End-of-day live state

> Last updated: 2026-05-08 by autonomous Cory-authorized session

---

## 🆕 Jarvis lead-ingestion endpoints — LIVE

Three endpoints under `/api/integrations/jarvis/` are deployed and tested. Send these to upstream Jarvis to wire the client side:

**Base URL:** `https://cpa-irs-notification-acpw7bvkuq-wm.a.run.app`

**Auth header:** `X-Jarvis-Token: <token>`
- ⚠️ NOT `Authorization: Bearer …` — Cloud Run's edge proxy intercepts that for its own IAM auth, returning 502 before the container sees the request. The custom header bypasses that.
- The route still ALSO accepts `Authorization: Bearer <token>` as a fallback for spec-compatibility, but use the custom header to avoid the edge interception risk.

**Token name in Secret Manager:** `JARVIS_INGEST_TOKEN` (project `salisbury-bookkeeping`)

**Routes:**
- `POST /api/integrations/jarvis/leads` — create/merge contact + apply tags + create lead row (transactional, exactly the spec contract)
- `POST /api/integrations/jarvis/leads/match` — read-only dedup probe (p99 budget 100ms; partial unique indexes per signal)
- `GET  /api/integrations/jarvis/leads?email=…` (Mode A) | `?contact_id=…` (Mode B) | `?since=…&cursor=…&limit=…` (Mode C)

**Vertical Routing implemented:**
```ts
cpa_irs_notices: {
  triggerTag: 'cpa-irs-cold-queue',
  stopTags:   ['cpa-irs-booked-call', 'cpa-irs-client', 'cpa-irs-lost', 'do-not-contact'],
  bandTags:   { short: 'cpa-irs-cold-queue', long: 'cpa-irs-short-nurture-complete', evergreen: 'cpa-irs-long-nurture-complete' },
}
```

**Workflow chain (auto-installed for every new firm via `seed_starter_assets`):**
1. `CPA cold push — Short (14d)` — trigger `cpa-irs-cold-queue` → applies `cpa-irs-short-nurture-complete` at end
2. `CPA cold push — Long (90d)` — trigger `cpa-irs-short-nurture-complete` → applies `cpa-irs-long-nurture-complete` at end
3. `CPA cold push — Evergreen (quarterly)` — trigger `cpa-irs-long-nurture-complete`

The chain is internal-driven via tag completion exactly as the spec describes. To get the actual workflow UUIDs after Cory signs up:
```sql
select name, id from workflows where firm_id = '<your-firm-id>' and name like 'CPA cold push%';
```

**`normalize_company` suffix list** (must match Jarvis verbatim):
```
corporation, enterprises, holdings, services, company, p.c., p.a., group, corp, llc, llp, ltd, inc, pa, pc, co
```
(Each suffix is matched case-insensitive with optional trailing dot.)

**DB columns added to `contacts`:** `email_normalized` (citext), `phone_digits` (text), `linkedin_url` (text), `linkedin_normalized` (text), `name_company_key` (text), `apollo_person_id` (text), `external_id` (text), `jarvis_dedup_qualifiers` (jsonb), `company_name_at_capture` (text). All maintained via `BEFORE INSERT/UPDATE` trigger.

**New `leads` table** with one row per Jarvis push (per-call attribution as spec'd).

**Indexes:** 4 partial unique indexes scoped per `firm_id` × dedup signal (email_normalized | phone_digits | name_company_key | linkedin_normalized). p99 lookups are Index Scans.

**Migration backfilled:** No collisions on unique indexes (no pre-existing contact rows yet — the schema started clean).

**Spec deviations to flag back to Jarvis:**
1. Auth header is `X-Jarvis-Token` (Bearer also accepted but DO NOT rely on it — Cloud Run intercepts).
2. Unique indexes are scoped per `firm_id` (multi-tenant safe). Spec implied global unique. Match unaffected since lead ingestion targets a single firm.
3. The `vertical_context.trigger_tag_applied` field in `/match` reflects whether the trigger tag is currently on the contact (i.e. they've been pushed before), not the success of the most recent push. The PER-PUSH success state is on the `leads` row's `trigger_tag_applied` column.

**Last gate before fully functional:** `JARVIS_DEFAULT_FIRM_ID` secret is currently a placeholder. After Cory signs up:
```bash
# Find his firm UUID
gcloud sql connect noticereply --user=postgres --database=noticereply --project=salisbury-bookkeeping
# in psql: select id, name from firms order by created_at desc limit 5;

# Update the secret
printf '<the-uuid>' | gcloud secrets versions add JARVIS_DEFAULT_FIRM_ID --data-file=- --project=salisbury-bookkeeping
printf '<the-uuid>' | gcloud secrets versions add MARKETING_FIRM_ID --data-file=- --project=salisbury-bookkeeping  # also cover the lead-magnet pipe
```

Cloud Run picks up the new secret value on next cold start automatically (no redeploy needed for secrets, since they're mounted as env from secret manager with `:latest`).

---

## What's live on Cloud Run RIGHT NOW

**URL:** https://cpa-irs-notification-acpw7bvkuq-wm.a.run.app

The marketing site, lead magnet, checklist page, dashboard shell, and cron endpoints are all live and working. The dashboard / signup flow needs Firebase Auth keys to be functional — those are the last blocker.

Open the URL — you should see the full Hormozi landing page with the live demo, ROI calculator, case study, etc. Click around the marketing pages to confirm.

## What's been provisioned ✓

| Resource | State |
|---|---|
| Cloud SQL `noticereply` (Postgres 16 db-g1-small Enterprise) | RUNNABLE |
| Database `noticereply` + user `app` | created |
| All 7 schema migrations | applied via `gcloud sql import sql` |
| Cloud Run service `cpa-irs-notification` | rev 00021-ntp serving 100% traffic |
| Cloud SQL Auth Proxy attached to Cloud Run | yes |
| Public IAM (`allUsers + roles/run.invoker`) | yes |
| Compute SA roles | secretmanager.secretAccessor + cloudsql.client + storage.objectAdmin |
| Cloud Scheduler jobs (4 total) | all healthy, returning HTTP 200 |
| Auto-deploy on push to main | yes (Cloud Run source-deploy triggers) |

**Cron jobs (all in us-west3):**
- `noticereply-tick` → `/api/workflows/tick` every 60s — workflow runner
- `noticereply-inbox-sync` → `/api/inbox/sync` every 60s — Gmail polling (no-ops until OAuth)
- `noticereply-social-run` → `/api/social/run` every 60s — scheduled social posts
- `noticereply-import-lead-magnets` → `/api/cron/import-lead-magnets` every 5 min — lead-magnet → CRM (no-ops until MARKETING_FIRM_ID set)

## Secrets in Secret Manager

**Populated (8):**
- `DATABASE_URL`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SOCIAL_TOKEN_KEY`, `META_WEBHOOK_VERIFY_TOKEN`

**Empty — you fill these (10):**
- `FIREBASE_SERVICE_ACCOUNT` — download JSON from Firebase Console
- `STRIPE_PRICE_FOUNDING`, `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_PRO` — Stripe product price IDs
- `LOB_API_KEY` — Lob dashboard
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` — Workspace OAuth + OAuth Playground
- `META_APP_SECRET` — Meta App dashboard
- `MARKETING_FIRM_ID` — UUID of your firm row, populated after your first signup creates one

## What you need to do when you're back

In rough priority order:

### 1. Firebase (the hard blocker on auth)

**Project already exists:** `salisbury-bookkeeping-b930a` (Firebase auto-suffixed because the GCP project ID was taken).
**Browser tabs already open** at the right pages. ~5 min total.

#### A. Click through Firebase (you):
1. Open the Firebase tab — should be on `Project settings → General`
2. Scroll to **"Your apps"** section → click **`</>`** (the **`Add Firebase to your Web app`** button — found by the agent at `ref_143`)
3. App nickname: **`NoticeReply`** → uncheck "Also set up Firebase Hosting" → click **Register app**
4. You'll see a `firebaseConfig = {…}` block. **Copy these 4 values exactly:**
   - `apiKey` → starts with `AIzaSy...`
   - `authDomain` → `salisbury-bookkeeping-b930a.firebaseapp.com`
   - `projectId` → `salisbury-bookkeeping-b930a`
   - `appId` → starts with `1:687855643285:web:...`
5. Click **Continue to console**
6. Project settings → **Service accounts** tab → **Generate new private key** → confirm. **JSON downloads to your Downloads folder.**
7. Left nav → **Build → Authentication → Get started** (or open https://console.firebase.google.com/u/0/project/salisbury-bookkeeping-b930a/authentication/providers)
8. Click **Email/Password** → toggle **Enable** → **Save**

#### B. Run one PowerShell command (the agent built this script):
```powershell
cd C:\Users\Cory\Downloads\noticereply
git pull origin main
.\scripts\finish-firebase.ps1 `
  -ApiKey "AIzaSy..." `
  -AuthDomain "salisbury-bookkeeping-b930a.firebaseapp.com" `
  -ProjectId "salisbury-bookkeeping-b930a" `
  -AppId "1:687855643285:web:..." `
  -ServiceAccountPath "C:\Users\Cory\Downloads\salisbury-bookkeeping-b930a-firebase-adminsdk-XXXXX.json"
```

That script:
- Uploads the service account JSON to `FIREBASE_SERVICE_ACCOUNT` secret
- Sets the 4 `NEXT_PUBLIC_FIREBASE_*` env vars on Cloud Run in one update
- Triggers the new revision

After it succeeds, sign up at `https://cpa-irs-notification-acpw7bvkuq-wm.a.run.app/signup`. The dashboard works end-to-end after that.

### 2. Stripe (for billing)

1. Stripe dashboard → Products → 3 monthly products: Founding $99, Standard $299, Pro $599
2. Webhooks → Endpoint at `https://cpa-irs-notification-acpw7bvkuq-wm.a.run.app/api/webhooks/stripe`, listen for `customer.subscription.*` + `checkout.session.completed`
3. Paste each price ID into `STRIPE_PRICE_FOUNDING/_STANDARD/_PRO` secrets

### 3. Lob

1. Lob → API Keys → copy Test key
2. Paste into `LOB_API_KEY` secret

### 4. Google Workspace OAuth (Gmail inbound)

1. https://console.cloud.google.com/apis/credentials → Create Credentials → OAuth client ID → Web app
2. Authorized redirect: `https://cpa-irs-notification-acpw7bvkuq-wm.a.run.app/api/inbox/oauth/callback`
3. Copy client ID + secret → paste into `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` secrets
4. https://developers.google.com/oauthplayground → use your own credentials (gear icon) → scopes `gmail.readonly` + `gmail.modify` → exchange auth code for tokens
5. Copy refresh_token → paste into `GOOGLE_OAUTH_REFRESH_TOKEN` secret

### 5. Sign up your own firm + set MARKETING_FIRM_ID

1. Once Firebase is set, sign up at `/signup` with `support@salisburybookkeeping.com`
2. SQL: `select id from firms where name like '%Salisbury%';` (via Cloud SQL Studio or `gcloud sql connect noticereply`)
3. Paste that UUID into `MARKETING_FIRM_ID` secret
4. Lead magnet signups will then automatically import into your CRM and trigger the welcome workflow

### 6. Meta (for social posting + reply automation)

Connect SBK Facebook Page + Instagram via the OAuth flow we'll build at `/(app)/social/accounts` (Phase 2 — not built yet). Until then, social posting works via direct SQL insert into `social_accounts` if you want to test now.

`META_APP_SECRET`: Meta App dashboard → Settings → Basic → App Secret (show) → paste into secret.

`META_WEBHOOK_VERIFY_TOKEN`: in Meta App webhooks config, paste the value from the populated secret. Then Meta will verify the webhook by GET'ing `/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=<token>`.

## Files of note

- `~/.noticereply-credentials` — Cloud SQL root + app passwords + DATABASE_URL (chmod restricted, don't commit)
- `scripts/create-cloud-sql.ps1` — re-create DB if you ever need to (idempotent)
- `scripts/migrate-db.ps1` — run migrations via cloud-sql-proxy (requires installing cloud-sql-proxy + psql)
- `STATUS.md` (this file) — checked in for posterity

## Quick health check (next time)

```bash
# Service status
gcloud run services describe cpa-irs-notification --region=us-west3 --project=salisbury-bookkeeping --format="value(status.latestReadyRevisionName,status.url)"

# Cron health
gcloud logging read 'resource.type="cloud_scheduler_job"' --limit=4 --project=salisbury-bookkeeping --format="value(timestamp,httpRequest.status,jsonPayload.jobName.basename())" --order=desc

# DB state
gcloud sql instances describe noticereply --project=salisbury-bookkeeping --format="value(state,connectionName)"
```

## Today's autonomous-session changes

- Created Cloud SQL instance + DB + user (after multiple script iterations to fix `--no-assign-ip` + idempotency issues)
- Generated random SOCIAL_TOKEN_KEY + META_WEBHOOK_VERIFY_TOKEN; populated 4 placeholder secrets
- Granted compute SA the IAM roles needed (secretmanager + cloudsql + storage)
- Manually ran `gcloud run services update --set-secrets=…` because the auto-source-deploy trigger doesn't read cloudbuild.yaml
- Uploaded migrations to GCS bucket; granted Cloud SQL SA bucket-read; ran 7 imports
- Created 4 Cloud Scheduler jobs in us-west3
- Added migration 0007_grants.sql to give the `app` role table privileges (postgres-as-importer left tables owned by postgres)
- Added graceful no-op to `/api/inbox/sync` when Gmail OAuth not configured
- Pushed commits: `0b109eb`, `230988d`, `da1c718`
