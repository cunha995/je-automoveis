// Contact form handler: send to backend endpoint (Render)
// IMPORTANT: after you deploy the backend to Render, set `BACKEND_URL` to the
// public URL of your Render service (include https://, no trailing slash).
// Example:
// const BACKEND_URL = 'https://je-backend.onrender.com';
// If left empty the frontend will POST to a relative `/contact` path.
const BACKEND_URL = window.location.origin;
let STORE_WHATSAPP_NUMBER = '5500000000000';
let STORE_BADGE_COLOR = '#d32f2f';
let CURRENT_STORE_NAME = 'Loja';
const PATH_PARTS = window.location.pathname.split('/').filter(Boolean);
const STORE_SLUG = PATH_PARTS[0] === 'loja' ? PATH_PARTS[1] : '';

const fallbackVehicles = [
  {
    model: 'Volkswagen Gol 1.0',
    year: 2021,
    km: '49.000 km',
    fuel: 'Flex',
    price: 49900,
    status: 'Disponível',
    image: 'images/carros/carro-01.svg'
  },
  {
    model: 'Fiat Argo Drive',
    year: 2020,
    km: '62.000 km',
    fuel: 'Flex',
    price: 58900,
    status: 'Disponível',
    image: 'images/carros/carro-02.svg'
  },
  {
    model: 'Chevrolet Onix LT',
    year: 2019,
    km: '73.000 km',
    fuel: 'Flex',
    price: 56900,
    status: 'Disponível',
    image: 'images/carros/carro-03.svg'
  },
  {
    model: 'Hyundai HB20 Comfort',
    year: 2022,
    km: '31.000 km',
    fuel: 'Flex',
    price: 68900,
    status: 'Disponível',
    image: 'images/carros/carro-04.svg'
  }
];

const fallbackSellers = [
  {
    name: 'João Vendedor',
    role: 'Consultor de vendas',
    phone: '(00) 0 0000-0000',
    whatsapp: '5500000000000',
    status: 'Online',
    bio: 'Atendimento direto para tirar dúvidas e montar proposta.',
    image: 'images/carros/carro-01.svg'
  }
];

const fallbackBanners = [
  {
    title: 'Novidades da semana na JE Automóveis',
    subtitle: 'Confira ofertas especiais e veículos recém-chegados na garagem.',
    ctaText: 'Ver estoque',
    ctaLink: '#estoque',
    image: 'images/carros/carro-02.svg',
    isActive: true,
    order: 1,
  },
  {
    title: 'Condições facilitadas para fechar negócio',
    subtitle: 'Fale com nossa equipe e receba uma proposta personalizada.',
    ctaText: 'Falar no WhatsApp',
    ctaLink: '#vendedores',
    image: 'images/carros/carro-03.svg',
    isActive: true,
    order: 2,
  }
];

const fallbackWall = [];

let currentBannerIndex = 0;
let bannerIntervalId = null;
let currentVehiclesCache = [];
let currentSellersCache = [];
let vehicleCarouselTimers = [];

function buildApiUrl(resource) {
  if (STORE_SLUG) {
    return `${BACKEND_URL}/api/public/${STORE_SLUG}/${resource}`;
  }
  return `${BACKEND_URL}/api/${resource}`;
}

function applyStoreBrand(store) {
  if (!store || !store.name) return;
  CURRENT_STORE_NAME = store.name;
  document.title = `${store.name} — Venda, Troca e Consignado`;
  document.querySelectorAll('.brand span').forEach((node) => {
    node.textContent = store.name;
  });
  renderBrandBadge();
  const footerText = document.querySelector('.site-footer p');
  if (footerText) footerText.textContent = `© ${store.name} — Todos os direitos reservados`;
  const aboutTitle = document.getElementById('aboutTitle');
  if (aboutTitle && !aboutTitle.textContent.includes(store.name)) {
    aboutTitle.textContent = `Sobre a ${store.name}`;
  }
}

