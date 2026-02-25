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
const SITE_SETTINGS_FILE = path.join(DATA_DIR, 'site-settings.json');
const STORES_FILE = path.join(DATA_DIR, 'stores.json');
const STORES_DIR = path.join(DATA_DIR, 'stores');
const UPLOADS_DIR = path.join(FRONTEND_ROOT, 'uploads');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'je2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Je2026';
const MASTER_USERNAME = process.env.MASTER_USERNAME || 'master';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'Master2026';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const adminSessions = new Map();
const masterSessions = new Map();

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
  if (!fs.existsSync(STORES_DIR)) fs.mkdirSync(STORES_DIR, { recursive: true });
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
  if (!fs.existsSync(SITE_SETTINGS_FILE)) {
    fs.writeFileSync(SITE_SETTINGS_FILE, JSON.stringify(defaultSiteSettings(), null, 2), 'utf-8');
  }
  if (!fs.existsSync(STORES_FILE)) {
    fs.writeFileSync(STORES_FILE, '[]', 'utf-8');
  }
}

function seedDefaultMasterStore() {
  ensureStorage();

  const defaultStore = {
    id: 'store-je-automoveis',
    name: 'JE Automóveis',
    slug: 'je-automoveis',
    adminUsername: 'admin-je',
    adminPassword: 'JeLoja2026',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const stores = readStores();
  const existingIndex = stores.findIndex((item) => item.slug === defaultStore.slug);
  if (existingIndex < 0) {
    stores.unshift(defaultStore);
  } else {
    stores[existingIndex] = {
      ...stores[existingIndex],
      adminUsername: stores[existingIndex].adminUsername || defaultStore.adminUsername,
      adminPassword: stores[existingIndex].adminPassword || defaultStore.adminPassword,
    };
  }
  writeStores(stores);

  const files = storeFiles(defaultStore.slug);
  if (!fs.existsSync(files.storeDir)) fs.mkdirSync(files.storeDir, { recursive: true });
  if (!fs.existsSync(files.vehiclesFile)) fs.copyFileSync(VEHICLES_FILE, files.vehiclesFile);
  if (!fs.existsSync(files.sellersFile)) fs.copyFileSync(SELLERS_FILE, files.sellersFile);
  if (!fs.existsSync(files.bannersFile)) fs.copyFileSync(BANNERS_FILE, files.bannersFile);
  if (!fs.existsSync(files.settingsFile)) fs.copyFileSync(SITE_SETTINGS_FILE, files.settingsFile);
}

function slugifyStore(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
}

function normalizePublicBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

function storeFiles(slug) {
  const storeDir = path.join(STORES_DIR, slug);
  return {
    storeDir,
    vehiclesFile: path.join(storeDir, 'vehicles.json'),
    sellersFile: path.join(storeDir, 'sellers.json'),
    bannersFile: path.join(storeDir, 'banners.json'),
    settingsFile: path.join(storeDir, 'site-settings.json'),
  };
}

function ensureStoreData(slug, settingsOverride = {}) {
  ensureStorage();
  const files = storeFiles(slug);
  if (!fs.existsSync(files.storeDir)) fs.mkdirSync(files.storeDir, { recursive: true });
  if (!fs.existsSync(files.vehiclesFile)) fs.writeFileSync(files.vehiclesFile, '[]', 'utf-8');
  if (!fs.existsSync(files.sellersFile)) fs.writeFileSync(files.sellersFile, '[]', 'utf-8');
  if (!fs.existsSync(files.bannersFile)) fs.writeFileSync(files.bannersFile, '[]', 'utf-8');
  if (!fs.existsSync(files.settingsFile)) {
    fs.writeFileSync(files.settingsFile, JSON.stringify({ ...defaultSiteSettings(), ...settingsOverride }, null, 2), 'utf-8');
  }
  return files;
}

function readStores() {
  return readCollection(STORES_FILE);
}

function writeStores(stores) {
  writeCollection(STORES_FILE, stores);
}

function readStoreVehicles(slug) {
  const files = ensureStoreData(slug);
  return readCollection(files.vehiclesFile);
}

function writeStoreVehicles(slug, vehicles) {
  const files = ensureStoreData(slug);
  writeCollection(files.vehiclesFile, vehicles);
}

function readStoreSellers(slug) {
  const files = ensureStoreData(slug);
  return readCollection(files.sellersFile);
}

function writeStoreSellers(slug, sellers) {
  const files = ensureStoreData(slug);
  writeCollection(files.sellersFile, sellers);
}

function readStoreBanners(slug) {
  const files = ensureStoreData(slug);
  return readCollection(files.bannersFile);
}

function writeStoreBanners(slug, banners) {
  const files = ensureStoreData(slug);
  writeCollection(files.bannersFile, banners);
}

function readStoreSettings(slug) {
  const files = ensureStoreData(slug);
  const defaults = defaultSiteSettings();
  const raw = fs.readFileSync(files.settingsFile, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...(parsed || {}),
      aboutHighlights: Array.isArray(parsed?.aboutHighlights)
        ? parsed.aboutHighlights.filter((item) => String(item || '').trim())
        : defaults.aboutHighlights,
    };
  } catch {
    return defaults;
  }
}

