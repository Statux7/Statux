function stxTypeLabel(type) {
  const labels = {
    ebootux: 'Ebootux · Curso',
    getux: 'Getux · Guía',
    plantitux: 'Plantitux · Plantilla',
    movitux: 'Movitux · Prompt',
    custom: 'Mi enlace'
  };
  return labels[type] || 'Statux';
}

function stxRenderDashboardCards() {
  const track = document.getElementById('track');
  const emptyState = document.getElementById('carruselEmpty');
  if (!track) return;

  const raw = localStorage.getItem('stx_dashboard_cards');
  let cards = [];
  try { cards = JSON.parse(raw) || []; } catch { cards = []; }

  if (emptyState) {
    emptyState.style.display = cards.length === 0 ? 'flex' : 'none';
  }

  track.innerHTML = '';
  if (cards.length === 0) return;

  cards.forEach(cardData => {
    const div = document.createElement('div');
    div.className = 'card';

    if (cardData.dataAttrs) {
      Object.entries(cardData.dataAttrs).forEach(([attr, value]) => {
        div.setAttribute(attr, value);
      });
    }

    div.innerHTML = `
      <img src="${cardData.image || 'Statux-logo(SVG).svg'}"
           alt="${cardData.title}"
           onerror="this.src='Statux-logo(SVG).svg'">
      <h3>${cardData.title}</h3>
      <p>${stxTypeLabel(cardData.type)}</p>
      <button class="stx-dashboard-enter-btn" type="button"
        data-card-type="${cardData.type}"
        data-card-title="${cardData.title}"
        data-course-url="${cardData.courseUrl || ''}"
        data-prompt="${cardData.prompt || ''}">
        <img src="Login.svg" alt="Entrar"> Entrar
      </button>
    `;

    track.appendChild(div);
  });

  if (typeof window.stxReinitCarousel === 'function') {
    window.stxReinitCarousel();
  }
}

function stxBindCarouselEnterButtons() {
  const track = document.getElementById('track');
  if (!track) return;

  track.addEventListener('click', (e) => {
    const btn = e.target.closest('.stx-dashboard-enter-btn');
    if (!btn) return;

    const type = btn.dataset.cardType || '';
    const courseUrl = (btn.dataset.courseUrl || '').trim();
    const title = (btn.dataset.cardTitle || '').trim();

    if (type === 'custom') {
      if (courseUrl) {
        window.open(courseUrl, '_blank', 'noopener');
      }
      return;
    }

    if (type === 'ebootux' || type === 'getux') {
      const originalCard = document.querySelector(
        `.ebootux-cards[data-ebootux-title="${CSS.escape(title)}"]`
      );
      if (originalCard) {
        const enterBtn = originalCard.querySelector('.btn-acceder-ebootux');
        if (enterBtn) { enterBtn.click(); return; }
      }
      if (courseUrl) window.location.href = courseUrl;
      return;
    }

    const originalCard = document.querySelector(
      `.plantitux-cards[data-title="${CSS.escape(title)}"],
       .movitux-cards[data-title="${CSS.escape(title)}"]`
    );
    if (originalCard) {
      const enterBtn = originalCard.querySelector('.btn-acceder-plantitux');
      if (enterBtn) enterBtn.click();
    }
  });
}


async function loadDashboardSection() {
  const root = document.getElementById('dashboard-root');
  if (!root || root.querySelector('.dashboard')) return;

  if (!document.querySelector('link[href="Dashboard/dashboard.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'Dashboard/dashboard.css';
    document.head.appendChild(link);
  }

  try {
    const fetchOptions = navigator.onLine
      ? { cache: 'no-cache' }
      : { cache: 'force-cache' };

    const response = await fetch('Dashboard/dashboard.html', fetchOptions);
    if (!response.ok) throw new Error(`Error cargando dashboard: ${response.status}`);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const dashboardSection = doc.querySelector('.dashboard');

    if (!dashboardSection) throw new Error('No se encontró .dashboard en el HTML');

    root.appendChild(dashboardSection);

    const nameEl = root.querySelector('.user-name');
    const storedName = localStorage.getItem('stx_dashboard_name') || 'Usuario';
    if (nameEl) {
      nameEl.textContent = storedName;
    }

    const welcomeLabel = root.querySelector('.welcome-label');
    if (welcomeLabel) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Buenos días,' : hour < 19 ? 'Buenas tardes,' : 'Buenas noches,';
      welcomeLabel.textContent = greeting;
    }

    stxRenderDashboardCards();
    stxBindCarouselEnterButtons();

    if (!document.querySelector('script[src="Dashboard/dashboard.js"]')) {
      const script = document.createElement('script');
      script.src = 'Dashboard/dashboard.js';
      document.body.appendChild(script);
    }
  } catch (error) {
    root.innerHTML = '<p style="color:#777;text-align:center;padding:40px;">No se pudo cargar el dashboard.</p>';
    console.error(error);
  }
}