function renderBrandBadge() {
  const initials = String(CURRENT_STORE_NAME || 'Loja')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'LO';
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="6" fill="${STORE_BADGE_COLOR}"/><text x="50%" y="55%" text-anchor="middle" fill="#ffffff" font-size="16" font-family="Arial" font-weight="700">${initials}</text></svg>`;
  document.querySelectorAll('.brand .logo').forEach((img) => {
    img.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(logoSvg)}`;
    img.alt = `${CURRENT_STORE_NAME} logo`;
  });
}

const fallbackSiteSettings = {
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
  brandBadgeColor: '#d32f2f',
  heroBackgroundImage: '',
};

function formatPrice(price) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(price);
}

function createFallbackImage(title) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1f1f1f"/><stop offset="100%" stop-color="#3c3c3c"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><text x="50%" y="44%" text-anchor="middle" fill="#ffffff" font-size="44" font-family="Arial">JE Automóveis</text><text x="50%" y="56%" text-anchor="middle" fill="#dddddd" font-size="28" font-family="Arial">${title}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function toAbsoluteImage(pathValue, fallbackTitle = 'JE Automóveis') {
  if (!pathValue) return createFallbackImage(fallbackTitle);
  if (pathValue.startsWith('http://') || pathValue.startsWith('https://') || pathValue.startsWith('data:')) return pathValue;
  if (pathValue.startsWith('/')) return `${BACKEND_URL}${pathValue}`;
  return `${BACKEND_URL}/${String(pathValue).replace(/^\/+/, '')}`;
}

function normalizeVehicleMedia(vehicle) {
  if (Array.isArray(vehicle?.media) && vehicle.media.length) {
    return vehicle.media
      .map((item) => ({
        url: String(item?.url || item?.image || '').trim(),
        mediaType: item?.mediaType === 'video' ? 'video' : 'image',
      }))
      .filter((item) => item.url);
  }

  if (vehicle?.image) {
    return [{ url: String(vehicle.image), mediaType: 'image' }];
  }

  return [];
}

function getInterestSellers() {
  if (currentSellersCache.length) return currentSellersCache;
  return STORE_SLUG ? [] : fallbackSellers;
}

function normalizeWhatsappNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildVehicleSellerInterestHtml(vehicle, listIndex) {
  const sellers = getInterestSellers().filter((seller) => {
    const phone = normalizeWhatsappNumber(seller?.whatsapp);
    if (!phone) return false;
    const status = String(seller?.status || '').toLowerCase();
    return !/(offline|indispon|ausente)/.test(status);
  });

  if (!sellers.length) return '';

  const visibleSellers = sellers.slice(0, 3);
  const hiddenSellers = sellers.slice(3);
  const safeVehicleId = String(vehicle.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const hiddenListId = `interest-sellers-${safeVehicleId || `idx-${listIndex}`}`;

  const renderSellerLink = (seller) => {
    const phone = normalizeWhatsappNumber(seller.whatsapp);
    const sellerName = String(seller.name || 'Vendedor').trim() || 'Vendedor';
    const text = encodeURIComponent(`Olá ${sellerName}, tenho interesse no veículo ${vehicle.model} ${vehicle.year}.`);
    const link = `https://wa.me/${phone}?text=${text}`;
    return `<a class="vehicle-interest-link" target="_blank" rel="noopener noreferrer" href="${link}">${sellerName}</a>`;
  };

  const visibleLinks = visibleSellers.map(renderSellerLink).join('');
  const hiddenLinks = hiddenSellers.map(renderSellerLink).join('');
  const toggleHtml = hiddenSellers.length
    ? `<button type="button" class="vehicle-interest-toggle" data-toggle-interest="${hiddenListId}" data-expand-label="Ver mais vendedores" data-collapse-label="Ver menos vendedores">Ver mais vendedores</button>`
    : '';
  const hiddenListHtml = hiddenSellers.length
    ? `<div id="${hiddenListId}" class="vehicle-interest-list vehicle-interest-list-hidden">${hiddenLinks}</div>`
    : '';

  return `
    <div class="vehicle-interest-sellers">
      <span class="vehicle-interest-label">Fale direto com um vendedor:</span>
      <div class="vehicle-interest-list">${visibleLinks}</div>
      ${hiddenListHtml}
      ${toggleHtml}
    </div>
  `;
}

function bindVehicleInterestToggle() {
  const toggles = document.querySelectorAll('[data-toggle-interest]');
  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-toggle-interest');
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;

      const isHidden = target.classList.contains('vehicle-interest-list-hidden');
      target.classList.toggle('vehicle-interest-list-hidden', !isHidden);
      btn.textContent = isHidden
        ? (btn.getAttribute('data-collapse-label') || 'Ver menos vendedores')
        : (btn.getAttribute('data-expand-label') || 'Ver mais vendedores');
    });
  });
}

