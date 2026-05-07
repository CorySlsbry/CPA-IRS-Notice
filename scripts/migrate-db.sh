#!/usr/bin/env bash
# NoticeReply — run all SQL migrations against Cloud SQL Postgres.
#
# Prerequisites:
#   1. Cloud SQL instance "noticereply" in salisbury-bookkeeping:us-west3 is Runnable
#   2. Database "noticereply" exists (create via Console: SQL → noticereply → Databases tab)
#   3. User "app" exists with a password you saved (Users tab)
#   4. cloud-sql-proxy is installed locally:
#        https://cloud.google.com/sql/docs/postgres/connect-auth-proxy
#   5. psql is installed (brew install postgresql / apt install postgresql-client)
#
# Run from the repo root:
#   PG_PASSWORD=<the-pwd-you-saved> bash scripts/migrate-db.sh

set -e
PROJECT="salisbury-bookkeeping"
REGION="us-west3"
INSTANCE="noticereply"
DB="noticereply"
USER="app"
CONN_NAME="${PROJECT}:${REGION}:${INSTANCE}"

if [ -z "${PG_PASSWORD:-}" ]; then
  echo "PG_PASSWORD env var required."
  echo "Usage: PG_PASSWORD=<pwd> bash scripts/migrate-db.sh"
  exit 1
fi

# Start the auth proxy in the background on a free local port
PORT=15432
echo "▸ Starting cloud-sql-proxy on 127.0.0.1:${PORT}..."

if command -v cloud-sql-proxy >/dev/null 2>&1; then
  PROXY_BIN=cloud-sql-proxy
elif command -v cloud_sql_proxy >/dev/null 2>&1; then
  PROXY_BIN=cloud_sql_proxy
else
  echo "cloud-sql-proxy not found. Install:"
  echo "  https://cloud.google.com/sql/docs/postgres/connect-auth-proxy"
  exit 1
fi

"$PROXY_BIN" --port=$PORT "$CONN_NAME" &
PROXY_PID=$!
trap "kill $PROXY_PID 2>/dev/null || true" EXIT

# Wait for the proxy to start listening
echo "  waiting for proxy..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if (echo > /dev/tcp/127.0.0.1/$PORT) 2>/dev/null; then
    echo "  proxy up"
    break
  fi
  sleep 1
done

export PGPASSWORD="$PG_PASSWORD"
PSQL="psql -h 127.0.0.1 -p $PORT -U $USER -d $DB -v ON_ERROR_STOP=1"

# Run each migration in order
for FILE in supabase/migrations/0001_init.sql supabase/migrations/0002_rls.sql supabase/migrations/0003_seed_starters.sql supabase/migrations/0004_analytics_views.sql; do
  echo "▸ Applying $FILE..."
  $PSQL -f "$FILE"
  echo "  ✓"
done

echo
echo "✓ All migrations applied."
echo
echo "Verify:"
echo "  PGPASSWORD=\$PG_PASSWORD psql -h 127.0.0.1 -p $PORT -U $USER -d $DB -c '\\dt'"
