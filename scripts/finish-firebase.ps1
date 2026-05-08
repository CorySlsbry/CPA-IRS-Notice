# NoticeReply — finalize Firebase setup once you have the keys + service account JSON.
#
# Run from repo root:
#   PS> .\scripts\finish-firebase.ps1 `
#       -ApiKey "AIzaSy..." `
#       -AuthDomain "salisbury-bookkeeping-b930a.firebaseapp.com" `
#       -ProjectId "salisbury-bookkeeping-b930a" `
#       -AppId "1:687855643285:web:..." `
#       -ServiceAccountPath "C:\Users\Cory\Downloads\salisbury-bookkeeping-b930a-firebase-adminsdk-XXXX.json"
#
# What this does:
#   1. Adds 4 NEXT_PUBLIC_FIREBASE_* env vars to Cloud Run service `cpa-irs-notification`
#   2. Uploads the service account JSON to the FIREBASE_SERVICE_ACCOUNT secret
#   3. Triggers a fresh revision so the new env takes effect

param(
  [Parameter(Mandatory=$true)] [string] $ApiKey,
  [Parameter(Mandatory=$true)] [string] $AuthDomain,
  [Parameter(Mandatory=$true)] [string] $ProjectId,
  [Parameter(Mandatory=$true)] [string] $AppId,
  [Parameter(Mandatory=$true)] [string] $ServiceAccountPath
)

$ErrorActionPreference = 'Stop'

$Project = 'salisbury-bookkeeping'
$Region  = 'us-west3'
$Service = 'cpa-irs-notification'

if (-not (Test-Path $ServiceAccountPath)) {
  Write-Error "Service account file not found at: $ServiceAccountPath"
  exit 1
}

Write-Host "[1/3] Uploading FIREBASE_SERVICE_ACCOUNT secret..." -ForegroundColor Cyan
gcloud secrets versions add FIREBASE_SERVICE_ACCOUNT `
  --data-file="$ServiceAccountPath" `
  --project=$Project
if ($LASTEXITCODE -ne 0) { throw "Secret upload failed" }

Write-Host ""
Write-Host "[2/3] Updating Cloud Run service with NEXT_PUBLIC_FIREBASE_* env vars..." -ForegroundColor Cyan
gcloud run services update $Service `
  --region=$Region `
  --project=$Project `
  --update-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$ApiKey,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$AuthDomain,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$ProjectId,NEXT_PUBLIC_FIREBASE_APP_ID=$AppId" `
  --update-secrets="FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest"
if ($LASTEXITCODE -ne 0) { throw "Cloud Run update failed" }

Write-Host ""
Write-Host "[3/3] Verifying..." -ForegroundColor Cyan
$rev = gcloud run services describe $Service --region=$Region --project=$Project --format='value(status.latestReadyRevisionName)' 2>$null
$url = gcloud run services describe $Service --region=$Region --project=$Project --format='value(status.url)' 2>$null

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Active revision: $rev"
Write-Host "  Service URL:     $url"
Write-Host ""
Write-Host "Sign up + log in flows are now live. Test:" -ForegroundColor Yellow
Write-Host "  $url/signup"
Write-Host ""
Write-Host "After signup, get your firm UUID and set MARKETING_FIRM_ID:" -ForegroundColor Yellow
Write-Host "  gcloud sql connect noticereply --user=postgres --project=$Project --database=noticereply"
Write-Host "    -- in psql:"
Write-Host "    select id from firms order by created_at desc limit 1;"
Write-Host "  printf '<the-uuid>' | gcloud secrets versions add MARKETING_FIRM_ID --data-file=- --project=$Project"
