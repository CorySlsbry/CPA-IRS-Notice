#!/usr/bin/env bash
# NoticeReply — one-shot GCP provisioning.
#
# Run from a shell where `gcloud` is authenticated as the project owner:
#   bash scripts/provision-gcp.sh
#
# What this script does:
#   1. Enables required APIs on salisbury-bookkeeping
#   2. Creates Artifact Registry repo `noticereply` in us-west3
#   3. Creates GCS bucket noticereply-uploads-salisbury-bookkeeping
#   4. Creates runtime service account + grants minimal IAM
#   5. Grants Cloud Build SA permission to deploy to Cloud Run
#   6. Pre-creates empty Secret Manager secrets (you fill values via Console)
#
# What this script does NOT do:
#   - Touch the existing Cloud Run service `cpa-irs-notification` (you created)
#   - Touch the existing Cloud SQL instance (you started)
#   - Touch ANY existing salisbury-bookkeeping-website resources
#   - Connect GitHub → Cloud Build (one-time OAuth via Console; instructions at end)
#
# Idempotent: safe to re-run. Resources that already exist will report "already exists"
# and continue.

set -u  # fail on undefined vars but keep going on individual command errors

PROJECT="salisbury-bookkeeping"
REGION="us-west3"
AR_REPO="noticereply"
BUCKET="noticereply-uploads-${PROJECT}"
RUNNER_SA="noticereply-runner"
RUNNER_EMAIL="${RUNNER_SA}@${PROJECT}.iam.gserviceaccount.com"

# ANSI colors for readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

step() { echo -e "\n${GREEN}▸ $*${RESET}"; }
note() { echo -e "  ${YELLOW}↳${RESET} $*"; }
fail() { echo -e "  ${RED}✗${RESET} $*" >&2; }

# ─────────────────────────────────────────────────────────────────────────────
step "0/7 — preflight"
gcloud config set project "$PROJECT" --quiet
echo "  active project: $(gcloud config get-value project)"
echo "  active account: $(gcloud config get-value account)"

# ─────────────────────────────────────────────────────────────────────────────
step "1/7 — enable APIs"
APIS=(
  run.googleapis.com
  cloudbuild.googleapis.com
  sqladmin.googleapis.com
  artifactregistry.googleapis.com
  secretmanager.googleapis.com
  identitytoolkit.googleapis.com
  firebase.googleapis.com
  storage.googleapis.com
  cloudscheduler.googleapis.com
  iam.googleapis.com
  cloudresourcemanager.googleapis.com
)
gcloud services enable "${APIS[@]}" --project="$PROJECT"
note "APIs enabled (or already on)"

# ─────────────────────────────────────────────────────────────────────────────
step "2/7 — Artifact Registry repo"
if gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  note "$AR_REPO already exists"
else
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="NoticeReply Docker images" \
    --project="$PROJECT"
  note "created $AR_REPO"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "3/7 — Cloud Storage bucket for notice uploads"
if gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
  note "gs://$BUCKET already exists"
else
  gcloud storage buckets create "gs://$BUCKET" \
    --project="$PROJECT" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --default-storage-class=STANDARD
  note "created gs://$BUCKET"
fi

# Lifecycle: delete unattached uploads after 90 days
LIFECYCLE_FILE=$(mktemp)
cat > "$LIFECYCLE_FILE" <<'JSON'
{
  "lifecycle": {
    "rule": [
      { "action": {"type": "Delete"}, "condition": {"age": 90} }
    ]
  }
}
JSON
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file="$LIFECYCLE_FILE" --project="$PROJECT" >/dev/null
rm -f "$LIFECYCLE_FILE"
note "lifecycle: delete unattached objects after 90d"

# ─────────────────────────────────────────────────────────────────────────────
step "4/7 — runtime service account + IAM"
if gcloud iam service-accounts describe "$RUNNER_EMAIL" --project="$PROJECT" >/dev/null 2>&1; then
  note "$RUNNER_EMAIL already exists"
else
  gcloud iam service-accounts create "$RUNNER_SA" \
    --display-name="NoticeReply Cloud Run runtime" \
    --description="Used by the cpa-irs-notification Cloud Run service to access Cloud SQL, Secret Manager, GCS, Firebase Auth" \
    --project="$PROJECT"
  note "created $RUNNER_EMAIL"
fi

# Project-level roles
for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor roles/firebaseauth.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${RUNNER_EMAIL}" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null
  note "granted $ROLE on project"
done

# Bucket-scoped role (least privilege — runner only touches the uploads bucket)
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:${RUNNER_EMAIL}" \
  --role="roles/storage.objectAdmin" \
  --project="$PROJECT" >/dev/null
note "granted roles/storage.objectAdmin on gs://$BUCKET"

# ─────────────────────────────────────────────────────────────────────────────
step "5/7 — grant Cloud Build SA permission to deploy to Cloud Run"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
note "Cloud Build SA: $CB_SA"

for ROLE in roles/run.developer roles/iam.serviceAccountUser roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${CB_SA}" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null
  note "granted $ROLE to Cloud Build SA"
done

# ─────────────────────────────────────────────────────────────────────────────
step "6/7 — pre-create Secret Manager entries (empty placeholders)"
SECRETS=(
  DATABASE_URL
  FIREBASE_SERVICE_ACCOUNT
  ANTHROPIC_API_KEY
  RESEND_API_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_FOUNDING
  STRIPE_PRICE_STANDARD
  STRIPE_PRICE_PRO
  LOB_API_KEY
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GOOGLE_OAUTH_REFRESH_TOKEN
  GMAIL_INBOX_USER
  CRON_SECRET
)

