<#
docker-diagnose-and-run.ps1
Script para buildar, rodar e diagnosticar a imagem `je-backend`.
Uso:
  powershell -ExecutionPolicy Bypass -File .\docker-diagnose-and-run.ps1
#>

function Run-Print($cmd){
    Write-Host "\n#> $cmd" -ForegroundColor Cyan
    iex $cmd
}

Write-Host "== Diagnóstico Docker para je-backend ==" -ForegroundColor Green

if(-not (Get-Command docker -ErrorAction SilentlyContinue)){
    Write-Host "Erro: Docker não encontrado no PATH. Instale Docker Desktop e tente novamente." -ForegroundColor Red
    exit 1
}

Push-Location (Split-Path -Path $MyInvocation.MyCommand.Path -Parent)

# Build
Run-Print "docker --version"
Run-Print "docker build -t je-backend ."

# Run detached
Run-Print "docker rm -f je-back 2>$null | Out-Null"
Run-Print "docker run --name je-back -p 3000:3000 -d je-backend"

Start-Sleep -Seconds 3

# Status and logs
Run-Print "docker ps -a"
Run-Print "docker logs je-back --tail 500"
Run-Print "docker inspect je-back --format='Status: {{.State.Status}} ExitCode: {{.State.ExitCode}}'"

# If container not running, try interactive run to surface errors
$inspect = docker inspect je-back --format='{{.State.Status}} {{.State.ExitCode}}' 2>$null
if($inspect -and $inspect -notmatch 'running'){
    Write-Host "Container não está em estado 'running'. Vou tentar rodar interativo para mostrar a saída (CTRL+C para sair)." -ForegroundColor Yellow
    Write-Host "Se preferir, copie e cole a saída anterior aqui para eu analisar." -ForegroundColor Yellow
    Write-Host "Rodando interativo..."
    Write-Host "(Se isso travar seu terminal, abra outro e rode: docker logs je-back --tail 500)" -ForegroundColor Yellow
    Run-Print "docker run --rm -it --name je-back-debug -p 3000:3000 je-backend"
}

# Try running bypassing ENTRYPOINT/HEALTHCHECK if previous failed
Write-Host "\nTentativa alternativa: rodar diretamente 'node index.js' dentro do container (override entrypoint)." -ForegroundColor Cyan
Write-Host "Se o container anterior ainda existir e estiver parado, vamos removê-lo e tentar essa execução (interativa)." -ForegroundColor Cyan
Run-Print "docker rm -f je-back 2>$null | Out-Null"
Run-Print "docker run --rm -it --entrypoint node je-backend index.js"

Pop-Location

Write-Host "\n== Script finalizado. Cole aqui a saída dos comandos acima se ainda houver erro. ==" -ForegroundColor Green
