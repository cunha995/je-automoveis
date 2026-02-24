<#
Interactive setup script for JE Automoveis project.
Runs steps one-by-one, checking for required tools (npm, docker, git).
Run this from PowerShell as: .\run-setup.ps1
#>
Set-StrictMode -Version Latest
function Pause-Continue($msg){ Write-Host "`n$msg`n" -ForegroundColor Cyan; Read-Host "Pressione Enter para continuar ou Ctrl+C para abortar" }

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Host "JE Automoveis - Setup interativo" -ForegroundColor Green

Pause-Continue "Passo 1: Instalar dependências do backend (npm)"
if (Get-Command npm -ErrorAction SilentlyContinue) {
  Push-Location (Join-Path $root 'backend')
  Write-Host "Executando: npm install --production" -ForegroundColor Yellow
  npm install --production
  Pop-Location
} else {
  Write-Host "npm não encontrado. Instale Node.js (https://nodejs.org/) e execute este script novamente." -ForegroundColor Red
}

Pause-Continue "Passo 2: Construir imagem Docker (opcional - necessário Docker instalado)"
if (Get-Command docker -ErrorAction SilentlyContinue) {
  Write-Host "Construindo imagem Docker: je-automoveis-backend" -ForegroundColor Yellow
  docker build -t je-automoveis-backend (Join-Path $root 'backend')
} else {
  Write-Host "Docker não encontrado. Instale Docker Desktop e execute este passo manualmente se desejar." -ForegroundColor Red
}

Pause-Continue "Passo 3: Executar container Docker local (opcional)"
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $sg = Read-Host "Se deseja rodar o container agora, insira SENDGRID_API_KEY (ou Enter para pular)"
  if (![string]::IsNullOrWhiteSpace($sg)) {
    $to = Read-Host "Enter TO_EMAIL (ou Enter para usar contato@jeautomoveis.com)"
    if ([string]::IsNullOrWhiteSpace($to)) { $to = 'contato@jeautomoveis.com' }
    Write-Host "Iniciando container (mapeando porta 3000 localmente)..." -ForegroundColor Yellow
    docker run -e SENDGRID_API_KEY=$sg -e TO_EMAIL=$to -p 3000:3000 je-automoveis-backend
  } else { Write-Host "Pulando execução do container." }
} else { Write-Host "Docker não encontrado. Pulando execução do container." }

Pause-Continue "Passo 4: Preparar e enviar commit para o GitHub (se git disponível)"
if (Get-Command git -ErrorAction SilentlyContinue) {
  Write-Host "Adicionando alterações e criando commit..." -ForegroundColor Yellow
  Push-Location $root
  git add .
  git commit -m "chore: setup backend Docker and sendgrid" -q
  Write-Host "Agora vai tentar dar push para o remoto 'origin' branch 'main' (pode pedir credenciais)." -ForegroundColor Yellow
  git push -u origin main
  Pop-Location
} else {
  Write-Host "git não encontrado. Instale Git (https://git-scm.com/) e execute os comandos manualmente:" -ForegroundColor Red
  Write-Host "  git add ."; Write-Host "  git commit -m 'Initial commit'"; Write-Host "  git push origin main"
}

Write-Host "Setup finalizado. Se executou o container, abra http://localhost:3000 para testar." -ForegroundColor Green