function clearVehicleCarousels() {
  vehicleCarouselTimers.forEach((timerId) => clearInterval(timerId));
  vehicleCarouselTimers = [];
}

function startVehicleCarousels() {
  clearVehicleCarousels();

  const wrappers = document.querySelectorAll('[data-vehicle-carousel]');
  wrappers.forEach((wrapper) => {
    const track = wrapper.querySelector('.vehicle-photo-track');
    if (!track) return;

    const slides = track.querySelectorAll('.vehicle-photo-slide');
    if (slides.length <= 1) return;

    let currentIndex = 0;
    const timer = setInterval(() => {
      currentIndex = (currentIndex + 1) % slides.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }, 3200);

    vehicleCarouselTimers.push(timer);
  });
}

function renderVehicles(vehicles) {
  currentVehiclesCache = Array.isArray(vehicles) ? vehicles : [];
  clearVehicleCarousels();
  const grid = document.getElementById('vehicleGrid');
  if (!grid) return;

  if (!currentVehiclesCache.length) {
    grid.innerHTML = '<p>Nenhum veículo cadastrado no momento.</p>';
    return;
  }

  grid.innerHTML = currentVehiclesCache.map((vehicle, index) => {
    const isSold = vehicle.sold === true || /vendid/i.test(String(vehicle.status || ''));
    const message = encodeURIComponent(`Olá! Tenho interesse no veículo ${vehicle.model} ${vehicle.year}.`);
    const whatsappLink = `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${message}`;
    const fallback = createFallbackImage(`${vehicle.model} ${vehicle.year}`);
    const media = normalizeVehicleMedia(vehicle);
    const imageMedia = media.filter((item) => item.mediaType !== 'video');
    const videoMedia = media.filter((item) => item.mediaType === 'video');

    const mainMediaHtml = imageMedia.length
      ? `<div class="vehicle-photo-track">${imageMedia.map((item) => `
          <img src="${toAbsoluteImage(item.url, `${vehicle.model} ${vehicle.year}`)}" alt="${vehicle.model}" class="vehicle-photo vehicle-photo-slide" onerror="this.onerror=null;this.src='${fallback}'">
        `).join('')}</div>`
      : videoMedia[0]
        ? `<video src="${toAbsoluteImage(videoMedia[0].url, `${vehicle.model} ${vehicle.year}`)}" class="vehicle-photo" controls preload="metadata" playsinline></video>`
        : `<img src="${fallback}" alt="${vehicle.model}" class="vehicle-photo">`;

    const thumbsHtml = media.length > 1
      ? `<div class="vehicle-media-strip">${media.slice(0, 6).map((item) => item.mediaType === 'video'
        ? `<span class="vehicle-media-chip">Vídeo</span>`
        : `<img src="${toAbsoluteImage(item.url, `${vehicle.model} ${vehicle.year}`)}" alt="Foto de ${vehicle.model}">`).join('')}</div>`
      : '';
    const sellersInterestHtml = buildVehicleSellerInterestHtml(vehicle, index);

    return `
      <article class="vehicle-card">
        <div class="vehicle-photo-wrap" data-vehicle-carousel>
          ${mainMediaHtml}
          ${isSold ? '<span class="sold-stamp">VENDIDO</span>' : ''}
        </div>
        ${thumbsHtml}
        ${sellersInterestHtml}
        <div class="vehicle-body">
          <div class="vehicle-top">
            <h3 class="vehicle-title">${vehicle.model}</h3>
            <span class="badge">${isSold ? 'Vendido' : vehicle.status}</span>
          </div>
          <div class="vehicle-meta">
            <span><strong>Ano:</strong> ${vehicle.year}</span>
            <span><strong>KM:</strong> ${vehicle.km}</span>
            <span><strong>Combustível:</strong> ${vehicle.fuel}</span>
            <span><strong>Câmbio:</strong> ${vehicle.transmission || 'Manual'}</span>
          </div>
          <p class="vehicle-price">${formatPrice(vehicle.price)}</p>
          <div class="vehicle-actions">
            <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" class="btn-card primary">Tenho interesse</a>
            <a href="#contato" class="btn-card ghost">Solicitar proposta</a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  bindVehicleInterestToggle();
  startVehicleCarousels();
}

function renderSellers(sellers) {
  const grid = document.getElementById('sellerGrid');
  if (!grid) return;

  if (!sellers.length) {
    grid.innerHTML = '<p>Nenhum vendedor cadastrado no momento.</p>';
    return;
  }

  grid.innerHTML = sellers.map((seller) => {
    const sellerPhone = (seller.whatsapp || STORE_WHATSAPP_NUMBER).replace(/\D/g, '');
    const text = encodeURIComponent(`Olá ${seller.name}, vi seu contato no site da JE Automóveis e quero mais informações.`);
    const link = `https://wa.me/${sellerPhone}?text=${text}`;
    const fallback = createFallbackImage(seller.name || 'Vendedor');
    return `
      <article class="seller-card">
        <img class="seller-photo" src="${toAbsoluteImage(seller.image, seller.name || 'Vendedor')}" alt="${seller.name || 'Vendedor'}" onerror="this.onerror=null;this.src='${fallback}'">
        <div class="seller-body">
          <h3>${seller.name || 'Vendedor'}</h3>
          <p class="seller-role">${seller.role || 'Consultor de vendas'} · ${seller.status || 'Disponível'}</p>
          <p class="seller-bio">${seller.bio || ''}</p>
          <div class="seller-actions">
            <a class="btn-card primary" target="_blank" rel="noopener noreferrer" href="${link}">Falar no WhatsApp</a>
            <a class="btn-card ghost" href="#contato">Solicitar contato</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderWall(posts) {
  const grid = document.getElementById('wallGrid');
  if (!grid) return;

  if (!posts.length) {
    grid.innerHTML = '<p>Nenhuma venda publicada no mural ainda.</p>';
    return;
  }

  grid.innerHTML = posts.map((post) => {
    const fallback = createFallbackImage(post.clientName || 'Cliente');
    return `
      <article class="seller-card">
        <img class="seller-photo" src="${toAbsoluteImage(post.image, post.clientName || 'Cliente')}" alt="${post.clientName || 'Cliente'}" onerror="this.onerror=null;this.src='${fallback}'">
        <div class="seller-body">
          <h3>${post.clientName || 'Cliente'}</h3>
          <p class="seller-role">${post.vehicleModel || 'Veículo vendido'}</p>
          <p class="seller-bio">${post.message || ''}</p>
        </div>
      </article>
    `;
  }).join('');
}

function updateBannerActiveState() {
  const slides = [...document.querySelectorAll('.top-banner-slide')];
  const dots = [...document.querySelectorAll('.top-banner-dot')];
  slides.forEach((slide, idx) => slide.classList.toggle('active', idx === currentBannerIndex));
  dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentBannerIndex));
}

function moveBanner(step) {
  const slides = document.querySelectorAll('.top-banner-slide');
  if (!slides.length) return;
  currentBannerIndex = (currentBannerIndex + step + slides.length) % slides.length;
  updateBannerActiveState();
}

function startBannerRotation() {
  if (bannerIntervalId) clearInterval(bannerIntervalId);
  bannerIntervalId = setInterval(() => moveBanner(1), 4500);
}

function renderBanners(banners) {
  const slidesWrap = document.getElementById('topBannerSlides');
  const dotsWrap = document.getElementById('topBannerDots');
  const prevBtn = document.getElementById('topBannerPrev');
  const nextBtn = document.getElementById('topBannerNext');
  if (!slidesWrap || !dotsWrap || !prevBtn || !nextBtn) return;

  if (!banners.length) {
    document.getElementById('topBanner').style.display = 'none';
    return;
  }

  const ordered = banners.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  currentBannerIndex = 0;

  slidesWrap.innerHTML = ordered.map((banner, idx) => {
    const fallback = createFallbackImage(banner.title || 'Oferta JE Automóveis');
    const image = toAbsoluteImage(banner.image, banner.title || 'Banner');
    const ctaText = banner.ctaText || 'Saiba mais';
    const ctaLink = banner.ctaLink || '#estoque';
    return `
      <article class="top-banner-slide ${idx === 0 ? 'active' : ''}">
        <img src="${image}" alt="${banner.title || 'Banner'}" onerror="this.onerror=null;this.src='${fallback}'">
        <div class="top-banner-overlay">
          <div class="top-banner-content">
            <h2>${banner.title || ''}</h2>
            <p>${banner.subtitle || ''}</p>
            <a class="btn-primary" href="${ctaLink}">${ctaText}</a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  dotsWrap.innerHTML = ordered.map((_banner, idx) => `<span class="top-banner-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>`).join('');

  prevBtn.onclick = () => {
    moveBanner(-1);
    startBannerRotation();
  };
  nextBtn.onclick = () => {
    moveBanner(1);
    startBannerRotation();
  };

  dotsWrap.querySelectorAll('.top-banner-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      currentBannerIndex = Number(dot.dataset.index || 0);
      updateBannerActiveState();
      startBannerRotation();
    });
  });

  startBannerRotation();
}

