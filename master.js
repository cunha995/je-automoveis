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
    const publicUrl = `${API_BASE}/loja/${store.slug}`;
    return `
      <article class="admin-item">
        <div class="master-meta">
          <h3>${store.name}</h3>
          <p>Slug: ${store.slug}</p>
          <a class="master-link" target="_blank" rel="noopener noreferrer" href="${publicUrl}">${publicUrl}</a>
        </div>
      </article>
    `;
  }).join('');
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

  const fullUrl = `${API_BASE}${data.publicUrl}`;
  setMessage(storeMessage, `Loja criada com sucesso! Link: ${fullUrl}`);
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
