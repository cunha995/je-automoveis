<#
push-and-deploy.env.ps1

Non-interactive script to commit & push and optionally trigger Render deploy using
environment variables:

- `RENDER_API_KEY` - your Render API key (optional, required to trigger deploy)
- `RENDER_SERVICE_ID` - your Render service id (optional, required to trigger deploy)
- `GIT_COMMIT_MSG` - commit message (optional, default provided)

Run from project root:
powershell
.\push-and-deploy.env.ps1

This is suitable for CI or for users who prefer not to enter secrets interactively.
#>

Set-StrictMode -Version Latest

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "git not found. Install git and run manually." -ForegroundColor Red
  exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root

$commitMsg = $env:GIT_COMMIT_MSG
if ([string]::IsNullOrWhiteSpace($commitMsg)) { $commitMsg = 'chore: update site' }

Write-Host "git add ." -ForegroundColor Yellow
git add .

Write-Host "git commit -m '$commitMsg'" -ForegroundColor Yellow
try { git commit -m "$commitMsg" } catch { Write-Host "No changes to commit or commit failed." -ForegroundColor Yellow }

Write-Host "git push origin main" -ForegroundColor Yellow
try { git push origin main } catch { Write-Host "git push failed." -ForegroundColor Red; Pop-Location; exit 1 }

# Trigger Render deploy if env vars present
if (-not [string]::IsNullOrWhiteSpace($env:RENDER_API_KEY) -and -not [string]::IsNullOrWhiteSpace($env:RENDER_SERVICE_ID)) {
  $url = "https://api.render.com/v1/services/$($env:RENDER_SERVICE_ID)/deploys"
  Write-Host "Triggering Render deploy for service $($env:RENDER_SERVICE_ID)..." -ForegroundColor Yellow
  try {
    $headers = @{ Authorization = "Bearer $env:RENDER_API_KEY"; Accept = 'application/json' }
    $body = '{}' | ConvertTo-Json
    $resp = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body -ContentType 'application/json'
    Write-Host "Render deploy triggered." -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 4
  } catch {
    Write-Host "Render deploy failed: $_" -ForegroundColor Red
  }
} else {
  Write-Host "RENDER_API_KEY or RENDER_SERVICE_ID not set. Skipping Render deploy." -ForegroundColor Yellow
}

Pop-Location
Write-Host "Done." -ForegroundColor Green