function renderSiteSettings(settings) {
  const safe = {
    ...fallbackSiteSettings,
    ...(settings || {}),
  };

  const aboutTitle = document.getElementById('aboutTitle');
  const aboutText = document.getElementById('aboutText');
  const aboutHighlights = document.getElementById('aboutHighlights');
  const storeAddress = document.getElementById('storeAddress');
  const storePhone = document.getElementById('storePhone');
  const storeWhatsapp = document.getElementById('storeWhatsapp');
  const storeEmail = document.getElementById('storeEmail');
  const hero = document.querySelector('.hero');

  STORE_WHATSAPP_NUMBER = String(safe.storeWhatsapp || '').replace(/\D/g, '') || '5500000000000';
  STORE_BADGE_COLOR = /^#[0-9a-fA-F]{6}$/.test(String(safe.brandBadgeColor || '').trim())
    ? String(safe.brandBadgeColor).trim()
    : '#d32f2f';
  renderBrandBadge();

  if (aboutTitle) aboutTitle.textContent = safe.aboutTitle;
  if (aboutText) aboutText.textContent = safe.aboutText;
  if (storeAddress) storeAddress.textContent = safe.storeAddress;
  if (storePhone) storePhone.textContent = safe.storePhone;
  if (storeWhatsapp) storeWhatsapp.textContent = STORE_WHATSAPP_NUMBER;
  if (storeEmail) storeEmail.textContent = safe.storeEmail;
  if (hero) {
    if (safe.heroBackgroundImage) {
      hero.style.setProperty('--hero-image', `url('${toAbsoluteImage(safe.heroBackgroundImage, 'Capa da loja')}')`);
    } else {
      hero.style.removeProperty('--hero-image');
    }
  }

  if (aboutHighlights) {
    const highlights = Array.isArray(safe.aboutHighlights) && safe.aboutHighlights.length
      ? safe.aboutHighlights
      : fallbackSiteSettings.aboutHighlights;
    aboutHighlights.innerHTML = highlights
      .map((item) => `<div class="highlight-item">✓ ${item}</div>`)
      .join('');
  }

  if (currentVehiclesCache.length) {
    renderVehicles(currentVehiclesCache);
  }
}

