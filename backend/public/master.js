const API_BASE = window.location.origin;
const MASTER_TOKEN_KEY = 'je_master_token';

const loginSection = document.getElementById('masterLoginSection');
const panelSection = document.getElementById('masterPanelSection');
const loginForm = document.getElementById('masterLoginForm');
const loginMessage = document.getElementById('masterLoginMessage');
const storeForm = document.getElementById('masterStoreForm');
const storeMessage = document.getElementById('masterStoreMessage');
const storeList = document.getElementById('masterStoreList');
const logoutBtn = document.getElementById('masterLogoutBtn');

function getToken() {
  return localStorage.getItem(MASTER_TOKEN_KEY) || '';
}

function setToken(token) {
  if (!token) {
    localStorage.removeItem(MASTER_TOKEN_KEY);
    return;
  }
  localStorage.setItem(MASTER_TOKEN_KEY, token);
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

function showPanel(isLoggedIn) {
  loginSection.classList.toggle('hidden', isLoggedIn);
  panelSection.classList.toggle('hidden', !isLoggedIn);
}

function setMessage(target, message, isError = false) {
  target.textContent = message;
  target.style.color = isError ? '#b31818' : '#267529';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_err) {
    return '';
  }
}

function buildStorePublicUrl(store) {
  const base = normalizeBaseUrl(store?.publicBaseUrl) || API_BASE;
  return `${base}/loja/${store.slug}`;
}

function buildStoreAdminUrl(store) {
  const base = normalizeBaseUrl(store?.publicBaseUrl) || API_BASE;
  return `${base}/admin/${store.slug}`;
}

function buildStoreSystemPublicUrl(store) {
  return `${API_BASE}/loja/${store.slug}`;
}

function buildStoreSystemAdminUrl(store) {
  return `${API_BASE}/admin/${store.slug}`;
}

function safeSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function loadStores() {
  const res = await fetch(`${API_BASE}/api/master/stores`, {
    headers: authHeaders(),
    cache: 'no-store',
  });

  if (res.status === 401) {
    setToken('');
    showPanel(false);
    setMessage(loginMessage, 'Sessão master expirada. Faça login novamente.', true);
    return;
  }

  const data = await res.json();
  const stores = Array.isArray(data.stores) ? data.stores : [];

  if (!stores.length) {
    storeList.innerHTML = '<p>Nenhuma loja criada ainda.</p>';
    return;
  }

  storeList.innerHTML = stores.map((store) => {
    const publicUrl = buildStorePublicUrl(store);
    const adminUrl = buildStoreAdminUrl(store);
    const systemPublicUrl = buildStoreSystemPublicUrl(store);
    const systemAdminUrl = buildStoreSystemAdminUrl(store);
    const hasCustomDomain = !!normalizeBaseUrl(store.publicBaseUrl);
    return `
      <article class="admin-item">
        <div class="master-meta">
          <h3>${store.name}</h3>
          <p>Slug: ${store.slug}</p>
          <p>Admin: ${store.adminUsername || '-'}</p>
          <p>Mensalidade: <strong>${formatCurrency(store.monthlyFee)}</strong></p>
          <p>Cobrança: ${store.billingNotes || 'Sem observação'}</p>
          <p>Domínio cliente: ${store.publicBaseUrl || 'padrão do sistema'}</p>
          <a class="master-link" target="_blank" rel="noopener noreferrer" href="${systemPublicUrl}">URL sistema (site): ${systemPublicUrl}</a>
          <a class="master-link" target="_blank" rel="noopener noreferrer" href="${systemAdminUrl}">URL sistema (admin): ${systemAdminUrl}</a>
          ${hasCustomDomain ? `<a class="master-link" target="_blank" rel="noopener noreferrer" href="${publicUrl}">URL cliente (site): ${publicUrl}</a>` : ''}
          ${hasCustomDomain ? `<a class="master-link" target="_blank" rel="noopener noreferrer" href="${adminUrl}">URL cliente (admin): ${adminUrl}</a>` : ''}
        </div>
        <div class="admin-item-actions">
          <button class="btn-edit" type="button" data-edit-billing="${store.slug}">Editar mensalidade</button>
          <button class="btn-edit" type="button" data-edit-public-base-url="${store.slug}">Editar domínio</button>
        </div>
      </article>
    `;
  }).join('');

  storeList.querySelectorAll('[data-edit-billing]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const currentStore = stores.find((item) => item.slug === btn.dataset.editBilling);
      if (!currentStore) return;

      const feeInput = window.prompt('Nova mensalidade (apenas números):', String(Math.round(Number(currentStore.monthlyFee) || 0)));
      if (feeInput === null) return;

      const parsedFee = Number(String(feeInput).replace(/[^\d]/g, ''));
      if (!Number.isFinite(parsedFee) || parsedFee <= 0) {
        setMessage(storeMessage, 'Mensalidade inválida. Informe um valor maior que zero.', true);
        return;
      }

      const notesInput = window.prompt('Observação da cobrança:', currentStore.billingNotes || '');
      if (notesInput === null) return;

      const res = await fetch(`${API_BASE}/api/master/stores/${currentStore.slug}/billing`, {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthlyFee: parsedFee,
          billingNotes: notesInput,
        }),
      });

      if (res.status === 401) {
        setToken('');
        showPanel(false);
        setMessage(loginMessage, 'Sessão master expirada. Faça login novamente.', true);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setMessage(storeMessage, data.error || 'Falha ao atualizar mensalidade.', true);
        return;
      }

      setMessage(storeMessage, `Mensalidade da loja ${currentStore.name} atualizada com sucesso.`);
      loadStores();
    });
  });

  storeList.querySelectorAll('[data-edit-public-base-url]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const currentStore = stores.find((item) => item.slug === btn.dataset.editPublicBaseUrl);
      if (!currentStore) return;

      const baseInput = window.prompt(
        'Domínio do cliente (deixe vazio para usar domínio padrão do sistema):',
        currentStore.publicBaseUrl || ''
      );
      if (baseInput === null) return;

      const res = await fetch(`${API_BASE}/api/master/stores/${currentStore.slug}/public-base-url`, {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicBaseUrl: baseInput,
        }),
      });

      if (res.status === 401) {
        setToken('');
        showPanel(false);
        setMessage(loginMessage, 'Sessão master expirada. Faça login novamente.', true);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setMessage(storeMessage, data.error || 'Falha ao atualizar domínio da loja.', true);
        return;
      }

      setMessage(storeMessage, `Domínio da loja ${currentStore.name} atualizado com sucesso.`);
      loadStores();
    });
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    username: loginForm.elements.username.value,
    password: loginForm.elements.password.value,
  };

  const res = await fetch(`${API_BASE}/api/master/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    setMessage(loginMessage, data.error || 'Falha no login master.', true);
    return;
  }

  setToken(data.token);
  showPanel(true);
  setMessage(loginMessage, 'Login master realizado com sucesso.');
  loadStores();
});

storeForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: storeForm.elements.name.value,
    slug: safeSlug(storeForm.elements.slug.value || storeForm.elements.name.value),
    adminUsername: storeForm.elements.adminUsername.value,
    adminPassword: storeForm.elements.adminPassword.value,
    monthlyFee: storeForm.elements.monthlyFee.value,
    billingNotes: storeForm.elements.billingNotes.value,
    publicBaseUrl: storeForm.elements.publicBaseUrl.value,
    storePhone: storeForm.elements.storePhone.value,
    storeWhatsapp: storeForm.elements.storeWhatsapp.value,
    storeEmail: storeForm.elements.storeEmail.value,
    storeAddress: storeForm.elements.storeAddress.value,
    aboutText: storeForm.elements.aboutText.value,
  };

  const res = await fetch(`${API_BASE}/api/master/stores`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    setToken('');
    showPanel(false);
    setMessage(loginMessage, 'Sessão master expirada. Faça login novamente.', true);
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    setMessage(storeMessage, data.error || 'Falha ao criar loja.', true);
    return;
  }

  const createdStore = data.store || payload;
  const systemPublicUrl = buildStoreSystemPublicUrl(createdStore);
  const systemAdminUrl = buildStoreSystemAdminUrl(createdStore);
  const hasCustomDomain = !!normalizeBaseUrl(createdStore.publicBaseUrl);
  const clientPublicUrl = buildStorePublicUrl(createdStore);
  const clientAdminUrl = buildStoreAdminUrl(createdStore);
  const domainHint = hasCustomDomain
    ? ` | Cliente (após DNS): Site ${clientPublicUrl} | Admin ${clientAdminUrl}`
    : '';

  setMessage(
    storeMessage,
    `Loja criada! Sistema: Site ${systemPublicUrl} | Admin ${systemAdminUrl}${domainHint} | Usuário: ${payload.adminUsername} | Senha: ${payload.adminPassword}`
  );
  storeForm.reset();
  loadStores();
});

logoutBtn.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/api/master/logout`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } catch (_err) {
  }

  setToken('');
  showPanel(false);
});

(function init() {
  const hasToken = !!getToken();
  showPanel(hasToken);
  if (hasToken) loadStores();
})();
