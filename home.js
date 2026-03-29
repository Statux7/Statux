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

function setupExploreWindow() {
  const root = document.querySelector('[data-home-root]');
  if (!root) return;
  const tabs = root.querySelectorAll('.explore-window');
  const title = root.querySelector('#title');
  const text1 = root.querySelector('#text1');
  const text2 = root.querySelector('#text2');
  if (!tabs.length || !title || !text1 || !text2) return;

  const content = {
    systux: {
      title: 'Systux',
      text1: 'Sistemas interactivos diseñados para ejecutarse, no solo leerse.',
      text2: 'Experiencias dinámicas con lógica propia que elevan el nivel del usuario.'
    },
    templux: {
      title: 'Templux',
      text1: 'Estructuras listas para usar sin fricción.',
      text2: 'Plantillas inteligentes que convierten ideas en productos rápidos.'
    }
  };

  let current = 'systux';
  let interval;

  const switchTab = (tab) => {
    const block = content[tab];
    if (!block) return;
    current = tab;
    title.textContent = block.title;
    text1.textContent = block.text1;
    text2.textContent = block.text2;
    tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  };

  const startAutoSwitch = () => {
    clearInterval(interval);
    interval = setInterval(() => {
      current = current === 'systux' ? 'templux' : 'systux';
      switchTab(current);
    }, 4000);
  };

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      startAutoSwitch();
    });
  });

  switchTab(current);
  startAutoSwitch();
}

let floatingLinesIntervalId = null;

function setupFloatingLines() {
  const lines = document.querySelectorAll('[data-home-root] .floating-line');
  if (!lines.length) return;

  const phrases = [
    '<span class="tag">Domina</span> <span class="attr">el</span> <span class="val">sistema</span>.',
    '<span class="tag">No</span> <span class="attr">consumas</span>, <span class="val">construye</span>.',
    '<span class="tag">Menos</span> <span class="attr">ruido</span>, <span class="val">más control</span>.',
    '<span class="tag">Diseña</span> <span class="attr">tu</span> <span class="val">ventaja</span>.'
  ];

  const updateText = () => {
    lines.forEach((line) => {
      line.classList.add('fade');
      setTimeout(() => {
        const random = phrases[Math.floor(Math.random() * phrases.length)];
        line.innerHTML = random;
        line.classList.remove('fade');
      }, 300);
    });
  };

  if (floatingLinesIntervalId) {
    clearInterval(floatingLinesIntervalId);
    floatingLinesIntervalId = null;
  }

  updateText();
  floatingLinesIntervalId = setInterval(updateText, 4000);
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
    setupExploreWindow();
    setupFloatingLines();
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
