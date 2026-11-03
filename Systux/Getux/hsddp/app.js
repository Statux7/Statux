/**
 * app.js — Inicialización y orquestación principal
 */
/* global Logs, User, el, setText, Router, Dashboard, Habitos, Calandrier */

document.addEventListener('DOMContentLoaded', () => {
  // Purge old logs on startup
  Logs.purgeOld(60);

  const username = User.get();
  const gender = User.getGender();

  if (!username || !gender) {
    showWelcomeScreen();
  } else {
    startApp(username);
  }
});

/* ============================================
   WELCOME SCREEN (paso 1: nombre, paso 2: género)
   ============================================ */
function showWelcomeScreen() {
  const screenWelcome = el('screen-welcome');
  const screenApp = el('screen-app');

  if (screenWelcome) screenWelcome.classList.add('active');
  if (screenApp) screenApp.classList.remove('active');

  // Si ya hay nombre pero falta género (caso de usuarios existentes tras la
  // actualización), saltamos directo al paso de género.
  const existingName = User.get();
  if (existingName) {
    showGenderStep(existingName);
    return;
  }

  showNameStep();
}

function showNameStep() {
  setText('welcome-step-title', '¿Cómo te llamas?');
  show('welcome-step-name');
  hide('welcome-step-gender');

  const input = el('welcome-name-input');
  const submit = el('welcome-submit');

  if (input && submit) {
    input.addEventListener('input', () => {
      submit.disabled = input.value.trim().length < 2;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !submit.disabled) submit.click();
    });

    submit.addEventListener('click', () => {
      const name = input.value.trim();
      if (name.length < 2) return;
      User.set(name);
      showGenderStep(name);
    });
  }

  // Focus input
  if (input) setTimeout(() => input.focus(), 100);
}

function showGenderStep(name) {
  hide('welcome-step-name');
  show('welcome-step-gender');
  setText('welcome-step-title', `Un detalle más, ${name}`);

  const btnMale = el('welcome-gender-male');
  const btnFemale = el('welcome-gender-female');

  const choose = (gender) => {
    User.setGender(gender);
    startApp(name);
  };

  if (btnMale) btnMale.onclick = () => choose('male');
  if (btnFemale) btnFemale.onclick = () => choose('female');
}

/* ============================================
   START APP
   ============================================ */
function startApp(username) {
  const screenWelcome = el('screen-welcome');
  const screenApp = el('screen-app');

  if (screenWelcome) screenWelcome.classList.remove('active');
  if (screenApp) screenApp.classList.add('active');

  // Set username in sidebar
  setText('sidebar-username', username);

  // Init router (which renders current page)
  Router.init();

  // Mobile sidebar toggle
  initMobileSidebarToggle();
}


function initMobileSidebarToggle() {
  const btn = el('mobile-sidebar-toggle');
  const screenApp = el('screen-app');
  if (!btn || !screenApp) return;

  const setExpanded = (expanded) => {
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.setAttribute('aria-label', expanded ? 'Ocultar menú' : 'Mostrar menú');
    btn.textContent = expanded ? '✕' : '☰';
  };

  btn.addEventListener('click', () => {
    const expanded = screenApp.classList.toggle('sidebar-open');
    setExpanded(expanded);
  });

  // Close sidebar on nav click in mobile
  document.addEventListener('click', (e) => {
    const navLink = e.target.closest('.nav-link');
    if (!navLink) return;
    if (window.innerWidth <= 768) {
      screenApp.classList.remove('sidebar-open');
      setExpanded(false);
    }
  });

  // Reset on desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      screenApp.classList.remove('sidebar-open');
      setExpanded(false);
    }
  });

  setExpanded(false);
}
