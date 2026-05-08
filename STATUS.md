# NoticeReply — End-of-day live state

> Last updated: 2026-05-08 by autonomous Cory-authorized session

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

1. Go to https://console.firebase.google.com/
2. Create new project → use existing GCP project `salisbury-bookkeeping`
3. Disable Google Analytics (we have our own)
4. Build → Authentication → Get started → Sign-in method → Email/Password → Enable
5. Settings → Your apps → `</>` (web) → name "NoticeReply" → Register
6. **Copy the `firebaseConfig = {…}` block** (apiKey, authDomain, projectId, appId)
7. Go to https://console.cloud.google.com/run/detail/us-west3/cpa-irs-notification/yaml/edit?project=salisbury-bookkeeping
   - Add 4 env vars as PUBLIC env vars (NOT secrets):
     - `NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID=salisbury-bookkeeping`
     - `NEXT_PUBLIC_FIREBASE_APP_ID=<appId>`
8. Settings → Service accounts → Generate new private key → JSON downloads
9. Open downloaded JSON → copy contents → paste into `FIREBASE_SERVICE_ACCOUNT` secret:
   https://console.cloud.google.com/security/secret-manager/secret/FIREBASE_SERVICE_ACCOUNT/versions?project=salisbury-bookkeeping

After this you can sign up at `https://cpa-irs-notification-acpw7bvkuq-wm.a.run.app/signup` and the dashboard will work.

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
