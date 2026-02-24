// Contact form handler: send to backend endpoint (Render)
// IMPORTANT: after you deploy the backend to Render, set `BACKEND_URL` to the
// public URL of your Render service (include https://, no trailing slash).
// Example:
// const BACKEND_URL = 'https://je-backend.onrender.com';
// If left empty the frontend will POST to a relative `/contact` path.
const BACKEND_URL = 'https://je-automoveis.onrender.com';
const WHATSAPP_NUMBER = '5500000000000';

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

function renderVehicles(vehicles) {
  const grid = document.getElementById('vehicleGrid');
  if (!grid) return;

  if (!vehicles.length) {
    grid.innerHTML = '<p>Nenhum veículo cadastrado no momento.</p>';
    return;
  }

  grid.innerHTML = vehicles.map((vehicle) => {
    const message = encodeURIComponent(`Olá! Tenho interesse no veículo ${vehicle.model} ${vehicle.year}.`);
    const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    const fallback = createFallbackImage(`${vehicle.model} ${vehicle.year}`);

    return `
      <article class="vehicle-card">
        <img src="${vehicle.image}" alt="${vehicle.model}" class="vehicle-photo" onerror="this.onerror=null;this.src='${fallback}'">
        <div class="vehicle-body">
          <div class="vehicle-top">
            <h3 class="vehicle-title">${vehicle.model}</h3>
            <span class="badge">${vehicle.status}</span>
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
}

async function loadVehicles() {
  try {
    const url = (BACKEND_URL || '') + '/api/vehicles';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao carregar veículos');
    const data = await res.json();
    const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
    if (vehicles.length) {
      renderVehicles(vehicles);
      return;
    }
    renderVehicles(fallbackVehicles);
  } catch (err) {
    console.error('Erro ao carregar estoque:', err);
    renderVehicles(fallbackVehicles);
  }
}

document.addEventListener('DOMContentLoaded', function(){
  loadVehicles();

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
