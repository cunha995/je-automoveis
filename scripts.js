// Contact form handler: send to backend endpoint (Render)
// IMPORTANT: after you deploy the backend to Render, set `BACKEND_URL` to the
// public URL of your Render service (include https://, no trailing slash).
// Example:
// const BACKEND_URL = 'https://je-backend.onrender.com';
// If left empty the frontend will POST to a relative `/contact` path.
const BACKEND_URL = 'https://je-automoveis.onrender.com';
document.addEventListener('DOMContentLoaded', function(){
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
