# NoticeReply — create the cheapest viable Cloud SQL Postgres instance.
#
# PowerShell version. No bash dependency.
#
# Run from the repo root:
#   PS> .\scripts\create-cloud-sql.ps1
#
# Tier breakdown (us-west3, monthly est.):
#   db-g1-small Enterprise + 10GB SSD + Public IP w/ no authorized networks
#   + daily backup + no HA + no PITR ≈ $25/mo total.
#
# Public IP note: Public IP is enabled but with NO authorized networks.
# That means no one on the internet can connect — the only access path is
# via Cloud SQL Auth Proxy (Cloud Run uses the proxy automatically when you
# pass --add-cloudsql-instances at deploy). This is the standard Cloud Run
# + Cloud SQL pattern; using Private IP requires VPC + Service Networking
# peering setup which is heavier.
#
# Idempotent: if $HOME\.noticereply-credentials already exists, re-uses
# the saved passwords instead of generating new ones. Safe to re-run.

$ErrorActionPreference = 'Stop'

$Project = 'salisbury-bookkeeping'
$Region  = 'us-west3'
$Instance = 'noticereply'

function New-StrongPassword {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $b64 = [Convert]::ToBase64String($bytes)
  $clean = ($b64 -replace '[^A-Za-z0-9]', '')
  return $clean.Substring(0, 32)
}

function Read-CredentialField($file, $field) {
  $line = Select-String -Path $file -Pattern "^$field=" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($line) { return $line.Line.Substring("$field=".Length) }
  return $null
}

$CredFile = Join-Path $HOME '.noticereply-credentials'

# Reuse existing credentials if present (idempotent re-runs)
$ExistingRoot = if (Test-Path $CredFile) { Read-CredentialField $CredFile 'CLOUDSQL_ROOT_PASSWORD' } else { $null }
$ExistingApp  = if (Test-Path $CredFile) { Read-CredentialField $CredFile 'CLOUDSQL_APP_PASSWORD' } else { $null }

$RootPassword = if ($ExistingRoot) { $ExistingRoot } else { New-StrongPassword }
$AppPassword  = if ($ExistingApp)  { $ExistingApp }  else { New-StrongPassword }

if ($ExistingRoot -and $ExistingApp) {
  Write-Host "Re-using credentials from $CredFile (idempotent re-run)." -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "Generated root password: $RootPassword" -ForegroundColor Yellow
  Write-Host "Generated app  password: $AppPassword" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "SAVE BOTH. Also written to $CredFile" -ForegroundColor Yellow
}

$ConnName = "${Project}:${Region}:${Instance}"
$DatabaseUrl = "postgres://app:${AppPassword}@/noticereply?host=/cloudsql/${ConnName}"

@"
# NoticeReply Cloud SQL credentials — generated $(Get-Date -Format o)
# DO NOT commit. Move/delete after pasting into Secret Manager.
CLOUDSQL_INSTANCE=$ConnName
CLOUDSQL_ROOT_USER=postgres
CLOUDSQL_ROOT_PASSWORD=$RootPassword
CLOUDSQL_APP_USER=app
CLOUDSQL_APP_PASSWORD=$AppPassword
DATABASE_URL=$DatabaseUrl
"@ | Out-File -FilePath $CredFile -Encoding utf8 -Force

# Restrict ACL to current user
try {
  $acl = Get-Acl $CredFile
  $acl.SetAccessRuleProtection($true, $false)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "$env:USERNAME", 'FullControl', 'Allow')
  $acl.SetAccessRule($rule) | Out-Null
  Set-Acl -Path $CredFile -AclObject $acl
} catch {
  Write-Warning "Could not lock down ACL on credentials file: $_"
}
Write-Host "Credentials file:  $CredFile" -ForegroundColor Green
Write-Host ""

# ─── Step 1: Create the Cloud SQL instance (skip if exists) ──────────────────
Write-Host "[1/4] Cloud SQL instance noticereply..." -ForegroundColor Cyan
$existsCheck = gcloud sql instances describe $Instance --project=$Project --format='value(name)' 2>$null
if ($LASTEXITCODE -eq 0 -and $existsCheck) {
  Write-Host "  already exists, skipping create." -ForegroundColor Yellow
} else {
  Write-Host "  creating (5-10 min)..." -ForegroundColor Cyan
  # Public IP enabled (default) with no authorized networks. Connection
  # only via Cloud SQL Auth Proxy — secure, standard Cloud Run pattern.
  gcloud sql instances create $Instance `
    --database-version=POSTGRES_16 `
    --tier=db-g1-small `
    --edition=ENTERPRISE `
    --region=$Region `
    --storage-type=SSD `
    --storage-size=10 `
    --no-storage-auto-increase `
    --backup-start-time=09:00 `
    --availability-type=zonal `
    --root-password=$RootPassword `
    --project=$Project
  if ($LASTEXITCODE -ne 0) { throw "Cloud SQL instance creation failed" }
}

# ─── Step 2: Create the noticereply database (idempotent) ───────────────────
Write-Host ""
Write-Host "[2/4] Database 'noticereply'..." -ForegroundColor Cyan
$dbCheck = gcloud sql databases describe noticereply --instance=$Instance --project=$Project --format='value(name)' 2>$null
if ($LASTEXITCODE -eq 0 -and $dbCheck) {
  Write-Host "  already exists, skipping." -ForegroundColor Yellow
} else {
  gcloud sql databases create noticereply --instance=$Instance --project=$Project
  if ($LASTEXITCODE -ne 0) { throw "Database creation failed" }
}

# ─── Step 3: Create the app user (idempotent) ───────────────────────────────
Write-Host ""
Write-Host "[3/4] App user (least privilege)..." -ForegroundColor Cyan
$appUserCheck = gcloud sql users list --instance=$Instance --project=$Project --filter='name=app' --format='value(name)' 2>$null
if ($appUserCheck -match 'app') {
  Write-Host "  already exists; updating password to match credentials file." -ForegroundColor Yellow
  gcloud sql users set-password app --instance=$Instance --password=$AppPassword --project=$Project
  if ($LASTEXITCODE -ne 0) { throw "App user password update failed" }
} else {
  gcloud sql users create app --instance=$Instance --password=$AppPassword --project=$Project
  if ($LASTEXITCODE -ne 0) { throw "App user creation failed" }
}

# ─── Step 4: Write DATABASE_URL secret ──────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Writing DATABASE_URL to Secret Manager..." -ForegroundColor Cyan
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, $DatabaseUrl, (New-Object System.Text.UTF8Encoding($false)))
gcloud secrets versions add DATABASE_URL --data-file=$tmp --project=$Project
Remove-Item $tmp -Force
if ($LASTEXITCODE -ne 0) { throw "Secret Manager write failed" }

Write-Host ""
Write-Host "Cloud SQL ready." -ForegroundColor Green
Write-Host ""
Write-Host "Connection name: $ConnName"
Write-Host "Database:        noticereply"
Write-Host "App user:        app"
Write-Host "Passwords:       saved to $CredFile"
Write-Host ""
Write-Host "Next: .\scripts\migrate-db.ps1   (after Cloud SQL state turns Runnable)" -ForegroundColor Yellow
