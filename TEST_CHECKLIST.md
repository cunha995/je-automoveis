**Teste End-to-End — Formulário de Contato**

- **Objetivo:** Validar envio de mensagens do frontend até o email receptor via backend no Render.
- **Pré-requisitos:** backend deployado em `https://je-automoveis.onrender.com`, `scripts.js` atualizado, `SENDGRID_API_KEY` configurada no Render e `TO_EMAIL` definido.

1. **Acessar Frontend:** abra a URL pública do site (ex.: `https://<seu-frontend>`) no navegador.
2. **Inspecionar Console:** abra DevTools → Console e Network para capturar erros JS/CORS.
3. **Preencher Formulário:** em `Contato`, preencha `Nome`, `Email`, `Telefone` e `Mensagem` com dados de teste.
4. **Enviar e observar resposta:** clique em enviar e verifique se aparece confirmação `Mensagem enviada com sucesso` (alert) e se o formulário é limpo.
5. **Teste via curl:** execute localmente:
```
curl -X POST https://je-automoveis.onrender.com/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@exemplo.com","phone":"0000","message":"Mensagem de teste"}'
```
   - **Esperado:** JSON `{ "ok": true, "provider": "sendgrid" , ... }` ou `{ "ok": true, "provider": "smtp" }`.
6. **Verificar logs no Render:** abra o painel do serviço → Logs e procure por entrada do POST `/contact`, erros de envio ou confirmações de `sendgrid`/`smtp`.
7. **Confirmar recebimento de email:** verifique a caixa `TO_EMAIL` por nova mensagem (ou verifique painel SendGrid > Activity se aplicável).
8. **Testar respostas de erro:** envie request sem `name` ou `email` e confirme retorno `400` com `error`.
9. **Verificar segurança e headers:** confirme que o site usa `https` e o backend responde com CORS habilitado (não bloqueará origem do frontend).
10. **Verificar healthcheck:** abra `https://je-automoveis.onrender.com/` e confirme `{ "ok": true }` no JSON.

Problemas comuns e ações:
- **CORS:** se erro, confirme que o frontend faz POST para `BACKEND_URL` e que o backend tem `app.use(cors())`.
- **Erro SendGrid (401/403):** verifique `SENDGRID_API_KEY` no Render e permissões da key.
- **SMTP errors:** confirme `SMTP_USER`/`SMTP_PASS` e que provedor autoriza envio (ex.: API key, app passwords).
- **Formulário não envia:** verifique Console por JS errors e Network para requisição POST.

Resultado final: marcar `Pass` se email recebido e backend retornou `{ ok: true }`; caso contrário registrar `Fail` com logs e passos para reprodução.
