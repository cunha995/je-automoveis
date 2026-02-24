<#
render-create-service.ps1

Creates a Web Service on Render (Docker), sets environment variables (SendGrid + emails)
and triggers a deploy. Run locally in PowerShell and paste secrets when prompted.

Usage:
  cd "C:/Users/Usuario/Desktop/JE AUTOMOVEIS"
  .\render-create-service.ps1

This script does NOT store keys on disk. Keep your API keys safe.
#>

Set-StrictMode -Version Latest

Write-Host "Render service creator - interactive" -ForegroundColor Green

$defaultRepo = 'https://github.com/cunha995/je-automoveis.git'
$repo = Read-Host "Repo URL (enter for default: $defaultRepo)"
if ([string]::IsNullOrWhiteSpace($repo)) { $repo = $defaultRepo }

$branch = Read-Host "Branch (enter for 'main')"
if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'main' }

$rootDir = Read-Host "Root directory (enter for 'backend')"
if ([string]::IsNullOrWhiteSpace($rootDir)) { $rootDir = 'backend' }

$serviceName = Read-Host "Service name (enter for 'je-automoveis-backend')"
if ([string]::IsNullOrWhiteSpace($serviceName)) { $serviceName = 'je-automoveis-backend' }

Write-Host "\nYou will be prompted for your Render API key and SendGrid API key. They will not be saved to disk." -ForegroundColor Yellow

$renderKeySS = Read-Host "RENDER_API_KEY" -AsSecureString
$renderKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($renderKeySS))

$sendGridKeySS = Read-Host "SENDGRID_API_KEY" -AsSecureString
$sendGridKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sendGridKeySS))

$toEmail = Read-Host "TO_EMAIL (enter for contato@je-automoveis.com)"
if ([string]::IsNullOrWhiteSpace($toEmail)) { $toEmail = 'contato@je-automoveis.com' }

$fromEmail = Read-Host "FROM_EMAIL (enter for no-reply@jeautomoveis.com)"
if ([string]::IsNullOrWhiteSpace($fromEmail)) { $fromEmail = 'no-reply@jeautomoveis.com' }

function Post-Render($uri, $bodyObj) {
  try {
    $json = $bodyObj | ConvertTo-Json -Depth 6
    $resp = Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization = "Bearer $renderKey"; Accept = 'application/json' } -Body $json -ContentType 'application/json'
    return $resp
  } catch {
    Write-Host "Request to $uri failed:`n$_" -ForegroundColor Red
    return $null
  }
}

Write-Host "\nCreating service on Render..." -ForegroundColor Cyan
$serviceBody = @{
  name = $serviceName
  repo = $repo
  branch = $branch
  rootDirectory = $rootDir
  serviceType = 'web_service'
  env = 'docker'
  autoDeploy = $true
}

$createResp = Post-Render 'https://api.render.com/v1/services' $serviceBody
if (-not $createResp) { Write-Host 'Service creation failed.' -ForegroundColor Red; exit 1 }

$serviceId = $createResp.id
Write-Host "Service created. ID: $serviceId" -ForegroundColor Green

Write-Host "\nAdding environment variables (SendGrid, TO_EMAIL, FROM_EMAIL)..." -ForegroundColor Cyan
$envVars = @(
  @{ key = 'SENDGRID_API_KEY'; value = $sendGridKey; secure = $true },
  @{ key = 'TO_EMAIL'; value = $toEmail; secure = $false },
  @{ key = 'FROM_EMAIL'; value = $fromEmail; secure = $false }
)

$envResp = Post-Render "https://api.render.com/v1/services/$serviceId/env-vars" $envVars
if (-not $envResp) { Write-Host 'Adding env vars failed.' -ForegroundColor Red; exit 1 }
Write-Host "Environment variables added." -ForegroundColor Green

Write-Host "\nTriggering initial deploy..." -ForegroundColor Cyan
$deployResp = Post-Render "https://api.render.com/v1/services/$serviceId/deploys" @{ }
if (-not $deployResp) { Write-Host 'Deploy trigger failed.' -ForegroundColor Red; exit 1 }

Write-Host "Deploy started. Check Render dashboard for logs and status." -ForegroundColor Green
Write-Host "Service ID: $serviceId" -ForegroundColor Yellow
if ($createResp && $createResp.serviceDetails -and $createResp.serviceDetails.defaultDomain) {
  Write-Host "Public URL: https://$($createResp.serviceDetails.defaultDomain)" -ForegroundColor Yellow
}

Write-Host "\nDone." -ForegroundColor Green
