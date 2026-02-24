# Script de Setup Interativo

Arquivo: `run-setup.ps1` — script PowerShell interativo que executa os passos necessários localmente, um por vez.

Como usar:

1. Abra PowerShell como usuário normal (não administrador requerido).
2. Navegue até a pasta do projeto:

```powershell
cd "C:/Users/Usuario/Desktop/JE AUTOMOVEIS"
```

3. Execute o script:

```powershell
.\run-setup.ps1
```

O script fará, passo a passo:
- Instalar dependências do backend (`npm install --production`) se o `npm` estiver disponível.
- Construir a imagem Docker `je-automoveis-backend` se o `docker` estiver disponível.
- Perguntar se deseja executar o container localmente (pedirá `SENDGRID_API_KEY` e `TO_EMAIL`).
- Criar commit e tentar dar `git push` se o `git` estiver instalado.

Se alguma ferramenta não estiver instalada, o script mostrará instruções e pulará o passo.

Segurança:
- O script pede a `SENDGRID_API_KEY` apenas se você optar por rodar o container localmente. Não armazena a chave em arquivos.

Depois de concluir, você pode testar o endpoint local em `http://localhost:3000/contact`.

Push & Deploy scripts
----------------------
Two helper scripts are provided to simplify pushing changes and triggering a Render deploy:

- `push-and-deploy.ps1` — interactive script that prompts for inputs and can call the Render API.
- `push-and-deploy.env.ps1` — non-interactive script for CI or automation that reads values from environment variables:
	- `RENDER_API_KEY`
	- `RENDER_SERVICE_ID`
	- optional `GIT_COMMIT_MSG`

Usage examples:

Interactive (local):
```powershell
.\push-and-deploy.ps1
```

Non-interactive (CI or local with env vars set):
```powershell
$env:RENDER_API_KEY = 'xxxxx'
$env:RENDER_SERVICE_ID = 'srv-abc123'
$env:GIT_COMMIT_MSG = 'chore: deploy backend'
.\push-and-deploy.env.ps1
```