async function loadVehicles() {
  try {
    const url = buildApiUrl('vehicles') + '?t=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Falha ao carregar veículos');
    const data = await res.json();
    applyStoreBrand(data.store);
    const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
    if (vehicles.length) {
      renderVehicles(vehicles);
      return;
    }
    renderVehicles(STORE_SLUG ? [] : fallbackVehicles);
  } catch (err) {
    console.error('Erro ao carregar estoque:', err);
    renderVehicles(STORE_SLUG ? [] : fallbackVehicles);
  }
}

async function loadSellers() {
  try {
    const url = buildApiUrl('sellers');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao carregar vendedores');
    const data = await res.json();
    applyStoreBrand(data.store);
    const sellers = Array.isArray(data.sellers) ? data.sellers : [];
    currentSellersCache = sellers.length ? sellers : (STORE_SLUG ? [] : fallbackSellers);
    renderSellers(currentSellersCache);
    if (currentVehiclesCache.length) renderVehicles(currentVehiclesCache);
  } catch (err) {
    console.error('Erro ao carregar vendedores:', err);
    currentSellersCache = STORE_SLUG ? [] : fallbackSellers;
    renderSellers(currentSellersCache);
    if (currentVehiclesCache.length) renderVehicles(currentVehiclesCache);
  }
}

