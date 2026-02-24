# Render deployment checklist — JE Automóveis backend

Este checklist descreve passo a passo como publicar o backend (`backend/`) no Render e como testar a integração com o frontend.

1) Preparar o repositório
- Certifique-se de ter feito push do repositório para o GitHub (veja `push-instructions.txt`).

2) Criar Web Service no Render
- No painel do Render: New → Web Service → Connect to GitHub → selecione o repositório `je-automoveis`.
- Em **Root Directory** informe `backend` (importante).
- **Branch:** `main` (ou a branch que preferir).
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** adicione as variáveis listadas abaixo.

3) Variáveis de ambiente necessárias
- `SMTP_HOST` — host SMTP (ex: smtp.gmail.com / smtp.sendgrid.net)
- `SMTP_PORT` — porta (ex: 587)
- `SMTP_SECURE` — `true` (TLS) ou `false` (STARTTLS/587)
- `SMTP_USER` — usuário SMTP
- `SMTP_PASS` — senha/API key SMTP
- `TO_EMAIL` — email que receberá as mensagens (ex: contato@jeautomoveis.com)
- `FROM_EMAIL` — remetente (opcional; ex: no-reply@jeautomoveis.com)

Observação: se preferir usar SendGrid ou outro serviço via API, gere uma API key e use as credenciais SMTP (SendGrid aceita SMTP via user e pass). Alternativamente, troque a implementação no backend para usar a SDK do provedor.

4) Configurações adicionais no Render
- Habilite **Auto Deploy** para que o Render faça deploy a cada push.
- (Opcional) Configure Health Check: Path `/` (o servidor responde com json {ok:true}).

5) Testar backend localmente (opcional antes de deploy)
- Instale Node.js (LTS) localmente.

```powershell
cd backend
npm install
copy .env.example .env
# edite .env com suas credenciais
npm start
```

6) Testar endpoint /contact com curl

```bash
curl -X POST https://SEU-BACKEND.onrender.com/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@exemplo.com","phone":"0000","message":"Mensagem de teste"}'
```

Resposta esperada: JSON com `{ "ok": true, ... }` ou erro com `error`.

7) Atualizar frontend com URL do backend
- Abra `scripts.js` na raiz do projeto e defina `BACKEND_URL` com a URL pública do Render (sem barra final). Exemplo:

```js
// const BACKEND_URL = 'https://je-backend.onrender.com';
```

- Commit e push das alterações do frontend.

8) Deploy do frontend (opções)
- Netlify: conectar ao repositório, Build command vazio (site estático), Publish directory -> `/`.
- Vercel: conectar ao repositório e seguir o wizard para site estático.
- GitHub Pages: Settings → Pages → Source: `main` branch → root.

9) Testes finais
- Acesse a página hospedada do frontend, preencha o formulário e envie.
- No painel do Render verifique os logs do serviço backend para validar recebimento e envio de email.

10) Troubleshooting
- Se receber erro de CORS: o backend já habilita `cors()`; confirme que a origem não está bloqueada.
- Erro de SMTP: verifique `SMTP_USER`/`SMTP_PASS` e se o provedor exige configuração adicional (ex: permitir apps menos seguros, ativar API key, etc.).

Se quiser, eu posso:
- gerar o commit que define `BACKEND_URL` já preenchido com a URL do Render (após você compartilhar a URL), ou
- adaptar o backend para usar SendGrid (SDK) em vez de SMTP.
