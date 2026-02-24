const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_ROOT = path.resolve(__dirname, '..');

const PORT = process.env.PORT || 3000;

function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function sendWithSendGrid({ to, from, subject, text }) {
  if (!process.env.SENDGRID_API_KEY) return Promise.reject(new Error('SENDGRID_API_KEY not set'));
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const msg = { to, from, subject, text };
  return sgMail.send(msg);
}

app.post('/contact', async (req, res) => {
  const { name, email, phone, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Campos obrigatórios ausentes' });

  const transporter = createTransporter();
  const to = process.env.TO_EMAIL || process.env.SMTP_USER;
  const from = process.env.FROM_EMAIL || (process.env.SMTP_USER || 'no-reply@jeautomoveis.com');
  const subject = `Contato via site - ${name}`;
  const text = `Nome: ${name}\nEmail: ${email}\nTelefone: ${phone || ''}\n\nMensagem:\n${message}`;

  try {
    // Prefer SendGrid if API key provided
    if (process.env.SENDGRID_API_KEY) {
      const info = await sendWithSendGrid({ to, from, subject, text });
      return res.json({ ok: true, provider: 'sendgrid', info });
    }

    if (!transporter) {
      // No SMTP configured — return success with payload so user can configure later
      return res.json({ ok: true, info: 'SMTP não configurado; mensagem recebida no backend apenas.' });
    }

    const mailOptions = { from, to, subject, text };
    const info = await transporter.sendMail(mailOptions);
    res.json({ ok: true, provider: 'smtp', info });
  } catch (err) {
    console.error('Erro enviando email:', err);
    res.status(500).json({ error: 'Falha ao enviar email' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, service: 'JE Automoveis Backend' }));

app.use(express.static(FRONTEND_ROOT));

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/contact') || req.path.startsWith('/health')) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  return res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