function writeStoreSettings(slug, settings) {
  const files = ensureStoreData(slug);
  const current = readStoreSettings(slug);
  const next = {
    ...current,
    ...settings,
    aboutHighlights: Array.isArray(settings.aboutHighlights)
      ? settings.aboutHighlights.filter((item) => String(item || '').trim())
      : current.aboutHighlights,
  };
  fs.writeFileSync(files.settingsFile, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function scopeSlugFromSession(req) {
  return req?.admin?.storeSlug ? String(req.admin.storeSlug) : '';
}

function readVehiclesScoped(req) {
  const slug = scopeSlugFromSession(req);
  return slug ? readStoreVehicles(slug) : readVehicles();
}

function writeVehiclesScoped(req, vehicles) {
  const slug = scopeSlugFromSession(req);
  if (slug) return writeStoreVehicles(slug, vehicles);
  return writeVehicles(vehicles);
}

function readSellersScoped(req) {
  const slug = scopeSlugFromSession(req);
  return slug ? readStoreSellers(slug) : readSellers();
}

function writeSellersScoped(req, sellers) {
  const slug = scopeSlugFromSession(req);
  if (slug) return writeStoreSellers(slug, sellers);
  return writeSellers(sellers);
}

function readBannersScoped(req) {
  const slug = scopeSlugFromSession(req);
  return slug ? readStoreBanners(slug) : readBanners();
}

function writeBannersScoped(req, banners) {
  const slug = scopeSlugFromSession(req);
  if (slug) return writeStoreBanners(slug, banners);
  return writeBanners(banners);
}

function readSiteSettingsScoped(req) {
  const slug = scopeSlugFromSession(req);
  return slug ? readStoreSettings(slug) : readSiteSettings();
}

function writeSiteSettingsScoped(req, settings) {
  const slug = scopeSlugFromSession(req);
  return slug ? writeStoreSettings(slug, settings) : writeSiteSettings(settings);
}

function defaultSiteSettings() {
  return {
    aboutTitle: 'Sobre a JE Automóveis',
    aboutText: 'Atendimento familiar com foco em transparência para venda, troca e consignado de veículos.',
    aboutHighlights: [
      'Venda de veículos selecionados',
      'Troca com avaliação justa',
      'Consignado com suporte completo',
    ],
    storeAddress: 'Rua Exemplo, 123 — Sua Cidade',
    storePhone: '(00) 0 0000-0000',
    storeWhatsapp: '5500000000000',
    storeEmail: 'contato@jeautomoveis.com',
  };
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

function readSiteSettings() {
  ensureStorage();
  const defaults = defaultSiteSettings();
  const raw = fs.readFileSync(SITE_SETTINGS_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...(parsed || {}),
      aboutHighlights: Array.isArray(parsed?.aboutHighlights)
        ? parsed.aboutHighlights.filter((item) => String(item || '').trim())
        : defaults.aboutHighlights,
    };
  } catch {
    return defaults;
  }
}

function writeSiteSettings(settings) {
  ensureStorage();
  const current = readSiteSettings();
  const next = {
    ...current,
    ...settings,
    aboutHighlights: Array.isArray(settings.aboutHighlights)
      ? settings.aboutHighlights.filter((item) => String(item || '').trim())
      : current.aboutHighlights,
  };
  fs.writeFileSync(SITE_SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
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

function parseYearValue(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1900 || parsed > 2100) return null;
  return parsed;
}

function parsePriceValue(value) {
  const normalized = String(value ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
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

function detectMediaType(file) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  if (mimetype.startsWith('video/')) return 'video';
  return 'image';
}

async function uploadToCloudinaryMedia(file, resourceType = detectMediaType(file)) {
  if (!file || !file.buffer) return null;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        resource_type: resourceType,
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

function saveLocalMedia(file, mediaType = detectMediaType(file)) {
  if (!file || !file.buffer) return null;
  ensureStorage();

  const extFromOriginal = path.extname(file.originalname || '').toLowerCase();
  const allowedImageExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const allowedVideoExt = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];
  const safeExt = mediaType === 'video'
    ? (allowedVideoExt.includes(extFromOriginal) ? extFromOriginal : '.mp4')
    : (allowedImageExt.includes(extFromOriginal) ? extFromOriginal : '.jpg');

  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
  const outputPath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(outputPath, file.buffer);

  return {
    url: `/uploads/${fileName}`,
    storage: 'local',
    publicId: null,
    mediaType,
  };
}

function normalizeVehicleMedia(vehicle) {
  const fallbackStorage = vehicle.imageStorage || (String(vehicle.image || '').startsWith('/uploads/') ? 'local' : 'external');
  const fromLegacyImage = vehicle.image
    ? [{
      url: vehicle.image,
      storage: fallbackStorage,
      publicId: vehicle.imagePublicId || null,
      mediaType: 'image',
    }]
    : [];

  const normalizedMedia = (Array.isArray(vehicle.media) && vehicle.media.length ? vehicle.media : fromLegacyImage)
    .map((item) => ({
      url: String(item?.url || item?.image || '').trim(),
      storage: item?.storage || item?.imageStorage || (String(item?.url || item?.image || '').startsWith('/uploads/') ? 'local' : 'external'),
      publicId: item?.publicId || item?.imagePublicId || null,
      mediaType: item?.mediaType === 'video' ? 'video' : 'image',
    }))
    .filter((item) => item.url);

  const firstImage = normalizedMedia.find((item) => item.mediaType === 'image') || normalizedMedia[0] || null;

  return {
    ...vehicle,
    media: normalizedMedia,
    image: firstImage ? firstImage.url : '',
    imageStorage: firstImage ? firstImage.storage : 'none',
    imagePublicId: firstImage ? firstImage.publicId : null,
  };
}

function getVehicleMediaFiles(req) {
  const files = req.files || {};
  const photos = [
    ...(Array.isArray(files.photos) ? files.photos : []),
    ...(Array.isArray(files.photo) ? files.photo : []),
  ];
  const videos = Array.isArray(files.videos) ? files.videos : [];
  return { photos, videos };
}

async function persistVehicleMedia(req) {
  const { photos, videos } = getVehicleMediaFiles(req);
  const persistedPhotos = await Promise.all(photos.map((file) => persistUploadedFile(file, 'image')));
  const persistedVideos = await Promise.all(videos.map((file) => persistUploadedFile(file, 'video')));
  return [...persistedPhotos, ...persistedVideos].filter(Boolean);
}

async function removeStoredMedia(media) {
  if (!media || !media.url) return;

  const storage = media.storage || (String(media.url).startsWith('/uploads/') ? 'local' : 'external');

  if (storage === 'cloudinary' && media.publicId && hasCloudinaryConfig) {
    try {
      await cloudinary.uploader.destroy(media.publicId, { resource_type: media.mediaType === 'video' ? 'video' : 'image' });
    } catch (err) {
      console.warn('Falha ao remover mídia no Cloudinary:', err.message);
    }
    return;
  }

  if (storage === 'local' && String(media.url).startsWith('/uploads/')) {
    const mediaPath = path.join(FRONTEND_ROOT, media.url);
    if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
  }
}

async function removeVehicleStoredMedia(vehicle) {
  const normalized = normalizeVehicleMedia(vehicle);
  for (const media of normalized.media) {
    await removeStoredMedia(media);
  }
}

async function persistUploadedFile(file, forcedMediaType) {
  if (!file) return null;

  const mediaType = forcedMediaType || detectMediaType(file);

  if (hasCloudinaryConfig) {
    const result = await uploadToCloudinaryMedia(file, mediaType);
    return {
      url: result.secure_url,
      storage: 'cloudinary',
      publicId: result.public_id,
      mediaType,
    };
  }

  return saveLocalMedia(file, mediaType);
}

async function persistImage(file) {
  if (!file) return null;

  const media = await persistUploadedFile(file, 'image');
  return media
    ? {
      image: media.url,
      imageStorage: media.storage,
      imagePublicId: media.publicId,
    }
    : null;
}

async function removeStoredImage(vehicle) {
  if (!vehicle || !vehicle.image) return;

  await removeStoredMedia({
    url: vehicle.image,
    storage: vehicle.imageStorage,
    publicId: vehicle.imagePublicId,
    mediaType: 'image',
  });
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

function requireMaster(req, res, next) {
  removeExpiredSessions();
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  const session = masterSessions.get(token);
  if (!session) return res.status(401).json({ error: 'Sessão master inválida ou expirada' });
  req.master = session;
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

const vehicleUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const type = String(file.mimetype || '');
    if (type.startsWith('image/') || type.startsWith('video/')) return cb(null, true);
    return cb(new Error('Arquivo deve ser imagem ou vídeo'));
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
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const vehicles = readVehicles().map((vehicle) => {
    const normalized = normalizeVehicleMedia(vehicle);
    return {
      ...normalized,
      sold: normalized.sold === true || /vendid/i.test(String(normalized.status || '')),
    };
  });
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

app.get('/api/site-settings', (_req, res) => {
  const settings = readSiteSettings();
  res.json({ ok: true, settings });
});

app.get('/api/public/:slug/vehicles', (req, res) => {
  const slug = slugifyStore(req.params.slug);
  if (!slug) return res.status(400).json({ error: 'Slug inválido' });

  const store = readStores().find((item) => item.slug === slug);
  if (!store) return res.status(404).json({ error: 'Loja não encontrada' });

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const vehicles = readStoreVehicles(slug).map((vehicle) => {
    const normalized = normalizeVehicleMedia(vehicle);
    return {
      ...normalized,
      sold: normalized.sold === true || /vendid/i.test(String(normalized.status || '')),
    };
  });

  return res.json({ ok: true, vehicles, store });
});

app.get('/api/public/:slug/sellers', (req, res) => {
  const slug = slugifyStore(req.params.slug);
  if (!slug) return res.status(400).json({ error: 'Slug inválido' });
  const store = readStores().find((item) => item.slug === slug);
  if (!store) return res.status(404).json({ error: 'Loja não encontrada' });

  const sellers = readStoreSellers(slug);
  return res.json({ ok: true, sellers, store });
});

app.get('/api/public/:slug/banners', (req, res) => {
  const slug = slugifyStore(req.params.slug);
  if (!slug) return res.status(400).json({ error: 'Slug inválido' });
  const store = readStores().find((item) => item.slug === slug);
  if (!store) return res.status(404).json({ error: 'Loja não encontrada' });

  const banners = readStoreBanners(slug)
    .filter((banner) => banner.isActive !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  return res.json({ ok: true, banners, store });
});

app.get('/api/public/:slug/site-settings', (req, res) => {
  const slug = slugifyStore(req.params.slug);
  if (!slug) return res.status(400).json({ error: 'Slug inválido' });
  const store = readStores().find((item) => item.slug === slug);
  if (!store) return res.status(404).json({ error: 'Loja não encontrada' });

  const settings = readStoreSettings(slug);
  return res.json({ ok: true, settings, store });
});

app.post('/api/master/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== MASTER_USERNAME || password !== MASTER_PASSWORD) {
    return res.status(401).json({ error: 'Credenciais master inválidas' });
  }

  const token = createToken();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  masterSessions.set(token, { username, expiresAt });

  return res.json({ ok: true, token, expiresAt });
});

app.post('/api/master/logout', requireMaster, (req, res) => {
  const token = getBearerToken(req);
  if (token) masterSessions.delete(token);
  return res.json({ ok: true });
});

app.get('/api/master/stores', requireMaster, (_req, res) => {
  const stores = readStores().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return res.json({ ok: true, stores });
});

app.post('/api/master/stores', requireMaster, (req, res) => {
  const {
    name,
    slug,
    storePhone,
    storeWhatsapp,
    storeEmail,
    storeAddress,
    aboutText,
    adminUsername,
    adminPassword,
    monthlyFee,
    billingNotes,
    publicBaseUrl,
  } = req.body || {};
  const safeName = String(name || '').trim();
  const safeSlug = slugifyStore(slug || safeName);

  if (!safeName) return res.status(400).json({ error: 'Nome da loja é obrigatório' });
  if (!safeSlug) return res.status(400).json({ error: 'Slug inválido para a loja' });

  const safeAdminUser = String(adminUsername || '').trim();
  const safeAdminPass = String(adminPassword || '').trim();
  if (!safeAdminUser || !safeAdminPass) {
    return res.status(400).json({ error: 'Usuário e senha admin da loja são obrigatórios' });
  }

  if (safeAdminPass.length < 6) {
    return res.status(400).json({ error: 'A senha do admin da loja deve ter pelo menos 6 caracteres' });
  }

  const parsedMonthlyFee = parsePriceValue(monthlyFee);
  if (!parsedMonthlyFee) {
    return res.status(400).json({ error: 'Mensalidade inválida. Informe um valor maior que zero.' });
  }

  const safePublicBaseUrl = normalizePublicBaseUrl(publicBaseUrl);
  if (String(publicBaseUrl || '').trim() && !safePublicBaseUrl) {
    return res.status(400).json({ error: 'URL base pública inválida. Use um domínio válido (ex.: loja-cliente.com).' });
  }

  const stores = readStores();
  if (stores.some((item) => item.slug === safeSlug)) {
    return res.status(409).json({ error: 'Já existe uma loja com este slug' });
  }

  const store = {
    id: crypto.randomUUID(),
    name: safeName,
    slug: safeSlug,
    adminUsername: safeAdminUser,
    adminPassword: safeAdminPass,
    monthlyFee: parsedMonthlyFee,
    billingNotes: String(billingNotes || '').trim(),
    billingUpdatedAt: new Date().toISOString(),
    publicBaseUrl: safePublicBaseUrl,
    createdAt: new Date().toISOString(),
  };

  stores.unshift(store);
  writeStores(stores);

  ensureStoreData(safeSlug, {
    aboutTitle: `Sobre a ${safeName}`,
    aboutText: String(aboutText || '').trim() || defaultSiteSettings().aboutText,
    storePhone: String(storePhone || '').trim() || defaultSiteSettings().storePhone,
    storeWhatsapp: String(storeWhatsapp || '').trim() || defaultSiteSettings().storeWhatsapp,
    storeEmail: String(storeEmail || '').trim() || defaultSiteSettings().storeEmail,
    storeAddress: String(storeAddress || '').trim() || defaultSiteSettings().storeAddress,
  });

  return res.status(201).json({
    ok: true,
    store,
    publicUrl: `/loja/${safeSlug}`,
    adminUrl: `/admin/${safeSlug}`,
  });
});

app.put('/api/master/stores/:slug/public-base-url', requireMaster, (req, res) => {
  const safeSlug = slugifyStore(req.params.slug);
  if (!safeSlug) return res.status(400).json({ error: 'Slug inválido' });

  const safePublicBaseUrl = normalizePublicBaseUrl(req.body?.publicBaseUrl);
  if (String(req.body?.publicBaseUrl || '').trim() && !safePublicBaseUrl) {
    return res.status(400).json({ error: 'URL base pública inválida. Use um domínio válido (ex.: loja-cliente.com).' });
  }

  const stores = readStores();
  const storeIndex = stores.findIndex((item) => item.slug === safeSlug);
  if (storeIndex < 0) {
    return res.status(404).json({ error: 'Loja não encontrada' });
  }

  stores[storeIndex] = {
    ...stores[storeIndex],
    publicBaseUrl: safePublicBaseUrl,
  };

  writeStores(stores);
  return res.json({ ok: true, store: stores[storeIndex] });
});

app.put('/api/master/stores/:slug/billing', requireMaster, (req, res) => {
  const safeSlug = slugifyStore(req.params.slug);
  if (!safeSlug) return res.status(400).json({ error: 'Slug inválido' });

  const { monthlyFee, billingNotes } = req.body || {};
  const parsedMonthlyFee = parsePriceValue(monthlyFee);
  if (!parsedMonthlyFee) {
    return res.status(400).json({ error: 'Mensalidade inválida. Informe um valor maior que zero.' });
  }

  const stores = readStores();
  const storeIndex = stores.findIndex((item) => item.slug === safeSlug);
  if (storeIndex < 0) {
    return res.status(404).json({ error: 'Loja não encontrada' });
  }

  stores[storeIndex] = {
    ...stores[storeIndex],
    monthlyFee: parsedMonthlyFee,
    billingNotes: String(billingNotes || '').trim(),
    billingUpdatedAt: new Date().toISOString(),
  };

  writeStores(stores);
  return res.json({ ok: true, store: stores[storeIndex] });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password, storeSlug } = req.body || {};

  let sessionStoreSlug = '';
  if (storeSlug) {
    const safeSlug = slugifyStore(storeSlug);
    const store = readStores().find((item) => item.slug === safeSlug);
    if (!store) return res.status(401).json({ error: 'Loja não encontrada para este login' });

    const expectedUser = store.adminUsername || `admin-${safeSlug}`;
    const expectedPass = store.adminPassword || 'Loja2026';
    if (username !== expectedUser || password !== expectedPass) {
      return res.status(401).json({ error: 'Credenciais da loja inválidas' });
    }
    sessionStoreSlug = safeSlug;
  } else if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = createToken();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  adminSessions.set(token, { username, expiresAt, storeSlug: sessionStoreSlug });

  return res.json({
    ok: true,
    token,
    expiresAt,
    storeSlug: sessionStoreSlug,
    isStoreAdmin: !!sessionStoreSlug,
    usingDefaultPassword: ADMIN_PASSWORD === 'Je2026',
  });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = getBearerToken(req);
  if (token) adminSessions.delete(token);
  return res.json({ ok: true });
});

app.get('/api/admin/vehicles', requireAdmin, (_req, res) => {
  const vehicles = readVehiclesScoped(_req).map((vehicle) => {
    const normalized = normalizeVehicleMedia(vehicle);
    return {
      ...normalized,
      sold: normalized.sold === true || /vendid/i.test(String(normalized.status || '')),
    };
  });
  return res.json({ ok: true, vehicles });
});

app.get('/api/admin/sellers', requireAdmin, (_req, res) => {
  const sellers = readSellersScoped(_req);
  return res.json({ ok: true, sellers });
});

app.get('/api/admin/banners', requireAdmin, (_req, res) => {
  const banners = readBannersScoped(_req).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return res.json({ ok: true, banners });
});

app.get('/api/admin/site-settings', requireAdmin, (_req, res) => {
  const settings = readSiteSettingsScoped(_req);
  return res.json({ ok: true, settings });
});

app.put('/api/admin/site-settings', requireAdmin, (req, res) => {
  const {
    aboutTitle,
    aboutText,
    aboutHighlights,
    storeAddress,
    storePhone,
    storeWhatsapp,
    storeEmail,
  } = req.body || {};

  const normalizedHighlights = Array.isArray(aboutHighlights)
    ? aboutHighlights
    : String(aboutHighlights || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

  const settings = writeSiteSettingsScoped(req, {
    aboutTitle: aboutTitle !== undefined ? String(aboutTitle).trim() : undefined,
    aboutText: aboutText !== undefined ? String(aboutText).trim() : undefined,
    aboutHighlights: normalizedHighlights,
    storeAddress: storeAddress !== undefined ? String(storeAddress).trim() : undefined,
    storePhone: storePhone !== undefined ? String(storePhone).trim() : undefined,
    storeWhatsapp: storeWhatsapp !== undefined ? String(storeWhatsapp).trim() : undefined,
    storeEmail: storeEmail !== undefined ? String(storeEmail).trim() : undefined,
  });

  return res.json({ ok: true, settings });
});

app.put('/api/admin/change-password', requireAdmin, (req, res) => {
  const storeSlug = scopeSlugFromSession(req);
  if (!storeSlug) {
    return res.status(403).json({ error: 'A alteração de senha está disponível apenas para admin de loja.' });
  }

  const { currentPassword, newPassword } = req.body || {};
  const safeCurrentPassword = String(currentPassword || '').trim();
  const safeNewPassword = String(newPassword || '').trim();

  if (!safeCurrentPassword || !safeNewPassword) {
    return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  }

  if (safeNewPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  const stores = readStores();
  const storeIndex = stores.findIndex((item) => item.slug === storeSlug);
  if (storeIndex < 0) {
    return res.status(404).json({ error: 'Loja não encontrada.' });
  }

  const store = stores[storeIndex];
  const expectedPass = String(store.adminPassword || 'Loja2026');
  if (safeCurrentPassword !== expectedPass) {
    return res.status(401).json({ error: 'Senha atual inválida.' });
  }

  if (safeCurrentPassword === safeNewPassword) {
    return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual.' });
  }

  stores[storeIndex] = {
    ...store,
    adminPassword: safeNewPassword,
  };
  writeStores(stores);

  const currentToken = getBearerToken(req);
  for (const [token, session] of adminSessions.entries()) {
    if (token !== currentToken && session?.storeSlug === storeSlug) {
      adminSessions.delete(token);
    }
  }

  return res.json({ ok: true, message: 'Senha alterada com sucesso.' });
});

app.post('/api/admin/vehicles', requireAdmin, vehicleUpload.fields([
  { name: 'photos', maxCount: 12 },
  { name: 'videos', maxCount: 4 },
  { name: 'photo', maxCount: 1 },
]), async (req, res) => {
  const { model, year, km, fuel, price, status, transmission, sold } = req.body || {};
  if (!model || !year || !price) {
    return res.status(400).json({ error: 'Campos obrigatórios: model, year, price' });
  }

  const parsedYear = parseYearValue(year);
  if (!parsedYear) {
    return res.status(400).json({ error: 'Ano inválido. Use 4 dígitos entre 1900 e 2100.' });
  }

  const parsedPrice = parsePriceValue(price);
  if (!parsedPrice) {
    return res.status(400).json({ error: 'Preço inválido. Informe um valor maior que zero.' });
  }

  let media = [];
  try {
    media = await persistVehicleMedia(req);
  } catch (err) {
    console.error('Erro ao salvar mídia:', err);
    return res.status(500).json({ error: 'Falha ao salvar mídias do veículo' });
  }

  const isSold = String(sold || 'false') === 'true';

  const firstImage = media.find((item) => item.mediaType === 'image') || media[0] || null;

  const vehicle = {
    id: crypto.randomUUID(),
    model: String(model).trim(),
    year: parsedYear,
    km: String(km || '').trim(),
    fuel: String(fuel || '').trim() || 'Flex',
    transmission: String(transmission || '').trim() || 'Manual',
    price: parsedPrice,
    status: isSold ? 'Vendido' : (String(status || 'Disponível').trim() || 'Disponível'),
    sold: isSold,
    image: firstImage ? firstImage.url : '',
    imageStorage: firstImage ? firstImage.storage : 'none',
    imagePublicId: firstImage ? firstImage.publicId : null,
    media,
    createdAt: new Date().toISOString(),
  };

  const vehicles = readVehiclesScoped(req);
  vehicles.unshift(vehicle);
  writeVehiclesScoped(req, vehicles);

  return res.status(201).json({ ok: true, vehicle });
});

app.put('/api/admin/vehicles/:id', requireAdmin, vehicleUpload.fields([
  { name: 'photos', maxCount: 12 },
  { name: 'videos', maxCount: 4 },
  { name: 'photo', maxCount: 1 },
]), async (req, res) => {
  const vehicles = readVehiclesScoped(req);
  const index = vehicles.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Veículo não encontrado' });

  const current = vehicles[index];
  const { model, year, km, fuel, price, status, transmission, sold } = req.body || {};

  const incomingSold = sold !== undefined ? String(sold) === 'true' : undefined;
  const soldValue = incomingSold !== undefined
    ? incomingSold
    : (current.sold === true || /vendid/i.test(String(current.status || '')));

  const parsedYear = year !== undefined ? parseYearValue(year) : current.year;
  if (year !== undefined && !parsedYear) {
    return res.status(400).json({ error: 'Ano inválido. Use 4 dígitos entre 1900 e 2100.' });
  }

  const parsedPrice = price !== undefined ? parsePriceValue(price) : current.price;
  if (price !== undefined && !parsedPrice) {
    return res.status(400).json({ error: 'Preço inválido. Informe um valor maior que zero.' });
  }

  const updated = {
    ...current,
    model: model !== undefined ? String(model).trim() : current.model,
    year: parsedYear,
    km: km !== undefined ? String(km).trim() : current.km,
    fuel: fuel !== undefined ? String(fuel).trim() : current.fuel,
    transmission: transmission !== undefined ? String(transmission).trim() : current.transmission,
    price: parsedPrice,
    status: soldValue
      ? 'Vendido'
      : (status !== undefined ? String(status).trim() : (current.status || 'Disponível')),
    sold: soldValue,
    updatedAt: new Date().toISOString(),
  };

  const { photos, videos } = getVehicleMediaFiles(req);
  if (photos.length || videos.length) {
    try {
      await removeVehicleStoredMedia(current);
      const media = await persistVehicleMedia(req);
      const firstImage = media.find((item) => item.mediaType === 'image') || media[0] || null;
      updated.media = media;
      updated.image = firstImage ? firstImage.url : '';
      updated.imageStorage = firstImage ? firstImage.storage : 'none';
      updated.imagePublicId = firstImage ? firstImage.publicId : null;
    } catch (err) {
      console.error('Erro ao atualizar mídia:', err);
      return res.status(500).json({ error: 'Falha ao atualizar mídias do veículo' });
    }
  }

  vehicles[index] = updated;
  writeVehiclesScoped(req, vehicles);
  return res.json({ ok: true, vehicle: updated });
});

app.delete('/api/admin/vehicles/:id', requireAdmin, async (req, res) => {
  const vehicles = readVehiclesScoped(req);
  const index = vehicles.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Veículo não encontrado' });

  const [removed] = vehicles.splice(index, 1);
  writeVehiclesScoped(req, vehicles);

  try {
    await removeVehicleStoredMedia(removed);
  } catch (err) {
    console.warn('Falha ao remover mídias ao excluir veículo:', err.message);
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

  const sellers = readSellersScoped(req);
  sellers.unshift(seller);
  writeSellersScoped(req, sellers);
  return res.status(201).json({ ok: true, seller });
});

app.put('/api/admin/sellers/:id', requireAdmin, upload.single('photo'), async (req, res) => {
  const sellers = readSellersScoped(req);
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
  writeSellersScoped(req, sellers);
  return res.json({ ok: true, seller: updated });
});

app.delete('/api/admin/sellers/:id', requireAdmin, async (req, res) => {
  const sellers = readSellersScoped(req);
  const index = sellers.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Vendedor não encontrado' });

  const [removed] = sellers.splice(index, 1);
  writeSellersScoped(req, sellers);

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

  const banners = readBannersScoped(req);
  banners.unshift(banner);
  writeBannersScoped(req, banners);
  return res.status(201).json({ ok: true, banner });
});

app.put('/api/admin/banners/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const banners = readBannersScoped(req);
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
  writeBannersScoped(req, banners);
  return res.json({ ok: true, banner: updated });
});

app.delete('/api/admin/banners/:id', requireAdmin, async (req, res) => {
  const banners = readBannersScoped(req);
  const index = banners.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Banner não encontrado' });

  const [removed] = banners.splice(index, 1);
  writeBannersScoped(req, banners);

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

app.get('/admin/:slug', (req, res) => {
  const slug = slugifyStore(req.params.slug);
  const exists = readStores().some((item) => item.slug === slug);
  if (!exists) return res.status(404).sendFile(path.join(FRONTEND_ROOT, 'index.html'));
  return res.sendFile(path.join(FRONTEND_ROOT, 'admin.html'));
});

app.get('/master', (_req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, 'master.html'));
});

app.get('/loja/:slug', (req, res) => {
  const slug = slugifyStore(req.params.slug);
  const exists = readStores().some((item) => item.slug === slug);
  if (!exists) return res.status(404).sendFile(path.join(FRONTEND_ROOT, 'index.html'));
  return res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
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
    req.path.startsWith('/uploads/') ||
    req.path.startsWith('/loja/')
  ) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  return res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

ensureStorage();
seedDefaultMasterStore();

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
