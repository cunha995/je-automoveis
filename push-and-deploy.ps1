<#
push-and-deploy.ps1

Interactive script to commit & push repository changes and optionally trigger a manual deploy
on Render via the Render API.

Usage: run from project root in PowerShell:
.\push-and-deploy.ps1

This script performs:
- checks for `git`
- runs `git add .`, `git commit -m "..."`, and `git push origin main`
- optionally calls Render API to create a deploy for a given `SERVICE_ID` using `RENDER_API_KEY`

Security: the script reads API keys from user input and does not store them to disk.
#>

Set-StrictMode -Version Latest
function Prompt-YesNo($msg){
  $r = Read-Host "$msg (y/n)"
  return $r -match '^[Yy]'
}

Write-Host "push-and-deploy: commit + push and optional Render deploy" -ForegroundColor Green

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "git não encontrado. Instale Git (https://git-scm.com/) e execute manualmente." -ForegroundColor Red
  exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root

$defaultMsg = "chore: update site"
$commitMsg = Read-Host "Commit message (enter para usar: '$defaultMsg')"
if ([string]::IsNullOrWhiteSpace($commitMsg)) { $commitMsg = $defaultMsg }

Write-Host "Running: git add ." -ForegroundColor Yellow
git add .

Write-Host "Running: git commit -m '$commitMsg'" -ForegroundColor Yellow
try {
  git commit -m "$commitMsg"
} catch {
  Write-Host "Commit falhou (possivelmente sem mudanças). Mensagem: $_" -ForegroundColor Yellow
}

Write-Host "Pushing to origin/main..." -ForegroundColor Yellow
try {
  git push origin main
  Write-Host "Push concluído." -ForegroundColor Green
} catch {
  Write-Host "Push falhou: $_" -ForegroundColor Red
  Pop-Location
  exit 1
}

if (Prompt-YesNo "Deseja disparar um deploy manual no Render agora?") {
  $renderKey = Read-Host "Insira seu RENDER_API_KEY" -AsSecureString
  $serviceId = Read-Host "Insira o SERVICE_ID do serviço no Render (ver Service Settings)"
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($renderKey))

  if ([string]::IsNullOrWhiteSpace($serviceId) -or [string]::IsNullOrWhiteSpace($plainKey)) {
    Write-Host "SERVICE_ID ou API key vazio — abortando deploy." -ForegroundColor Red
    Pop-Location
    exit 1
  }

  $url = "https://api.render.com/v1/services/$serviceId/deploys"
  Write-Host "Calling Render API to create deploy for service $serviceId..." -ForegroundColor Yellow
  try {
    $headers = @{ Authorization = "Bearer $plainKey"; Accept = 'application/json' }
    $body = '{}' | ConvertTo-Json
    $resp = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body -ContentType 'application/json'
    Write-Host "Deploy criado com sucesso. Response:" -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 4
  } catch {
    Write-Host "Falha chamando Render API: $_" -ForegroundColor Red
  }
}

Pop-Location
Write-Host "Finalizado." -ForegroundColor Green
