# Provisioning scripts

Run from the repo root in order. Each script is idempotent (safe to re-run).

## 1. `provision-gcp.sh`

Creates all GCP resources NoticeReply needs:
- Enables APIs
- Creates Artifact Registry repo (`noticereply` in `us-west3`)
- Creates Cloud Storage bucket (`noticereply-uploads-salisbury-bookkeeping`) with 90d lifecycle
- Creates runtime service account (`noticereply-runner@salisbury-bookkeeping.iam.gserviceaccount.com`) with minimal IAM
- Grants Cloud Build SA permission to deploy to Cloud Run
- Pre-creates 15 empty Secret Manager secrets
- Generates an initial CRON_SECRET value

```bash
bash scripts/provision-gcp.sh
```

When done, the script prints a numbered punch list of console-only tasks (Cloud SQL DB/user, Firebase project, Resend domains, Stripe, Lob, Cloud Build trigger).

## 2. `seed-secret-values.sh` (after you have the values)

Interactive prompt for each Secret Manager entry. Inputs are silent (no terminal echo, no shell history).

```bash
bash scripts/seed-secret-values.sh
```

Skip any with Enter. Re-run anytime to update individual values.

## 3. `migrate-db.sh` (after Cloud SQL DB + `app` user exist)

Spawns `cloud-sql-proxy` on a local port and runs all 4 migrations via psql.

```bash
PG_PASSWORD=<the-app-user-password> bash scripts/migrate-db.sh
```

Requires:
- `cloud-sql-proxy` ([install](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy))
- `psql` (any recent Postgres client)

## 4. `setup-cloud-scheduler.sh` (after first successful deploy)

Creates two cron jobs that hit Cloud Run every minute (`/api/workflows/tick` and `/api/inbox/sync`) with the `x-cron-secret` header.

```bash
CLOUD_RUN_URL=https://cpa-irs-notification-xxxx.a.run.app bash scripts/setup-cloud-scheduler.sh
```

Get the URL from https://console.cloud.google.com/run/detail/us-west3/cpa-irs-notification?project=salisbury-bookkeeping

## Order summary

```
provision-gcp.sh                 ← anytime; creates GCP resources
                                    (in parallel: Cloud SQL instance + Firebase project + Resend verify)
seed-secret-values.sh            ← once you have values from Stripe/Lob/Resend/Anthropic/etc.
migrate-db.sh                    ← once Cloud SQL DB + app user exist
                                    (in parallel: connect GitHub to Cloud Build, push to main → first deploy)
setup-cloud-scheduler.sh         ← after first successful Cloud Run deploy
```
