/**
 * router.js — SPA router con hash routing
 */

const Router = (() => {
  const routes = {
    dashboard: () => { Dashboard.render(); },
    habitos: () => { Habitos.render(); },
    calandrier: () => { Calandrier.render(); },
  };

  function navigate(page) {
    // Update hash
    window.location.hash = page;
  }

  function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const page = routes[hash] ? hash : 'dashboard';

    // Update nav links
    qsa('.nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.page === page);
    });

    // Show/hide pages
    qsa('.page').forEach(p => p.classList.remove('active'));
    const pageEl = el('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    // Run page renderer
    if (routes[page]) routes[page]();
  }

  function init() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // Nav link clicks
    qsa('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.dataset.page);
      });
    });

    // Inline links like href="#habitos"
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a && !a.classList.contains('nav-link')) {
        e.preventDefault();
        const target = a.getAttribute('href').replace('#', '');
        if (routes[target]) navigate(target);
      }
    });

    // Modal close buttons - MEJORADO con mejor delegación de eventos
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-close]');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        closeModal(btn.dataset.close);
      }
    });

    // Close modal on overlay click
    qsa('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
  }

  return { init, navigate };
})();
