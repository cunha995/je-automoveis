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
const SELLERS_FILE = path.join(DATA_DIR, 'sellers.json');
const BANNERS_FILE = path.join(DATA_DIR, 'banners.json');
const UPLOADS_DIR = path.join(FRONTEND_ROOT, 'uploads');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'je2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Je2026';
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
  if (!fs.existsSync(SELLERS_FILE)) {
    fs.writeFileSync(SELLERS_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(BANNERS_FILE)) {
    fs.writeFileSync(BANNERS_FILE, '[]', 'utf-8');
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
  return readCollection(VEHICLES_FILE);
}

function writeVehicles(vehicles) {
  writeCollection(VEHICLES_FILE, vehicles);
}

function readSellers() {
  return readCollection(SELLERS_FILE);
}

function writeSellers(sellers) {
  writeCollection(SELLERS_FILE, sellers);
}

function readBanners() {
  return readCollection(BANNERS_FILE);
}

function writeBanners(banners) {
  writeCollection(BANNERS_FILE, banners);
}

function readCollection(filePath) {
  ensureStorage();
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCollection(filePath, values) {
  ensureStorage();
  fs.writeFileSync(filePath, JSON.stringify(values, null, 2), 'utf-8');
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
  const vehicles = readVehicles().map((vehicle) => ({
    ...vehicle,
    sold: vehicle.sold === true || /vendid/i.test(String(vehicle.status || '')),
  }));
  res.json({ ok: true, vehicles });
});

app.get('/api/sellers', (_req, res) => {
  const sellers = readSellers();
  res.json({ ok: true, sellers });
});

app.get('/api/banners', (_req, res) => {
  const banners = readBanners()
    .filter((banner) => banner.isActive !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  res.json({ ok: true, banners });
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
    usingDefaultPassword: ADMIN_PASSWORD === 'Je2026',
  });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = getBearerToken(req);
  if (token) adminSessions.delete(token);
  return res.json({ ok: true });
});

app.get('/api/admin/vehicles', requireAdmin, (_req, res) => {
  const vehicles = readVehicles().map((vehicle) => ({
    ...vehicle,
    sold: vehicle.sold === true || /vendid/i.test(String(vehicle.status || '')),
  }));
  return res.json({ ok: true, vehicles });
});

app.get('/api/admin/sellers', requireAdmin, (_req, res) => {
  const sellers = readSellers();
  return res.json({ ok: true, sellers });
});

app.get('/api/admin/banners', requireAdmin, (_req, res) => {
  const banners = readBanners().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return res.json({ ok: true, banners });
});

