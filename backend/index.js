const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const VEHICLES_FILE = path.join(DATA_DIR, 'vehicles.json');
const UPLOADS_DIR = path.join(FRONTEND_ROOT, 'uploads');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const adminSessions = new Map();

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'je-automoveis';

const hasCloudinaryConfig =
  !!process.env.CLOUDINARY_URL ||
  (!!CLOUDINARY_CLOUD_NAME && !!CLOUDINARY_API_KEY && !!CLOUDINARY_API_SECRET);

const PORT = process.env.PORT || 3000;

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(VEHICLES_FILE)) {
    fs.writeFileSync(VEHICLES_FILE, '[]', 'utf-8');
  }
}

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function readVehicles() {
  ensureStorage();
  const raw = fs.readFileSync(VEHICLES_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeVehicles(vehicles) {
  ensureStorage();
  fs.writeFileSync(VEHICLES_FILE, JSON.stringify(vehicles, null, 2), 'utf-8');
}

async function uploadToCloudinary(file) {
  if (!file || !file.buffer) return null;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

function saveLocalImage(file) {
  if (!file || !file.buffer) return null;
  ensureStorage();
  const extFromOriginal = path.extname(file.originalname || '').toLowerCase();
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extFromOriginal) ? extFromOriginal : '.jpg';
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
  const outputPath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(outputPath, file.buffer);
  return {
    image: `/uploads/${fileName}`,
    imageStorage: 'local',
    imagePublicId: null,
  };
}

async function persistImage(file) {
  if (!file) return null;

  if (hasCloudinaryConfig) {
    const result = await uploadToCloudinary(file);
    return {
      image: result.secure_url,
      imageStorage: 'cloudinary',
      imagePublicId: result.public_id,
    };
  }

  return saveLocalImage(file);
}

async function removeStoredImage(vehicle) {
  if (!vehicle || !vehicle.image) return;

  const storage = vehicle.imageStorage || (String(vehicle.image).startsWith('/uploads/') ? 'local' : 'external');

  if (storage === 'cloudinary' && vehicle.imagePublicId && hasCloudinaryConfig) {
    try {
      await cloudinary.uploader.destroy(vehicle.imagePublicId, { resource_type: 'image' });
    } catch (err) {
      console.warn('Falha ao remover imagem no Cloudinary:', err.message);
    }
    return;
  }

  if (storage === 'local' && String(vehicle.image).startsWith('/uploads/')) {
    const imgPath = path.join(FRONTEND_ROOT, vehicle.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
}

function removeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt <= now) adminSessions.delete(token);
  }
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function requireAdmin(req, res, next) {
  removeExpiredSessions();
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  const session = adminSessions.get(token);
  if (!session) return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  req.admin = session;
  return next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if ((file.mimetype || '').startsWith('image/')) return cb(null, true);
    return cb(new Error('Arquivo deve ser uma imagem'));
  },
});

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

app.get('/api/vehicles', (_req, res) => {
  const vehicles = readVehicles();
  res.json({ ok: true, vehicles });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = createToken();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  adminSessions.set(token, { username, expiresAt });

  return res.json({
    ok: true,
    token,
    expiresAt,
    usingDefaultPassword: ADMIN_PASSWORD === 'admin123',
  });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = getBearerToken(req);
  if (token) adminSessions.delete(token);
  return res.json({ ok: true });
});

app.get('/api/admin/vehicles', requireAdmin, (_req, res) => {
  const vehicles = readVehicles();
  return res.json({ ok: true, vehicles });
});

app.post('/api/admin/vehicles', requireAdmin, upload.single('photo'), async (req, res) => {
  const { model, year, km, fuel, price, status, transmission } = req.body || {};
  if (!model || !year || !price) {
    return res.status(400).json({ error: 'Campos obrigatórios: model, year, price' });
  }

  let imageData = null;
  try {
    imageData = await persistImage(req.file);
  } catch (err) {
    console.error('Erro ao salvar imagem:', err);
    return res.status(500).json({ error: 'Falha ao salvar imagem do veículo' });
  }

  const vehicle = {
    id: crypto.randomUUID(),
    model: String(model).trim(),
    year: Number(year),
    km: String(km || '').trim(),
    fuel: String(fuel || '').trim() || 'Flex',
    transmission: String(transmission || '').trim() || 'Manual',
    price: Number(price),
    status: String(status || 'Disponível').trim(),
    image: imageData ? imageData.image : '',
    imageStorage: imageData ? imageData.imageStorage : 'none',
    imagePublicId: imageData ? imageData.imagePublicId : null,
    createdAt: new Date().toISOString(),
  };

  const vehicles = readVehicles();
  vehicles.unshift(vehicle);
  writeVehicles(vehicles);

  return res.status(201).json({ ok: true, vehicle });
});

app.put('/api/admin/vehicles/:id', requireAdmin, upload.single('photo'), async (req, res) => {
  const vehicles = readVehicles();
  const index = vehicles.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Veículo não encontrado' });

  const current = vehicles[index];
  const { model, year, km, fuel, price, status, transmission } = req.body || {};

  const updated = {
    ...current,
    model: model !== undefined ? String(model).trim() : current.model,
    year: year !== undefined ? Number(year) : current.year,
    km: km !== undefined ? String(km).trim() : current.km,
    fuel: fuel !== undefined ? String(fuel).trim() : current.fuel,
    transmission: transmission !== undefined ? String(transmission).trim() : current.transmission,
    price: price !== undefined ? Number(price) : current.price,
    status: status !== undefined ? String(status).trim() : current.status,
    updatedAt: new Date().toISOString(),
  };

  if (req.file) {
    try {
      await removeStoredImage(current);
      const imageData = await persistImage(req.file);
      updated.image = imageData ? imageData.image : current.image;
      updated.imageStorage = imageData ? imageData.imageStorage : current.imageStorage;
      updated.imagePublicId = imageData ? imageData.imagePublicId : current.imagePublicId;
    } catch (err) {
      console.error('Erro ao atualizar imagem:', err);
      return res.status(500).json({ error: 'Falha ao atualizar imagem do veículo' });
    }
  }

  vehicles[index] = updated;
  writeVehicles(vehicles);
  return res.json({ ok: true, vehicle: updated });
});

app.delete('/api/admin/vehicles/:id', requireAdmin, async (req, res) => {
  const vehicles = readVehicles();
  const index = vehicles.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Veículo não encontrado' });

  const [removed] = vehicles.splice(index, 1);
  writeVehicles(vehicles);

  try {
    await removeStoredImage(removed);
  } catch (err) {
    console.warn('Falha ao remover imagem ao excluir veículo:', err.message);
  }

  return res.json({ ok: true });
});

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

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, 'admin.html'));
});

app.use('/uploads', express.static(UPLOADS_DIR));

app.use(express.static(FRONTEND_ROOT));

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

app.get('*', (req, res) => {
  if (
    req.path.startsWith('/contact') ||
    req.path.startsWith('/health') ||
    req.path.startsWith('/api/') ||
    req.path.startsWith('/uploads/')
  ) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  return res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

ensureStorage();

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