async function loadBanners() {
  try {
    const url = buildApiUrl('banners');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao carregar banners');
    const data = await res.json();
    applyStoreBrand(data.store);
    const banners = Array.isArray(data.banners) ? data.banners : [];
    renderBanners(banners.length ? banners : (STORE_SLUG ? [] : fallbackBanners));
  } catch (err) {
    console.error('Erro ao carregar banners:', err);
    renderBanners(STORE_SLUG ? [] : fallbackBanners);
  }
}

async function loadWall() {
  try {
    const url = buildApiUrl('wall');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao carregar mural');
    const data = await res.json();
    applyStoreBrand(data.store);
    const wall = Array.isArray(data.wall) ? data.wall : [];
    renderWall(wall.length ? wall : (STORE_SLUG ? [] : fallbackWall));
  } catch (err) {
    console.error('Erro ao carregar mural:', err);
    renderWall(STORE_SLUG ? [] : fallbackWall);
  }
}

async function loadSiteSettings() {
  try {
    const url = buildApiUrl('site-settings');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao carregar configurações da loja');
    const data = await res.json();
    applyStoreBrand(data.store);
    renderSiteSettings(data.settings || fallbackSiteSettings);
  } catch (err) {
    console.error('Erro ao carregar configurações da loja:', err);
    renderSiteSettings(STORE_SLUG ? {
      ...fallbackSiteSettings,
      aboutTitle: 'Sobre a loja',
      aboutText: 'Cadastre os dados desta loja no painel admin da própria loja.',
      aboutHighlights: ['Loja em configuração inicial'],
    } : fallbackSiteSettings);
  }
}

document.addEventListener('DOMContentLoaded', function(){
  loadVehicles();
  loadWall();
  loadSellers();
  loadBanners();
  loadSiteSettings();

  const form = document.getElementById('contactForm');
  if(!form) return;
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: fd.get('name')||'',
      email: fd.get('email')||'',
      phone: fd.get('phone')||'',
      message: fd.get('message')||''
    };

    try {
      const url = (BACKEND_URL || '') + '/contact';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(res.ok) {
        alert('Mensagem enviada com sucesso. Obrigado!');
        form.reset();
      } else {
        alert('Erro ao enviar mensagem: ' + (data.error || JSON.stringify(data)));
      }
    } catch(err) {
      console.error(err);
      alert('Falha ao conectar com o servidor.');
    }
  });
});
