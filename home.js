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

async function loadHomeSection() {
  const target = document.querySelector('[data-home-root]');
  if (!target) return;

  try {
    const response = await fetch('home.html', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`No se pudo cargar Home (${response.status})`);

    const html = await response.text();
    target.innerHTML = html;
    setupHomeScanner();
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
