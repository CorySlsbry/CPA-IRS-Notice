#!/usr/bin/env bash
# NoticeReply — create the cheapest viable Cloud SQL Postgres instance.
#
# Tier breakdown (us-west3, monthly est.):
#   db-g1-small Enterprise + 10GB SSD + daily backup + no HA + no PITR + no public IP
#   ≈ $25/mo total.
#
# Once customers come and you need more headroom, scale up via:
#   gcloud sql instances patch noticereply --tier=db-custom-1-3840 --project=salisbury-bookkeeping
# (zero-downtime upgrade)
#
# Run from repo root:
#   bash scripts/create-cloud-sql.sh

set -e
PROJECT="salisbury-bookkeeping"
REGION="us-west3"
INSTANCE="noticereply"

# Generate a strong root password (alphanumeric only — no shell-special chars)
ROOT_PASSWORD=$(openssl rand -base64 48 | tr -d '/+=' | head -c 32)
APP_PASSWORD=$(openssl rand -base64 48 | tr -d '/+=' | head -c 32)

echo "Generated root password: $ROOT_PASSWORD"
echo "Generated app  password: $APP_PASSWORD"
echo
echo "SAVE BOTH OF THESE — they're shown once. The script also writes them"
echo "to ~/.noticereply-credentials (chmod 600) for your reference."
echo

UMASK=$(umask)
umask 077
cat > "$HOME/.noticereply-credentials" <<EOF
# NoticeReply Cloud SQL credentials — generated $(date -u)
# DO NOT commit. Move/delete after pasting into Secret Manager.
CLOUDSQL_INSTANCE=${PROJECT}:${REGION}:${INSTANCE}
CLOUDSQL_ROOT_USER=postgres
CLOUDSQL_ROOT_PASSWORD=${ROOT_PASSWORD}
CLOUDSQL_APP_USER=app
CLOUDSQL_APP_PASSWORD=${APP_PASSWORD}
DATABASE_URL=postgres://app:${APP_PASSWORD}@/noticereply?host=/cloudsql/${PROJECT}:${REGION}:${INSTANCE}
EOF
umask "$UMASK"
echo "Credentials saved to ~/.noticereply-credentials (chmod 600)"
echo

echo "▸ Creating Cloud SQL instance (5-10 min)..."
gcloud sql instances create "$INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-g1-small \
  --edition=ENTERPRISE \
  --region="$REGION" \
  --storage-type=SSD \
  --storage-size=10 \
  --no-storage-auto-increase \
  --backup-start-time=09:00 \
  --no-assign-ip \
  --availability-type=zonal \
  --root-password="$ROOT_PASSWORD" \
  --project="$PROJECT"

echo
echo "▸ Creating database 'noticereply'..."
gcloud sql databases create noticereply --instance="$INSTANCE" --project="$PROJECT"

echo
echo "▸ Creating app user (least-privilege role)..."
gcloud sql users create app \
  --instance="$INSTANCE" \
  --password="$APP_PASSWORD" \
  --project="$PROJECT"

echo
echo "▸ Writing DATABASE_URL secret to Secret Manager..."
DATABASE_URL="postgres://app:${APP_PASSWORD}@/noticereply?host=/cloudsql/${PROJECT}:${REGION}:${INSTANCE}"
printf "%s" "$DATABASE_URL" | gcloud secrets versions add DATABASE_URL --data-file=- --project="$PROJECT"

echo
echo "✓ Cloud SQL ready."
echo
echo "Connection name: ${PROJECT}:${REGION}:${INSTANCE}"
echo "Database:        noticereply"
echo "App user:        app"
echo "Passwords:       saved to ~/.noticereply-credentials"
echo
echo "Next: bash scripts/migrate-db.sh"
echo "      (uses ~/.noticereply-credentials automatically — see updated script)"
