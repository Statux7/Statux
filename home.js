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



// === STATUX MODALES: Offline y Confirmación ===
(function(){
  // 1. OFFLINE MODAL
  function ensureOfflineModal() {
    let modal = document.getElementById('stx-offline-modal');
    if (modal) return modal;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="stx-offline-modal" class="stx-modal stx-invisible">
        <div class="stx-modal-overlay" tabindex="-1"></div>
        <div class="stx-modal-box" role="dialog" aria-labelledby="stx-offline-title" aria-modal="true">
          <button class="stx-modal-close" id="stx-offline-close" aria-label="Cerrar">
            <img src="Logout.svg" alt="Cerrar">
          </button>
          <h2 id="stx-offline-title">Modo Offline</h2>
          <p>Statux funciona sin conexión, tus códigos y datos se mantienen seguros en tu dispositivo.</p>
          <label class="stx-switch">
            <input type="checkbox" id="stx-offline-toggle">
            <span class="stx-slider"></span>
            Habilitar modo offline
          </label>
        </div>
      </div>`;
    modal = wrapper.firstElementChild;
    if (modal) document.body.appendChild(modal);
    return modal;
  }
  function getOfflineModal() {
    return document.getElementById('stx-offline-modal') || ensureOfflineModal();
  }
  function openOfflineModal() {
    const offlineModal = getOfflineModal();
    if (!offlineModal) return false;
    const chk = document.getElementById('stx-offline-toggle');
    if (chk) chk.checked = localStorage.getItem('stx:offline-mode') === '1';
    offlineModal.classList.remove('stx-invisible');
    setTimeout(()=>offlineModal.classList.add('stx-active'),10);
    const url = new URL(window.location.href);
    url.searchParams.set('modal', 'offline');
    window.history.pushState({}, '', url);
    return true;
  }
  function closeOfflineModal() {
    const offlineModal = getOfflineModal();
    if (!offlineModal) return;
    offlineModal.classList.remove('stx-active');
    setTimeout(()=>offlineModal.classList.add('stx-invisible'),170);
    const url = new URL(window.location.href);
    url.searchParams.delete('modal');
    window.history.replaceState({}, '', url);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#settingsAdvancedBtn')) {
      e.preventDefault();
      e.stopPropagation();
      openOfflineModal();
      return;
    }
    if (e.target.closest('#stx-offline-close') || e.target.closest('#stx-offline-modal .stx-modal-overlay')) {
      closeOfflineModal();
    }
  });
  document.addEventListener('change', (e) => {
    if (!e.target.matches('#stx-offline-toggle')) return;
    const enabled = !!e.target.checked;
    localStorage.setItem('stx:offline-mode', enabled ? '1' : '0');
  });
  document.addEventListener('keydown',function(e){
    const offlineModal = getOfflineModal();
    if (e.key === 'Escape' && offlineModal?.classList.contains('stx-active')) {
      closeOfflineModal();
    }
  });

  // 2. MODAL CONFIRMACIÓN ELIMINAR CÓDIGO
  ready(() => {
    const confirmModal = document.getElementById('stx-confirm-modal');
    if (!confirmModal) return;
    const btnClose = document.getElementById('stx-confirm-close');
    const overlay = confirmModal?.querySelector('.stx-modal-overlay');
    const btnCancel = document.getElementById('stx-confirm-cancel');
    const btnAccept = document.getElementById('stx-confirm-accept');
    let confirmDeleteCodeId = null;
    const codesContainer = document.getElementById('codes');
    if (codesContainer) {
      const el = codesContainer.querySelector(`[data-stx-id=\"${confirmDeleteCodeId}\"]`);
      if(el) el.remove();
    }
    function openConfirmModal(codeId) {
      confirmDeleteCodeId = codeId;
      confirmModal.classList.remove('stx-invisible');
      setTimeout(()=>confirmModal.classList.add('stx-active'),10);
      const url = new URL(window.location.href);
      url.searchParams.set('modal', 'confirm-delete');
      window.history.pushState({}, '', url);
    }
    function closeConfirmModal() {
      confirmModal.classList.remove('stx-active');
      setTimeout(()=>confirmModal.classList.add('stx-invisible'),180);
      confirmDeleteCodeId = null;
      const url = new URL(window.location.href);
      url.searchParams.delete('modal');
      window.history.replaceState({}, '', url);
    }
    if (e.target.closest('#stx-confirm-accept')) {
      acceptConfirmDelete();
    }
  });
  document.addEventListener('keydown', function(e){
    const confirmModal = getConfirmModal();
    if (e.key === 'Escape' && confirmModal?.classList.contains('stx-active')) {
      closeConfirmModal();
    }
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  setFooterReadyState(false);
  loadHomeSection();
});
