function setFooterReadyState(ready) {
  const footer = document.querySelector('footer');
  if (!footer) return;
  footer.classList.toggle('stx-footer-pending', !ready);
  footer.classList.toggle('stx-footer-ready', ready);
}

function setupHomeScanner() {
  const mask = document.querySelector('[data-home-root] .scanner-mask');
  if (!mask) return;

  const updateMask = (x, y) => {
    mask.style.setProperty('--mask-x', `${x}%`);
    mask.style.setProperty('--mask-y', `${y}%`);
  };

  const updateFromPoint = (clientX, clientY) => {
    const x = (clientX / window.innerWidth) * 100;
    const y = (clientY / window.innerHeight) * 100;
    updateMask(x, y);
  };

  updateMask(50, 50);

  window.addEventListener('mousemove', (e) => updateFromPoint(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    updateFromPoint(touch.clientX, touch.clientY);
  }, { passive: true });
}

function setupBentoPointerGlow() {
  const cards = document.querySelectorAll('[data-home-root] .statux-card');
  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--x', `${x}%`);
      card.style.setProperty('--y', `${y}%`);
    });
  });
}

async function loadHomeNovedades() {
  const cards = document.querySelectorAll('[data-home-root] .statux-card');
  if (!cards.length) return;

  try {
    const response = await fetch('data/home-novedades.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`No se pudo cargar novedades (${response.status})`);
    const data = await response.json();

    cards.forEach((card) => {
      const id = Number(card.dataset.id);
      const item = data.find((entry) => Number(entry.id) === id);
      if (!item) return;

      const title = card.querySelector('.title');
      const desc = card.querySelector('.desc');
      const icon = card.querySelector('.icon-placeholder img');
      const bg = card.querySelector('.card-bg');

      if (title) title.textContent = item.title || '';

      if (desc) {
        if (item.desc) {
          desc.textContent = item.desc;
          desc.hidden = false;
        } else {
          desc.hidden = true;
        }
      }

      if (icon && item.icon) {
        icon.src = item.icon;
        icon.alt = item.title ? `Icono ${item.title}` : 'Icono de novedad';
      }

      if (bg && item.bg) {
        bg.src = item.bg;
        bg.alt = item.title ? `Fondo ${item.title}` : '';
      }
    });
  } catch (error) {
    console.error(error);
  }
}

async function loadHomeSection() {
  const target = document.querySelector('[data-home-root]');
  if (!target) return;

  try {
    const response = await fetch('home.html', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`No se pudo cargar Home (${response.status})`);

    const html = await response.text();
    target.innerHTML = html;
    setupHomeScanner();
    setupBentoPointerGlow();
    await loadHomeNovedades();
    setFooterReadyState(true);
  } catch (error) {
    target.innerHTML = '<p class="home-loading-error">No se pudo cargar la sección Home.</p>';
    setFooterReadyState(true);
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setFooterReadyState(false);
  loadHomeSection();
});
