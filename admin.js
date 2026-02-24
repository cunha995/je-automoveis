const API_BASE = window.location.origin;
const TOKEN_KEY = 'je_admin_token';

const loginSection = document.getElementById('loginSection');
const panelSection = document.getElementById('panelSection');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

const vehicleForm = document.getElementById('vehicleForm');
const vehicleMessage = document.getElementById('vehicleMessage');
const adminVehicleList = document.getElementById('adminVehicleList');
const cancelVehicleEditBtn = document.getElementById('cancelVehicleEditBtn');

const sellerForm = document.getElementById('sellerForm');
const sellerMessage = document.getElementById('sellerMessage');
const adminSellerList = document.getElementById('adminSellerList');
const cancelSellerEditBtn = document.getElementById('cancelSellerEditBtn');

const bannerForm = document.getElementById('bannerForm');
const bannerMessage = document.getElementById('bannerMessage');
const adminBannerList = document.getElementById('adminBannerList');
const cancelBannerEditBtn = document.getElementById('cancelBannerEditBtn');

const settingsForm = document.getElementById('settingsForm');
const settingsMessage = document.getElementById('settingsMessage');

const logoutBtn = document.getElementById('logoutBtn');

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
}

function showPanel(isLoggedIn) {
  loginSection.classList.toggle('hidden', isLoggedIn);
  panelSection.classList.toggle('hidden', !isLoggedIn);
}

function setMessage(target, message, isError = false) {
  target.textContent = message;
  target.style.color = isError ? '#b31818' : '#267529';
}

function toAbsoluteImage(pathValue) {
  if (!pathValue) return 'images/carros/carro-01.svg';
  if (pathValue.startsWith('http://') || pathValue.startsWith('https://')) return pathValue;
  if (pathValue.startsWith('/')) return `${API_BASE}${pathValue}`;
  return pathValue;
}

function formatPrice(price) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);
}

function clearVehicleForm() {
  vehicleForm.reset();
  vehicleForm.elements.id.value = '';
}

function clearSellerForm() {
  sellerForm.reset();
  sellerForm.elements.id.value = '';
}

function clearBannerForm() {
  bannerForm.reset();
  bannerForm.elements.id.value = '';
  bannerForm.elements.isActive.value = 'true';
}

function handleUnauthorized(res) {
  if (res.status !== 401) return false;
  setToken('');
  showPanel(false);
  setMessage(loginMessage, 'Sua sessão expirou. Faça login novamente.', true);
  return true;
}

async function loadVehicles() {
  const res = await fetch(`${API_BASE}/api/admin/vehicles`, { headers: authHeaders() });
  if (handleUnauthorized(res)) return;
  const data = await res.json();
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];

  if (!vehicles.length) {
    adminVehicleList.innerHTML = '<p>Nenhum veículo cadastrado ainda.</p>';
    return;
  }

  adminVehicleList.innerHTML = vehicles.map((vehicle) => `
    <article class="admin-item">
      <div class="admin-photo-wrap">
        <img src="${toAbsoluteImage(vehicle.image)}" alt="${vehicle.model}">
        ${vehicle.sold ? '<span class="sold-stamp">VENDIDO</span>' : ''}
      </div>
      <div>
        <h3>${vehicle.model} (${vehicle.year})</h3>
        <p>${vehicle.km || 'Sem KM informado'} · ${vehicle.fuel || 'Combustível não informado'} · ${vehicle.transmission || 'Manual'}</p>
        <p><strong>${formatPrice(vehicle.price)}</strong> · ${vehicle.sold ? 'Vendido' : (vehicle.status || 'Disponível')}</p>
      </div>
      <div class="admin-item-actions">
        <button class="btn-edit" data-edit-vehicle="${vehicle.id}">Editar</button>
        <button class="btn-delete" data-delete-vehicle="${vehicle.id}">Excluir</button>
      </div>
    </article>
  `).join('');

  adminVehicleList.querySelectorAll('[data-edit-vehicle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = vehicles.find((item) => item.id === btn.dataset.editVehicle);
      if (!current) return;
      vehicleForm.elements.id.value = current.id || '';
      vehicleForm.elements.model.value = current.model || '';
      vehicleForm.elements.year.value = current.year || '';
      vehicleForm.elements.km.value = current.km || '';
      vehicleForm.elements.fuel.value = current.fuel || '';
      vehicleForm.elements.transmission.value = current.transmission || '';
      vehicleForm.elements.status.value = current.status || '';
      vehicleForm.elements.sold.value = current.sold ? 'true' : 'false';
      vehicleForm.elements.price.value = current.price || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  adminVehicleList.querySelectorAll('[data-delete-vehicle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Deseja excluir este veículo?')) return;
      const delRes = await fetch(`${API_BASE}/api/admin/vehicles/${btn.dataset.deleteVehicle}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!delRes.ok) {
        setMessage(vehicleMessage, 'Falha ao excluir veículo.', true);
        return;
      }
      setMessage(vehicleMessage, 'Veículo excluído com sucesso.');
      clearVehicleForm();
      loadVehicles();
    });
  });
}

async function loadSellers() {
  const res = await fetch(`${API_BASE}/api/admin/sellers`, { headers: authHeaders() });
  if (handleUnauthorized(res)) return;
  const data = await res.json();
  const sellers = Array.isArray(data.sellers) ? data.sellers : [];

  if (!sellers.length) {
    adminSellerList.innerHTML = '<p>Nenhum vendedor cadastrado ainda.</p>';
    return;
  }

  adminSellerList.innerHTML = sellers.map((seller) => `
    <article class="admin-item">
      <img src="${toAbsoluteImage(seller.image)}" alt="${seller.name}">
      <div>
        <h3>${seller.name}</h3>
        <p>${seller.role || 'Consultor de vendas'} · ${seller.status || 'Online'}</p>
        <p>${seller.phone || ''} ${seller.whatsapp ? `· WhatsApp: ${seller.whatsapp}` : ''}</p>
      </div>
      <div class="admin-item-actions">
        <button class="btn-edit" data-edit-seller="${seller.id}">Editar</button>
        <button class="btn-delete" data-delete-seller="${seller.id}">Excluir</button>
      </div>
    </article>
  `).join('');

  adminSellerList.querySelectorAll('[data-edit-seller]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = sellers.find((item) => item.id === btn.dataset.editSeller);
      if (!current) return;
      sellerForm.elements.id.value = current.id || '';
      sellerForm.elements.name.value = current.name || '';
      sellerForm.elements.role.value = current.role || '';
      sellerForm.elements.phone.value = current.phone || '';
      sellerForm.elements.whatsapp.value = current.whatsapp || '';
      sellerForm.elements.status.value = current.status || '';
      sellerForm.elements.bio.value = current.bio || '';
      window.scrollTo({ top: sellerForm.offsetTop - 40, behavior: 'smooth' });
    });
  });

  adminSellerList.querySelectorAll('[data-delete-seller]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Deseja excluir este vendedor?')) return;
      const delRes = await fetch(`${API_BASE}/api/admin/sellers/${btn.dataset.deleteSeller}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!delRes.ok) {
        setMessage(sellerMessage, 'Falha ao excluir vendedor.', true);
        return;
      }
      setMessage(sellerMessage, 'Vendedor excluído com sucesso.');
      clearSellerForm();
      loadSellers();
    });
  });
}

