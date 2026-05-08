# NoticeReply — create the cheapest viable Cloud SQL Postgres instance.
#
# PowerShell version of create-cloud-sql.sh — no bash dependency.
#
# Run from the repo root:
#   PS> .\scripts\create-cloud-sql.ps1
#
# Tier breakdown (us-west3, monthly est.):
#   db-g1-small Enterprise + 10GB SSD + daily backup + no HA + no PITR + no public IP
#   approx $25/month total.

$ErrorActionPreference = 'Stop'

$Project = 'salisbury-bookkeeping'
$Region  = 'us-west3'
$Instance = 'noticereply'

function New-StrongPassword {
  # 32 chars from a safe-for-shell-and-postgres alphabet (no $ ` ' " \)
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $b64 = [Convert]::ToBase64String($bytes)
  $clean = ($b64 -replace '[^A-Za-z0-9]', '')
  return $clean.Substring(0, 32)
}

$RootPassword = New-StrongPassword
$AppPassword  = New-StrongPassword

Write-Host ""
Write-Host "Generated root password: $RootPassword" -ForegroundColor Yellow
Write-Host "Generated app  password: $AppPassword" -ForegroundColor Yellow
Write-Host ""
Write-Host "SAVE BOTH. Also written to `$HOME\.noticereply-credentials" -ForegroundColor Yellow

# Save credentials to a user-only file
$CredFile = Join-Path $HOME '.noticereply-credentials'
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

# Restrict to current user only (Windows ACL — drop inherited rights)
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

Write-Host "Credentials saved to: $CredFile" -ForegroundColor Green
Write-Host ""

# ─── Step 1: Create the Cloud SQL instance (5-10 min) ────────────────────────
Write-Host "[1/4] Creating Cloud SQL instance noticereply (5-10 min)..." -ForegroundColor Cyan
gcloud sql instances create $Instance `
  --database-version=POSTGRES_16 `
  --tier=db-g1-small `
  --edition=ENTERPRISE `
  --region=$Region `
  --storage-type=SSD `
  --storage-size=10 `
  --no-storage-auto-increase `
  --backup-start-time=09:00 `
  --no-assign-ip `
  --availability-type=zonal `
  --root-password=$RootPassword `
  --project=$Project
if ($LASTEXITCODE -ne 0) { throw "Cloud SQL instance creation failed" }

# ─── Step 2: Create the noticereply database ─────────────────────────────────
Write-Host ""
Write-Host "[2/4] Creating database 'noticereply'..." -ForegroundColor Cyan
gcloud sql databases create noticereply --instance=$Instance --project=$Project
if ($LASTEXITCODE -ne 0) { throw "Database creation failed" }

# ─── Step 3: Create the app user ─────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Creating app user (least privilege)..." -ForegroundColor Cyan
gcloud sql users create app `
  --instance=$Instance `
  --password=$AppPassword `
  --project=$Project
if ($LASTEXITCODE -ne 0) { throw "App user creation failed" }

# ─── Step 4: Write DATABASE_URL secret ───────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Writing DATABASE_URL to Secret Manager..." -ForegroundColor Cyan

# Pipe the URL through stdin so it never appears in shell args / history
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
Write-Host "Next: .\scripts\migrate-db.ps1   (or bash scripts/migrate-db.sh from Git Bash)" -ForegroundColor Yellow
