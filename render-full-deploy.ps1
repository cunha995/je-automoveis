<#
render-full-deploy.ps1

Performs full flow locally:
- git add/commit/push
- create Web Service on Render (Docker)
- add env vars (SENDGRID_API_KEY, TO_EMAIL, FROM_EMAIL)
- trigger a deploy

Run from project root:
  cd "C:/Users/Usuario/Desktop/JE AUTOMOVEIS"
  .\render-full-deploy.ps1

Prompts for secrets securely; nothing is written to disk.
#>

Set-StrictMode -Version Latest

function Read-Secure($prompt){
  $ss = Read-Host $prompt -AsSecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss))
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "git not found. Install git and configure remote before running this script." -ForegroundColor Red
  exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root

Write-Host "Full deploy: git push -> create service on Render -> add env -> deploy" -ForegroundColor Green

# 1) Git commit & push
$commitMsg = Read-Host "Commit message (enter for default 'chore: deploy')"
if ([string]::IsNullOrWhiteSpace($commitMsg)) { $commitMsg = 'chore: deploy' }

Write-Host "Running: git add ." -ForegroundColor Yellow
git add .
try { git commit -m "$commitMsg" } catch { Write-Host "No changes to commit or commit failed." -ForegroundColor Yellow }

Write-Host "Pushing to origin/main..." -ForegroundColor Yellow
try { git push origin main } catch { Write-Host "git push failed. Ensure remote 'origin' exists and you are authenticated." -ForegroundColor Red; Pop-Location; exit 1 }

# 2) Gather Render/SendGrid info
$renderKey = Read-Secure "RENDER_API_KEY (input hidden)"
if ([string]::IsNullOrWhiteSpace($renderKey)) { Write-Host "RENDER_API_KEY required." -ForegroundColor Red; Pop-Location; exit 1 }

$sendGridKey = Read-Secure "SENDGRID_API_KEY (input hidden)"
if ([string]::IsNullOrWhiteSpace($sendGridKey)) { Write-Host "SENDGRID_API_KEY required." -ForegroundColor Red; Pop-Location; exit 1 }

$defaultRepo = ''
try { $defaultRepo = git config --get remote.origin.url } catch { $defaultRepo = '' }
if ([string]::IsNullOrWhiteSpace($defaultRepo)) { $defaultRepo = Read-Host "Repo URL (enter manually)" }

$branch = Read-Host "Branch (enter for 'main')"
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'main' }

$rootDir = Read-Host "Root directory (enter for 'backend')"
if ([string]::IsNullOrWhiteSpace($rootDir)) { $rootDir = 'backend' }

$serviceName = Read-Host "Service name (enter for 'je-automoveis-backend')"
if ([string]::IsNullOrWhiteSpace($serviceName)) { $serviceName = 'je-automoveis-backend' }

$toEmail = Read-Host "TO_EMAIL (enter for contato@je-automoveis.com)"
if ([string]::IsNullOrWhiteSpace($toEmail)) { $toEmail = 'contato@je-automoveis.com' }

$fromEmail = Read-Host "FROM_EMAIL (enter for no-reply@jeautomoveis.com)"
if ([string]::IsNullOrWhiteSpace($fromEmail)) { $fromEmail = 'no-reply@jeautomoveis.com' }

function Post-Render($uri, $bodyObj) {
  try {
    $json = $bodyObj | ConvertTo-Json -Depth 6
    return Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization = "Bearer $renderKey"; Accept = 'application/json' } -Body $json -ContentType 'application/json'
  } catch {
    Write-Host "Request to $uri failed:`n$($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) { $_.Exception.Response.GetResponseStream() | %{ (New-Object System.IO.StreamReader($_)).ReadToEnd() } | Write-Host }
    return $null
  }
}

Write-Host "Creating service on Render..." -ForegroundColor Cyan
$serviceBody = @{
  name = $serviceName
  repo = $defaultRepo
  branch = $branch
  rootDirectory = $rootDir
  serviceType = 'web_service'
  env = 'docker'
  autoDeploy = $true
}

$createResp = Post-Render 'https://api.render.com/v1/services' $serviceBody
if (-not $createResp) { Write-Host 'Service creation failed. Check credentials and repo access.' -ForegroundColor Red; Pop-Location; exit 1 }

$serviceId = $createResp.id
Write-Host "Service created. ID: $serviceId" -ForegroundColor Green

Write-Host "Adding environment variables..." -ForegroundColor Cyan
$envVars = @(
  @{ key = 'SENDGRID_API_KEY'; value = $sendGridKey; secure = $true },
  @{ key = 'TO_EMAIL'; value = $toEmail; secure = $false },
  @{ key = 'FROM_EMAIL'; value = $fromEmail; secure = $false }
)

$envResp = Post-Render "https://api.render.com/v1/services/$serviceId/env-vars" $envVars
if (-not $envResp) { Write-Host 'Adding env vars failed.' -ForegroundColor Red; Pop-Location; exit 1 }
Write-Host "Environment variables added." -ForegroundColor Green

Write-Host "Triggering deploy..." -ForegroundColor Cyan
$deployResp = Post-Render "https://api.render.com/v1/services/$serviceId/deploys" @{ }
if (-not $deployResp) { Write-Host 'Deploy trigger failed.' -ForegroundColor Red; Pop-Location; exit 1 }

Write-Host "Deploy started. Monitor logs on Render dashboard." -ForegroundColor Green
Write-Host "Service ID: $serviceId" -ForegroundColor Yellow
if ($createResp.serviceDetails -and $createResp.serviceDetails.defaultDomain) {
  Write-Host "Public URL: https://$($createResp.serviceDetails.defaultDomain)" -ForegroundColor Yellow
}

Pop-Location
Write-Host "All steps completed." -ForegroundColor Green