app.post('/api/admin/vehicles', requireAdmin, upload.single('photo'), async (req, res) => {
  const { model, year, km, fuel, price, status, transmission, sold } = req.body || {};
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

  const isSold = String(sold || 'false') === 'true';

  const vehicle = {
    id: crypto.randomUUID(),
    model: String(model).trim(),
    year: Number(year),
    km: String(km || '').trim(),
    fuel: String(fuel || '').trim() || 'Flex',
    transmission: String(transmission || '').trim() || 'Manual',
    price: Number(price),
    status: isSold ? 'Vendido' : (String(status || 'Disponível').trim() || 'Disponível'),
    sold: isSold,
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
  const { model, year, km, fuel, price, status, transmission, sold } = req.body || {};

  const incomingSold = sold !== undefined ? String(sold) === 'true' : undefined;
  const soldValue = incomingSold !== undefined
    ? incomingSold
    : (current.sold === true || /vendid/i.test(String(current.status || '')));

  const updated = {
    ...current,
    model: model !== undefined ? String(model).trim() : current.model,
    year: year !== undefined ? Number(year) : current.year,
    km: km !== undefined ? String(km).trim() : current.km,
    fuel: fuel !== undefined ? String(fuel).trim() : current.fuel,
    transmission: transmission !== undefined ? String(transmission).trim() : current.transmission,
    price: price !== undefined ? Number(price) : current.price,
    status: soldValue
      ? 'Vendido'
      : (status !== undefined ? String(status).trim() : (current.status || 'Disponível')),
    sold: soldValue,
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

app.post('/api/admin/sellers', requireAdmin, upload.single('photo'), async (req, res) => {
  const { name, role, phone, whatsapp, status, bio } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Campo obrigatório: name' });

  let imageData = null;
  try {
    imageData = await persistImage(req.file);
  } catch (err) {
    console.error('Erro ao salvar foto do vendedor:', err);
    return res.status(500).json({ error: 'Falha ao salvar foto do vendedor' });
  }

  const seller = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    role: String(role || '').trim() || 'Consultor de vendas',
    phone: String(phone || '').trim(),
    whatsapp: String(whatsapp || '').trim(),
    status: String(status || '').trim() || 'Online',
    bio: String(bio || '').trim(),
    image: imageData ? imageData.image : '',
    imageStorage: imageData ? imageData.imageStorage : 'none',
    imagePublicId: imageData ? imageData.imagePublicId : null,
    createdAt: new Date().toISOString(),
  };

  const sellers = readSellers();
  sellers.unshift(seller);
  writeSellers(sellers);
  return res.status(201).json({ ok: true, seller });
});

app.put('/api/admin/sellers/:id', requireAdmin, upload.single('photo'), async (req, res) => {
  const sellers = readSellers();
  const index = sellers.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Vendedor não encontrado' });

  const current = sellers[index];
  const { name, role, phone, whatsapp, status, bio } = req.body || {};
  const updated = {
    ...current,
    name: name !== undefined ? String(name).trim() : current.name,
    role: role !== undefined ? String(role).trim() : current.role,
    phone: phone !== undefined ? String(phone).trim() : current.phone,
    whatsapp: whatsapp !== undefined ? String(whatsapp).trim() : current.whatsapp,
    status: status !== undefined ? String(status).trim() : current.status,
    bio: bio !== undefined ? String(bio).trim() : current.bio,
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
      console.error('Erro ao atualizar foto do vendedor:', err);
      return res.status(500).json({ error: 'Falha ao atualizar foto do vendedor' });
    }
  }

  sellers[index] = updated;
  writeSellers(sellers);
  return res.json({ ok: true, seller: updated });
});

app.delete('/api/admin/sellers/:id', requireAdmin, async (req, res) => {
  const sellers = readSellers();
  const index = sellers.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Vendedor não encontrado' });

  const [removed] = sellers.splice(index, 1);
  writeSellers(sellers);

  try {
    await removeStoredImage(removed);
  } catch (err) {
    console.warn('Falha ao remover foto do vendedor:', err.message);
  }

  return res.json({ ok: true });
});

app.post('/api/admin/banners', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, subtitle, ctaText, ctaLink, order, isActive } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Campo obrigatório: title' });

  let imageData = null;
  try {
    imageData = await persistImage(req.file);
  } catch (err) {
    console.error('Erro ao salvar imagem do banner:', err);
    return res.status(500).json({ error: 'Falha ao salvar imagem do banner' });
  }

  const banner = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    subtitle: String(subtitle || '').trim(),
    ctaText: String(ctaText || '').trim() || 'Saiba mais',
    ctaLink: String(ctaLink || '').trim() || '#estoque',
    order: Number(order || 0),
    isActive: String(isActive || 'true') !== 'false',
    image: imageData ? imageData.image : '',
    imageStorage: imageData ? imageData.imageStorage : 'none',
    imagePublicId: imageData ? imageData.imagePublicId : null,
    createdAt: new Date().toISOString(),
  };

  const banners = readBanners();
  banners.unshift(banner);
  writeBanners(banners);
  return res.status(201).json({ ok: true, banner });
});

app.put('/api/admin/banners/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const banners = readBanners();
  const index = banners.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Banner não encontrado' });

  const current = banners[index];
  const { title, subtitle, ctaText, ctaLink, order, isActive } = req.body || {};

  const updated = {
    ...current,
    title: title !== undefined ? String(title).trim() : current.title,
    subtitle: subtitle !== undefined ? String(subtitle).trim() : current.subtitle,
    ctaText: ctaText !== undefined ? String(ctaText).trim() : current.ctaText,
    ctaLink: ctaLink !== undefined ? String(ctaLink).trim() : current.ctaLink,
    order: order !== undefined ? Number(order) : current.order,
    isActive: isActive !== undefined ? String(isActive) !== 'false' : current.isActive,
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
      console.error('Erro ao atualizar imagem do banner:', err);
      return res.status(500).json({ error: 'Falha ao atualizar imagem do banner' });
    }
  }

  banners[index] = updated;
  writeBanners(banners);
  return res.json({ ok: true, banner: updated });
});

app.delete('/api/admin/banners/:id', requireAdmin, async (req, res) => {
  const banners = readBanners();
  const index = banners.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Banner não encontrado' });

  const [removed] = banners.splice(index, 1);
  writeBanners(banners);

  try {
    await removeStoredImage(removed);
  } catch (err) {
    console.warn('Falha ao remover imagem do banner:', err.message);
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
