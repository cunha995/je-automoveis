const API_BASE = window.location.origin;
const TOKEN_KEY = 'je_admin_token';

const loginSection = document.getElementById('loginSection');
const panelSection = document.getElementById('panelSection');
const listSection = document.getElementById('listSection');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const vehicleForm = document.getElementById('vehicleForm');
const formMessage = document.getElementById('formMessage');
const adminVehicleList = document.getElementById('adminVehicleList');
const logoutBtn = document.getElementById('logoutBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

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

function formatPrice(price) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);
}

function showPanel(isLoggedIn) {
  loginSection.classList.toggle('hidden', isLoggedIn);
  panelSection.classList.toggle('hidden', !isLoggedIn);
  listSection.classList.toggle('hidden', !isLoggedIn);
}

function clearForm() {
  vehicleForm.reset();
  vehicleForm.elements.id.value = '';
}

function setMessage(target, message, isError = false) {
  target.textContent = message;
  target.style.color = isError ? '#b31818' : '#267529';
}

function toAbsoluteImage(pathValue) {
  if (!pathValue) return 'images/carros/carro-01.svg';
  if (pathValue.startsWith('http://') || pathValue.startsWith('https://')) return pathValue;
  return `${API_BASE}${pathValue}`;
}

function fillForm(vehicle) {
  vehicleForm.elements.id.value = vehicle.id || '';
  vehicleForm.elements.model.value = vehicle.model || '';
  vehicleForm.elements.year.value = vehicle.year || '';
  vehicleForm.elements.km.value = vehicle.km || '';
  vehicleForm.elements.fuel.value = vehicle.fuel || '';
  vehicleForm.elements.transmission.value = vehicle.transmission || '';
  vehicleForm.elements.status.value = vehicle.status || '';
  vehicleForm.elements.price.value = vehicle.price || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadVehicles() {
  const res = await fetch(`${API_BASE}/api/admin/vehicles`, {
    headers: authHeaders(),
  });

  if (res.status === 401) {
    setToken('');
    showPanel(false);
    return;
  }

  const data = await res.json();
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];

  if (!vehicles.length) {
    adminVehicleList.innerHTML = '<p>Nenhum veículo cadastrado ainda.</p>';
    return;
  }

  adminVehicleList.innerHTML = vehicles.map((vehicle) => `
    <article class="admin-item">
      <img src="${toAbsoluteImage(vehicle.image)}" alt="${vehicle.model}">
      <div>
        <h3>${vehicle.model} (${vehicle.year})</h3>
        <p>${vehicle.km || 'Sem KM informado'} · ${vehicle.fuel || 'Combustível não informado'} · ${vehicle.transmission || 'Manual'}</p>
        <p><strong>${formatPrice(vehicle.price)}</strong> · ${vehicle.status || 'Disponível'}</p>
      </div>
      <div class="admin-item-actions">
        <button class="btn-edit" data-action="edit" data-id="${vehicle.id}">Editar</button>
        <button class="btn-delete" data-action="delete" data-id="${vehicle.id}">Excluir</button>
      </div>
    </article>
  `).join('');

  adminVehicleList.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const vehicle = vehicles.find((item) => item.id === btn.dataset.id);
      if (vehicle) fillForm(vehicle);
    });
  });

  adminVehicleList.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = window.confirm('Deseja excluir este veículo?');
      if (!confirmed) return;

      const resDelete = await fetch(`${API_BASE}/api/admin/vehicles/${btn.dataset.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!resDelete.ok) {
        setMessage(formMessage, 'Falha ao excluir veículo.', true);
        return;
      }

      setMessage(formMessage, 'Veículo excluído com sucesso.');
      clearForm();
      loadVehicles();
    });
  });
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
  loadVehicles();
});

vehicleForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const vehicleId = vehicleForm.elements.id.value;
  const formData = new FormData(vehicleForm);

  const endpoint = vehicleId
    ? `${API_BASE}/api/admin/vehicles/${vehicleId}`
    : `${API_BASE}/api/admin/vehicles`;

  const method = vehicleId ? 'PUT' : 'POST';

  const res = await fetch(endpoint, {
    method,
    headers: authHeaders(),
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    setMessage(formMessage, data.error || 'Falha ao salvar veículo.', true);
    return;
  }

  setMessage(formMessage, vehicleId ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.');
  clearForm();
  loadVehicles();
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

cancelEditBtn.addEventListener('click', () => {
  clearForm();
  setMessage(formMessage, 'Edição cancelada.');
});

(function init() {
  const hasToken = !!getToken();
  showPanel(hasToken);
  if (hasToken) {
    loadVehicles();
  }
})();
