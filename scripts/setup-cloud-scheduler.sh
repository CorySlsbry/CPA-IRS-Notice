#!/usr/bin/env bash
# NoticeReply — Cloud Scheduler setup.
#
# Run this AFTER:
#   1. provision-gcp.sh has run successfully
#   2. The Cloud Build trigger has produced at least one successful deploy
#   3. You have the Cloud Run service URL handy (from Cloud Run console)
#
# Usage:
#   CLOUD_RUN_URL=https://cpa-irs-notification-xxxx.a.run.app bash scripts/setup-cloud-scheduler.sh

set -u
PROJECT="salisbury-bookkeeping"
REGION="us-west3"
RUN_URL="${CLOUD_RUN_URL:-}"

if [ -z "$RUN_URL" ]; then
  echo "Set CLOUD_RUN_URL first. Find it in the Cloud Run console for cpa-irs-notification."
  echo "  https://console.cloud.google.com/run/detail/${REGION}/cpa-irs-notification?project=${PROJECT}"
  exit 1
fi

# Pull the cron secret (read-only — used as header)
CRON_SECRET=$(gcloud secrets versions access latest --secret=CRON_SECRET --project="$PROJECT")
if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET secret has no version. Run provision-gcp.sh first or seed it manually."
  exit 1
fi

create_or_update_job() {
  local NAME="$1"
  local URI="$2"
  local SCHEDULE="$3"

  if gcloud scheduler jobs describe "$NAME" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
    echo "▸ Updating existing job: $NAME"
    gcloud scheduler jobs update http "$NAME" \
      --location="$REGION" \
      --schedule="$SCHEDULE" \
      --uri="$URI" \
      --http-method=POST \
      --update-headers="x-cron-secret=${CRON_SECRET}" \
      --project="$PROJECT"
  else
    echo "▸ Creating job: $NAME"
    gcloud scheduler jobs create http "$NAME" \
      --location="$REGION" \
      --schedule="$SCHEDULE" \
      --uri="$URI" \
      --http-method=POST \
      --headers="x-cron-secret=${CRON_SECRET}" \
      --project="$PROJECT"
  fi
}

echo "Cloud Scheduler setup against $RUN_URL"
echo

create_or_update_job "noticereply-tick" "$RUN_URL/api/workflows/tick" "* * * * *"
create_or_update_job "noticereply-inbox-sync" "$RUN_URL/api/inbox/sync" "* * * * *"

echo
echo "✓ Scheduler jobs configured."
echo
echo "Verify:"
echo "  gcloud scheduler jobs list --location=$REGION --project=$PROJECT"
echo
echo "Run-once test (optional, manual trigger):"
echo "  gcloud scheduler jobs run noticereply-tick --location=$REGION --project=$PROJECT"
