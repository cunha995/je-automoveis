# JE Automóveis — Backend (Express)

Este serviço recebe o formulário de contato e envia email usando SMTP (Nodemailer).

Variáveis de ambiente (veja `.env.example`):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`
- `TO_EMAIL` — email que receberá as mensagens
Alternatively you can use SendGrid (recommended):
- `SENDGRID_API_KEY` — API key from SendGrid. When present the backend will use SendGrid API to send messages.

Deploy no Render:
1. Crie um novo "Web Service" no Render a partir do repositório que contém esta pasta `backend`.
2. Em Build Command: `npm install`
3. Em Start Command: `npm start`
4. Adicione as variáveis de ambiente no painel do Render conforme `.env.example`.

Painel administrativo de veículos
---------------------------------
O projeto agora possui painel em `/admin` para cadastrar, editar e excluir veículos com foto.

Credenciais padrão (altere em produção):
- `ADMIN_USERNAME=je2026`
- `ADMIN_PASSWORD=Je2026`

Recomendado no Render:
1. Em Environment, definir `ADMIN_USERNAME` e `ADMIN_PASSWORD` com valores fortes.
2. Fazer deploy após salvar as variáveis.
3. Acessar `https://SEU-SERVICO.onrender.com/admin`.

Persistência de fotos com Cloudinary (recomendado)
---------------------------------------------------
Para não perder fotos após restart/redeploy, configure Cloudinary no Render:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER` (opcional, padrão: `je-automoveis`)

Quando essas variáveis estão configuradas, o painel `/admin` salva imagens direto no Cloudinary.
Se não estiverem, o sistema usa `uploads/` local (temporário em ambientes free).

SendGrid quick setup:
1. Create a SendGrid account and generate an API Key (Full Access to Mail Send).
2. Add `SENDGRID_API_KEY` to Render's Environment variables for the service.
3. Deploy — the backend will detect `SENDGRID_API_KEY` and use SendGrid automaticamente.

Docker notes
---------------
This project includes a `Dockerfile` so you can deploy using Render's Docker runtime or run locally with Docker.

Build and run locally with Docker:

```bash
docker build -t je-automoveis-backend ./backend
docker build -t je-automoveis-backend ./backend
docker run -e SENDGRID_API_KEY=your_key -e TO_EMAIL=contato@jeautomoveis.com -p 3000:3000 je-automoveis-backend

Notes: the `Dockerfile` uses `npm ci` when a `package-lock.json` file is present for reproducible installs, runs the container as a non-root `node` user and exposes a simple healthcheck on `/`.
```

On Render, if you choose the Docker runtime the platform will use the `Dockerfile` at `backend/Dockerfile` to build the image. The Start Command field will be hidden in that case because the Dockerfile defines the container start.

