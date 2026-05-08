# NoticeReply — apply all SQL migrations against Cloud SQL via the Auth Proxy.
#
# Prerequisites:
#   1. Cloud SQL instance "noticereply" is Runnable
#   2. Database + app user exist (create-cloud-sql.ps1 handled this)
#   3. cloud-sql-proxy installed locally:
#        https://cloud.google.com/sql/docs/postgres/connect-auth-proxy
#      (download cloud-sql-proxy.exe, drop into a folder on PATH)
#   4. psql installed (https://www.postgresql.org/download/windows/  or `winget install PostgreSQL.PostgreSQL`)
#
# Run from repo root:
#   PS> .\scripts\migrate-db.ps1
#
# Reads passwords from $HOME\.noticereply-credentials by default.

$ErrorActionPreference = 'Stop'

$Project = 'salisbury-bookkeeping'
$Region  = 'us-west3'
$Instance = 'noticereply'
$Db = 'noticereply'
$User = 'app'
$ConnName = "${Project}:${Region}:${Instance}"
$ProxyPort = 15432

# Read app password from credentials file
$CredFile = Join-Path $HOME '.noticereply-credentials'
$Password = $env:PG_PASSWORD
if (-not $Password) {
  if (Test-Path $CredFile) {
    $line = Select-String -Path $CredFile -Pattern '^CLOUDSQL_APP_PASSWORD=' | Select-Object -First 1
    if ($line) { $Password = $line.Line.Substring('CLOUDSQL_APP_PASSWORD='.Length) }
  }
}
if (-not $Password) {
  Write-Error "PG_PASSWORD not set and CLOUDSQL_APP_PASSWORD not found in $CredFile."
  Write-Error "Run scripts\create-cloud-sql.ps1 first, or set `$env:PG_PASSWORD manually."
  exit 1
}

# Locate cloud-sql-proxy
$proxyBin = Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue
if (-not $proxyBin) { $proxyBin = Get-Command cloud_sql_proxy -ErrorAction SilentlyContinue }
if (-not $proxyBin) {
  Write-Error "cloud-sql-proxy not found in PATH."
  Write-Error "Download: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy"
  Write-Error "Drop the .exe in a folder on PATH and re-run."
  exit 1
}

# Locate psql
$psqlBin = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlBin) {
  Write-Error "psql not found in PATH. Install Postgres client: winget install PostgreSQL.PostgreSQL"
  exit 1
}

Write-Host "Starting cloud-sql-proxy on 127.0.0.1:$ProxyPort..." -ForegroundColor Cyan
$proxy = Start-Process -FilePath $proxyBin.Source `
  -ArgumentList @("--port=$ProxyPort", $ConnName) `
  -PassThru -WindowStyle Hidden

try {
  # Wait for proxy to bind
  Start-Sleep -Seconds 2
  $up = $false
  for ($i = 0; $i -lt 10; $i++) {
    try {
      $tcp = New-Object System.Net.Sockets.TcpClient
      $tcp.Connect('127.0.0.1', $ProxyPort)
      $tcp.Close()
      $up = $true
      break
    } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $up) { throw "cloud-sql-proxy did not start on port $ProxyPort" }

  $env:PGPASSWORD = $Password

  $migrations = @(
    'supabase/migrations/0001_init.sql',
    'supabase/migrations/0002_rls.sql',
    'supabase/migrations/0003_seed_starters.sql',
    'supabase/migrations/0004_analytics_views.sql',
    'supabase/migrations/0005_lead_magnets.sql',
    'supabase/migrations/0006_social.sql'
  )

  foreach ($file in $migrations) {
    if (-not (Test-Path $file)) {
      Write-Warning "Skipping missing $file"
      continue
    }
    Write-Host "Applying $file..." -ForegroundColor Cyan
    & psql -h 127.0.0.1 -p $ProxyPort -U $User -d $Db -v ON_ERROR_STOP=1 -f $file
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $file" }
    Write-Host "  ok" -ForegroundColor Green
  }

  Write-Host ""
  Write-Host "All migrations applied." -ForegroundColor Green
  Write-Host ""
  Write-Host "Verify tables:" -ForegroundColor Yellow
  Write-Host "  `$env:PGPASSWORD=`"$Password`"; psql -h 127.0.0.1 -p $ProxyPort -U $User -d $Db -c '\dt'"
}
finally {
  if ($proxy -and -not $proxy.HasExited) {
    Stop-Process -Id $proxy.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
