#!/usr/bin/env bash
# NoticeReply — interactive Secret Manager value seeder.
#
# Run AFTER provision-gcp.sh has created the empty secrets. This script
# prompts you for each value (paste-friendly) and writes a new version
# to Secret Manager.
#
# Skip any value by pressing Enter on an empty input.
#
# Usage:
#   bash scripts/seed-secret-values.sh
#
# Reads secrets via stdin so values never end up in your shell history.

set -u
PROJECT="salisbury-bookkeeping"

prompt() {
  local name="$1"
  local desc="$2"
  echo
  echo "─── $name ───"
  echo "$desc"
  echo "Paste value (or press Enter to skip):"
  read -rs VALUE
  echo
  if [ -z "$VALUE" ]; then
    echo "  ↳ skipped"
    return
  fi
  printf "%s" "$VALUE" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT" >/dev/null
  echo "  ↳ ✓ wrote new version"
}

prompt_multiline() {
  local name="$1"
  local desc="$2"
  echo
  echo "─── $name ───"
  echo "$desc"
  echo "Paste value, then Ctrl+D on its own line to finish (or Ctrl+D immediately to skip):"
  VALUE=$(cat)
  if [ -z "$VALUE" ]; then
    echo "  ↳ skipped"
    return
  fi
  printf "%s" "$VALUE" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT" >/dev/null
  echo "  ↳ ✓ wrote new version"
}

echo "Seeding Secret Manager values for project: $PROJECT"
echo "All inputs are silent (won't echo to terminal)."
echo

prompt "DATABASE_URL" "Cloud SQL connection string. Format:
  postgres://app:<pwd>@/noticereply?host=/cloudsql/salisbury-bookkeeping:us-west3:noticereply"

prompt_multiline "FIREBASE_SERVICE_ACCOUNT" "Firebase Admin SDK service account JSON.
  Get it from: Firebase Console → Project Settings → Service accounts → Generate new private key.
  Paste the FULL JSON. (You can leave blank if Cloud Run uses ADC via attached service account.)"

prompt "ANTHROPIC_API_KEY" "Anthropic API key. Format: sk-ant-..."
prompt "RESEND_API_KEY" "Resend API key. Format: re_..."
prompt "STRIPE_SECRET_KEY" "Stripe secret key. Format: sk_live_... or sk_test_..."
prompt "STRIPE_WEBHOOK_SECRET" "Stripe webhook signing secret. Format: whsec_..."
prompt "STRIPE_PRICE_FOUNDING" "Stripe price ID for the \$99/mo Founding tier. Format: price_..."
prompt "STRIPE_PRICE_STANDARD" "Stripe price ID for the \$299/mo Standard tier."
prompt "STRIPE_PRICE_PRO" "Stripe price ID for the \$599/mo Pro tier."
prompt "LOB_API_KEY" "Lob API key. Format: sk_test_... or sk_live_..."
prompt "GOOGLE_OAUTH_CLIENT_ID" "Google Workspace OAuth 2.0 Web Client ID for Gmail inbound."
prompt "GOOGLE_OAUTH_CLIENT_SECRET" "OAuth client secret."
prompt "GOOGLE_OAUTH_REFRESH_TOKEN" "OAuth refresh token (mint via OAuth Playground, scope gmail.readonly + gmail.modify)."
prompt "GMAIL_INBOX_USER" "Default: support@salisburybookkeeping.com"

echo
echo "✓ Done. Verify what's set:"
echo "  gcloud secrets list --project=$PROJECT"
