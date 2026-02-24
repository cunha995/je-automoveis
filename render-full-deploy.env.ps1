<#
render-full-deploy.env.ps1

Non-interactive full deploy using environment variables.
Set the following environment variables before running:
- RENDER_API_KEY (required)
- SENDGRID_API_KEY (required)
- REPO_URL (optional, defaults to git remote origin)
- BRANCH (optional, default: main)
- ROOT_DIR (optional, default: backend)
- SERVICE_NAME (optional, default: je-automoveis-backend)
- TO_EMAIL (optional, default: contato@je-automoveis.com)
- FROM_EMAIL (optional, default: no-reply@jeautomoveis.com)
- GIT_COMMIT_MSG (optional)

Run:
  cd "C:/Users/Usuario/Desktop/JE AUTOMOVEIS"
  .\render-full-deploy.env.ps1

This script will not store secrets on disk.
#>

Set-StrictMode -Version Latest

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "git not found. Install git and configure remote before running this script." -ForegroundColor Red
  exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root

$renderKey = $env:RENDER_API_KEY
if ([string]::IsNullOrWhiteSpace($renderKey)) { Write-Host "RENDER_API_KEY not set. Aborting." -ForegroundColor Red; Pop-Location; exit 1 }

$sendGridKey = $env:SENDGRID_API_KEY
if ([string]::IsNullOrWhiteSpace($sendGridKey)) { Write-Host "SENDGRID_API_KEY not set. Aborting." -ForegroundColor Red; Pop-Location; exit 1 }

$repo = $env:REPO_URL
if ([string]::IsNullOrWhiteSpace($repo)) {
  try { $repo = git config --get remote.origin.url } catch { $repo = '' }
}
if ([string]::IsNullOrWhiteSpace($repo)) { Write-Host "Repo URL not found. Set REPO_URL env var." -ForegroundColor Red; Pop-Location; exit 1 }

$branch = $env:BRANCH; if ([string]::IsNullOrWhiteSpace($branch)) { $branch = 'main' }
$rootDir = $env:ROOT_DIR; if ([string]::IsNullOrWhiteSpace($rootDir)) { $rootDir = 'backend' }
$serviceName = $env:SERVICE_NAME; if ([string]::IsNullOrWhiteSpace($serviceName)) { $serviceName = 'je-automoveis-backend' }
$toEmail = $env:TO_EMAIL; if ([string]::IsNullOrWhiteSpace($toEmail)) { $toEmail = 'contato@je-automoveis.com' }
$fromEmail = $env:FROM_EMAIL; if ([string]::IsNullOrWhiteSpace($fromEmail)) { $fromEmail = 'no-reply@jeautomoveis.com' }

$commitMsg = $env:GIT_COMMIT_MSG; if ([string]::IsNullOrWhiteSpace($commitMsg)) { $commitMsg = 'chore: deploy via script' }

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

Write-Host "Committing and pushing changes..." -ForegroundColor Yellow
git add .
try { git commit -m "$commitMsg" } catch { Write-Host "No changes to commit." -ForegroundColor Yellow }
try { git push origin $branch } catch { Write-Host "git push failed. Ensure remote and credentials." -ForegroundColor Red; Pop-Location; exit 1 }

Write-Host "Creating service on Render..." -ForegroundColor Cyan
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