for SECRET in "${SECRETS[@]}"; do
  if gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1; then
    note "$SECRET already exists (skipping)"
  else
    gcloud secrets create "$SECRET" \
      --replication-policy=automatic \
      --project="$PROJECT" \
      --quiet >/dev/null
    note "created $SECRET (no value yet)"
  fi
done

# Generate a CRON_SECRET if it has no version yet — saves a step
if ! gcloud secrets versions list CRON_SECRET --project="$PROJECT" --filter="state=enabled" --format="value(name)" 2>/dev/null | grep -q .; then
  CRON_VAL=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)
  printf "%s" "$CRON_VAL" | gcloud secrets versions add CRON_SECRET --data-file=- --project="$PROJECT" >/dev/null
  note "generated initial CRON_SECRET value (32 random bytes hex)"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "7/7 — summary + next steps"

cat <<EOF

${GREEN}✓ Provisioning done.${RESET}

Resources created in project ${PROJECT}, region ${REGION}:
  • Artifact Registry repo .................. $AR_REPO
  • Cloud Storage bucket .................... gs://$BUCKET
  • Runtime service account ................. $RUNNER_EMAIL
  • Cloud Build SA granted run/iam roles
  • Secret Manager entries (15 secrets)

${YELLOW}Things only you can do — do them via Console:${RESET}

  1. Cloud SQL — once instance is "Runnable":
     Open: https://console.cloud.google.com/sql/instances/noticereply/databases?project=$PROJECT
     • Create database "noticereply"
     • Open Users tab → Create user "app" with a strong password (save it!)
     • Open Connections → ENABLE Cloud SQL Auth Proxy (no networking config needed)

  2. Add the DATABASE_URL secret value:
     https://console.cloud.google.com/security/secret-manager/secret/DATABASE_URL/versions?project=$PROJECT
     Click "+ NEW VERSION", paste:
       postgres://app:<pwd>@/noticereply?host=/cloudsql/${PROJECT}:${REGION}:noticereply

  3. Firebase project + Web App:
     https://console.firebase.google.com/
     • Add project (use existing GCP project: $PROJECT)
     • Enable Authentication → Email/Password
     • Add Web App → copy NEXT_PUBLIC_FIREBASE_* keys (you'll paste these into Cloud Build trigger substitutions)
     • Generate a service account key (Project Settings → Service accounts → Generate new private key)
     • Paste that JSON as the FIREBASE_SERVICE_ACCOUNT secret value (single line)

  4. Resend — verify both domains:
     https://resend.com/domains
     • salisburybookkeeping.com (apex)
     • mail.salisburybookkeeping.com (subdomain)
     • DNS records are in README.md "Email deliverability runbook"
     • Add API key as RESEND_API_KEY secret value

  5. Stripe — create products + webhook:
     • 3 products (Founding \$99, Standard \$299, Pro \$599) — monthly
     • Webhook at https://<CLOUD_RUN_URL>/api/webhooks/stripe (we'll know URL after first deploy)
     • Paste price IDs + secret + webhook secret into matching Secret Manager entries

  6. Lob — get test key, paste as LOB_API_KEY value

  7. Anthropic — paste your existing key as ANTHROPIC_API_KEY value
     (your jarvis-platform secret has it; you can copy from there)

  8. Google Workspace OAuth — for Gmail inbound:
     • Create OAuth 2.0 Web Application client
     • Authorize gmail.readonly + gmail.modify scopes
     • Use OAuth Playground to mint a refresh token
     • Paste client id + secret + refresh token into matching secrets
     • GMAIL_INBOX_USER value: support@salisburybookkeeping.com

  9. Cloud Build trigger — connect GitHub (one-time OAuth):
     https://console.cloud.google.com/cloud-build/triggers/connect?project=$PROJECT
     • Source: GitHub (Cloud Build GitHub App)
     • Authenticate, select CorySlsbry/CPA-IRS-Notice
     • Click CREATE TRIGGER, then copy these values:

       Name:               noticereply-deploy
       Region:             $REGION
       Event:              Push to a branch
       Branch:             ^main$
       Configuration:      Cloud Build configuration file (yaml)
       Location:           Repository
       Cloud Build file:   cloudbuild.yaml
       Service account:    Default Cloud Build SA

       Substitution variables (paste each):
         _REGION            = $REGION
         _SERVICE           = cpa-irs-notification
         _AR_REPO           = $AR_REPO
         _CLOUDSQL_INSTANCE = ${PROJECT}:${REGION}:noticereply
         _SERVICE_ACCOUNT   = $RUNNER_EMAIL
         _NEXT_PUBLIC_FIREBASE_API_KEY      = (from Firebase Web App config)
         _NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN  = (from Firebase Web App config)
         _NEXT_PUBLIC_FIREBASE_PROJECT_ID   = (from Firebase Web App config — usually same as $PROJECT)
         _NEXT_PUBLIC_FIREBASE_APP_ID       = (from Firebase Web App config)

  10. Cloud Scheduler — workflow tick + inbox sync (after first successful deploy):
     gcloud scheduler jobs create http noticereply-tick \\
       --location=$REGION \\
       --schedule="* * * * *" \\
       --uri="<CLOUD_RUN_URL>/api/workflows/tick" \\
       --http-method=POST \\
       --headers="x-cron-secret=\$CRON_SECRET_VALUE" \\
       --project=$PROJECT

     gcloud scheduler jobs create http noticereply-inbox-sync \\
       --location=$REGION \\
       --schedule="* * * * *" \\
       --uri="<CLOUD_RUN_URL>/api/inbox/sync" \\
       --http-method=POST \\
       --headers="x-cron-secret=\$CRON_SECRET_VALUE" \\
       --project=$PROJECT

EOF