async function loadBanners() {
  const res = await fetch(`${API_BASE}/api/admin/banners`, { headers: authHeaders() });
  if (handleUnauthorized(res)) return;
  const data = await res.json();
  const banners = Array.isArray(data.banners) ? data.banners : [];

  if (!banners.length) {
    adminBannerList.innerHTML = '<p>Nenhum banner cadastrado ainda.</p>';
    return;
  }

  adminBannerList.innerHTML = banners.map((banner) => `
    <article class="admin-item">
      <img src="${toAbsoluteImage(banner.image)}" alt="${banner.title}">
      <div>
        <h3>${banner.title}</h3>
        <p>${banner.subtitle || ''}</p>
        <p>Ordem: ${banner.order || 0} · ${banner.isActive ? 'Ativo' : 'Inativo'}</p>
      </div>
      <div class="admin-item-actions">
        <button class="btn-edit" data-edit-banner="${banner.id}">Editar</button>
        <button class="btn-delete" data-delete-banner="${banner.id}">Excluir</button>
      </div>
    </article>
  `).join('');

  adminBannerList.querySelectorAll('[data-edit-banner]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = banners.find((item) => item.id === btn.dataset.editBanner);
      if (!current) return;
      bannerForm.elements.id.value = current.id || '';
      bannerForm.elements.title.value = current.title || '';
      bannerForm.elements.subtitle.value = current.subtitle || '';
      bannerForm.elements.ctaText.value = current.ctaText || '';
      bannerForm.elements.ctaLink.value = current.ctaLink || '';
      bannerForm.elements.order.value = current.order || 0;
      bannerForm.elements.isActive.value = current.isActive === false ? 'false' : 'true';
      window.scrollTo({ top: bannerForm.offsetTop - 40, behavior: 'smooth' });
    });
  });

  adminBannerList.querySelectorAll('[data-delete-banner]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Deseja excluir este banner?')) return;
      const delRes = await fetch(`${API_BASE}/api/admin/banners/${btn.dataset.deleteBanner}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!delRes.ok) {
        setMessage(bannerMessage, 'Falha ao excluir banner.', true);
        return;
      }
      setMessage(bannerMessage, 'Banner excluído com sucesso.');
      clearBannerForm();
      loadBanners();
    });
  });
}

async function loadAllAdminData() {
  await Promise.all([loadVehicles(), loadSellers(), loadBanners(), loadSiteSettings()]);
}

async function loadSiteSettings() {
  const res = await fetch(`${API_BASE}/api/admin/site-settings`, { headers: authHeaders() });
  if (handleUnauthorized(res)) return;
  const data = await res.json();
  const settings = data.settings || {};

  settingsForm.elements.aboutTitle.value = settings.aboutTitle || '';
  settingsForm.elements.aboutText.value = settings.aboutText || '';
  settingsForm.elements.aboutHighlights.value = Array.isArray(settings.aboutHighlights)
    ? settings.aboutHighlights.join('\n')
    : '';
  settingsForm.elements.storeAddress.value = settings.storeAddress || '';
  settingsForm.elements.storePhone.value = settings.storePhone || '';
  settingsForm.elements.storeWhatsapp.value = settings.storeWhatsapp || '';
  settingsForm.elements.storeEmail.value = settings.storeEmail || '';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    username: loginForm.elements.username.value,
    password: loginForm.elements.password.value,
  };

  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    setMessage(loginMessage, data.error || 'Falha no login.', true);
    return;
  }

  setToken(data.token);
  showPanel(true);
  setMessage(loginMessage, 'Login realizado com sucesso.');
  loadAllAdminData();
});

vehicleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = vehicleForm.elements.id.value;
  const endpoint = id ? `${API_BASE}/api/admin/vehicles/${id}` : `${API_BASE}/api/admin/vehicles`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(endpoint, {
    method,
    headers: authHeaders(),
    body: new FormData(vehicleForm),
  });
  if (handleUnauthorized(res)) {
    alert('Sessão expirada. Faça login novamente para salvar as alterações.');
    return;
  }
  const data = await res.json();
  if (!res.ok) {
    setMessage(vehicleMessage, data.error || 'Falha ao salvar veículo.', true);
    return;
  }
  setMessage(vehicleMessage, id ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.');
  clearVehicleForm();
  loadVehicles();
});

sellerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = sellerForm.elements.id.value;
  const endpoint = id ? `${API_BASE}/api/admin/sellers/${id}` : `${API_BASE}/api/admin/sellers`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(endpoint, {
    method,
    headers: authHeaders(),
    body: new FormData(sellerForm),
  });
  if (handleUnauthorized(res)) {
    alert('Sessão expirada. Faça login novamente para salvar as alterações.');
    return;
  }
  const data = await res.json();
  if (!res.ok) {
    setMessage(sellerMessage, data.error || 'Falha ao salvar vendedor.', true);
    return;
  }
  setMessage(sellerMessage, id ? 'Vendedor atualizado com sucesso.' : 'Vendedor cadastrado com sucesso.');
  clearSellerForm();
  loadSellers();
});

bannerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = bannerForm.elements.id.value;
  const endpoint = id ? `${API_BASE}/api/admin/banners/${id}` : `${API_BASE}/api/admin/banners`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(endpoint, {
    method,
    headers: authHeaders(),
    body: new FormData(bannerForm),
  });
  if (handleUnauthorized(res)) {
    alert('Sessão expirada. Faça login novamente para salvar as alterações.');
    return;
  }
  const data = await res.json();
  if (!res.ok) {
    setMessage(bannerMessage, data.error || 'Falha ao salvar banner.', true);
    return;
  }
  setMessage(bannerMessage, id ? 'Banner atualizado com sucesso.' : 'Banner cadastrado com sucesso.');
  clearBannerForm();
  loadBanners();
});

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    aboutTitle: settingsForm.elements.aboutTitle.value,
    aboutText: settingsForm.elements.aboutText.value,
    aboutHighlights: settingsForm.elements.aboutHighlights.value,
    storeAddress: settingsForm.elements.storeAddress.value,
    storePhone: settingsForm.elements.storePhone.value,
    storeWhatsapp: settingsForm.elements.storeWhatsapp.value,
    storeEmail: settingsForm.elements.storeEmail.value,
  };

  const res = await fetch(`${API_BASE}/api/admin/site-settings`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (handleUnauthorized(res)) {
    alert('Sessão expirada. Faça login novamente para salvar as alterações.');
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    setMessage(settingsMessage, data.error || 'Falha ao salvar informações da loja.', true);
    return;
  }

  setMessage(settingsMessage, 'Informações da loja atualizadas com sucesso.');
  loadSiteSettings();
});

logoutBtn.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } catch (_err) {
  }
  setToken('');
  showPanel(false);
});

cancelVehicleEditBtn.addEventListener('click', () => {
  clearVehicleForm();
  setMessage(vehicleMessage, 'Edição de veículo cancelada.');
});

cancelSellerEditBtn.addEventListener('click', () => {
  clearSellerForm();
  setMessage(sellerMessage, 'Edição de vendedor cancelada.');
});

cancelBannerEditBtn.addEventListener('click', () => {
  clearBannerForm();
  setMessage(bannerMessage, 'Edição de banner cancelada.');
});

(function init() {
  const hasToken = !!getToken();
  showPanel(hasToken);
  if (hasToken) {
    loadAllAdminData();
  }
})();
