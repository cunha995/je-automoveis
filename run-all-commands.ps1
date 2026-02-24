<#
Run-all-commands.ps1
Wrapper para executar os passos locais necessários para instalar, rodar e testar o backend, e sugerir os próximos passos para deploy.
Uso:
  powershell -ExecutionPolicy Bypass -File .\run-all-commands.ps1
  ou
  .\run-all-commands.ps1 -UseDocker
#>
param(
  [switch]$UseDocker
)
function Check-Command($name){
    return (Get-Command $name -ErrorAction SilentlyContinue) -ne $null
}
Write-Host "== Verificando ferramentas essenciais =="
$tools=@("git","node","npm","docker")
foreach($t in $tools){
    if(Check-Command $t){ Write-Host "$t: OK" } else { Write-Host "$t: NÃO encontrado" }
}

# Instala dependências do backend
if(-not (Test-Path "backend")){
    Write-Host "Pasta 'backend' não encontrada. Verifique se você está na raiz do projeto."; exit 1
}
Push-Location backend
if(Test-Path package-lock.json){
    Write-Host "Executando: npm ci"
    npm ci
} else {
    Write-Host "Executando: npm install"
    npm install
}

# Rodar com Docker ou npm
if($UseDocker -and (Check-Command "docker")){
    Write-Host "Construindo imagem Docker: je-backend"
    docker build -t je-backend .
    Write-Host "Parando container anterior (se existir) e iniciando novo container na porta 3000"
    docker rm -f je-backend-temp -v 2>$null | Out-Null
    docker run -d --name je-backend-temp -p 3000:3000 je-backend
} else {
    if(-not (Check-Command "npm")){
        Write-Host "Erro: 'npm' não foi encontrado no PATH. Instale Node.js/npm e tente novamente."; Pop-Location; exit 2
    }
    Write-Host "Iniciando backend via npm em background e capturando logs em 'backend/server.log'..."
    $serverLog = Join-Path (Get-Location) "server.log"
    if(Test-Path $serverLog){ Remove-Item $serverLog -ErrorAction SilentlyContinue }
    $cmd = "/c npm run start > \"$serverLog\" 2>&1"
    Start-Process -FilePath "cmd.exe" -ArgumentList $cmd -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru | Out-Null
    Start-Sleep -Seconds 1
    if(Test-Path $serverLog){ Write-Host "Logs iniciados em: $serverLog" } else { Write-Host "Aguardando criação de $serverLog..." }
}

Write-Host "Aguardando 6 segundos para o servidor subir..."
Start-Sleep -Seconds 6

# Testes básicos
$localUrl = "http://localhost:3000"
Write-Host "Testando health: GET $localUrl/"
try{ $r = Invoke-RestMethod -Uri "$localUrl/" -Method GET -UseBasicParsing; Write-Host "Resposta health: $r" } catch { Write-Host "Falha no health: $_" }

Write-Host "Testando endpoint /contact com payload de exemplo"
$payload = @{ name = "Teste"; email = "teste@example.com"; message = "Mensagem de teste enviada via script" }
try{
    $r = Invoke-RestMethod -Uri "$localUrl/contact" -Method POST -Body ($payload | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
    Write-Host "Resposta /contact:`n$r"
} catch { Write-Host "Falha ao chamar /contact: $_" }

if(Test-Path (Join-Path (Get-Location) "server.log")){
    Write-Host "\n--- Últimas linhas do servidor (server.log) ---"
    Get-Content -Path (Join-Path (Get-Location) "server.log") -Tail 60 | ForEach-Object { Write-Host $_ }
    Write-Host "--- fim do log ---\n"
} else {
    Write-Host "Arquivo de log do servidor não encontrado (server.log)." 
}

Pop-Location

Write-Host "\n== Resultado: verifique as mensagens acima =="
Write-Host "Próximos passos sugeridos:"
Write-Host "- Se tudo OK, rode `push-and-deploy.ps1` para commitar/push e disparar deploy no Render (ou use `render-full-deploy.ps1`)."
Write-Host "- Se houver falha, abra os logs no painel do Render e cole trechos (sem chaves/segredos) para eu analisar."

Write-Host "Execução finalizada."