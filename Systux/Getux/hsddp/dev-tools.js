/**
 * dev-tools.js — Herramientas SOLO para entornos de desarrollo.
 * Inerte en producción. Ver reglas de activación en isDevHost.
 */
/* global Habits, Logs, save, KEYS, todayStr, subDays, isHabitDue, countsForProgress */

const DevTools = (() => {
  const OFF_KEY = 'habitos_dev_off';
  const OFFSET_KEY = 'habitos_dev_offset';

  const host = location.hostname;
  const isDevHost =
    host === '' || host === 'localhost' || host === '127.0.0.1' ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    host.includes('--');

  try {
    const params = new URLSearchParams(location.search);
    if (params.get('dev') === '0') localStorage.setItem(OFF_KEY, '1');
    if (params.get('dev') === '1') localStorage.removeItem(OFF_KEY);
  } catch (e) { /* sin localStorage: se ignora */ }

  let off = false;
  try { off = localStorage.getItem(OFF_KEY) === '1'; } catch (e) { /* noop */ }
  const enabled = isDevHost && !off;

  /* Días simulados hacia adelante (0 = hoy real) */
  function dayOffset() {
    if (!enabled) return 0;
    try { return parseInt(localStorage.getItem(OFFSET_KEY) || '0', 10) || 0; }
    catch (e) { return 0; }
  }

  function refreshApp() {
    if (typeof Logs !== 'undefined') {
      if (typeof Logs.closePastDays === 'function') Logs.closePastDays();
      if (typeof Logs.snapshotToday === 'function') Logs.snapshotToday();
    }
    window.dispatchEvent(new Event('hashchange'));   // re-renderiza la página actual
    updateNote();
  }

  /* Siembra historial falso sobre los hábitos existentes.
   * - Retrasa created_date de todos los hábitos para que tengan antigüedad.
   * - Crea un log por cada día pasado con cumplimiento aleatorio.
   * - En unhábits genera recaídas aleatorias (≈12% de los días). */
  function seedHistory(days = 14, rate = 0.65) {
    const habits = Habits.list();
    if (!habits.length) {
      alert('DEV: crea al menos un hábito antes de sembrar historial.');
      return false;
    }
    const today = todayStr();

    const back = new Date();
    back.setDate(back.getDate() + dayOffset() - (days + 1));
    const backISO = back.toISOString();

    const dates = [];
    for (let i = days; i >= 1; i--) dates.push(subDays(today, i));

    const patched = habits.map(h => {
      const copy = { ...h, created_date: backISO };
      if (h.type === 'unhabit') {
        const relapses = dates.filter(() => Math.random() < 0.12);
        copy.type_data = { ...(h.type_data || {}), relapse_dates: relapses };
      }
      return copy;
    });
    save(KEYS.HABITS, patched);

    const countable = h => (typeof countsForProgress === 'function') ? countsForProgress(h) : true;
    const newLogs = dates.map(date => {
      const due = patched.filter(h => h.active && countable(h) && isHabitDue(h, date));
      const names = {};
      due.forEach(h => { names[h.id] = h.name; });
      return {
        date,
        completed_habits: due.filter(() => Math.random() < rate).map(h => h.id),
        total_habits: due.length,
        scheduled_habits: due.map(h => h.id),
        names,
      };
    });
    const kept = Logs.list().filter(l => !dates.includes(l.date));
    save(KEYS.LOGS, [...kept, ...newLogs].sort((a, b) => a.date.localeCompare(b.date)));
    refreshApp();
    return true;
  }

  function clearHistory() {
    save(KEYS.LOGS, []);
    refreshApp();
  }

  function advanceDay(n = 1) {
    try { localStorage.setItem(OFFSET_KEY, String(Math.max(0, dayOffset() + n))); } catch (e) { /* noop */ }
    refreshApp();
  }

  function resetDay() {
    try { localStorage.removeItem(OFFSET_KEY); } catch (e) { /* noop */ }
    refreshApp();
  }

  function resetAll() {
    if (!confirm('DEV: ¿borrar TODOS los datos de este entorno?')) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith('habitos_') && k !== OFF_KEY)
      .forEach(k => localStorage.removeItem(k));
    location.hash = '';
    location.reload();
  }

  /* ── Panel flotante ── */
  function updateNote() {
    const note = document.getElementById('dev-day-note');
    if (!note || typeof todayStr !== 'function') return;
    const off = dayOffset();
    note.textContent = off > 0
      ? `Fecha simulada: ${todayStr()} (+${off})`
      : `Fecha: ${todayStr()} (real)`;
  }

  function buildPanel() {
    if (!enabled || document.getElementById('dev-panel')) return;
    const wrap = document.createElement('div');
    wrap.id = 'dev-panel';
    wrap.className = 'dev-panel';
    wrap.innerHTML = `
      <div class="dev-menu hidden" id="dev-menu">
        <p class="dev-title">HERRAMIENTAS DEV</p>
        <p class="dev-note" id="dev-day-note"></p>
        <button type="button" class="dev-btn" data-dev="seed14">Sembrar 14 días</button>
        <button type="button" class="dev-btn" data-dev="seed30">Sembrar 30 días</button>
        <button type="button" class="dev-btn" data-dev="clear">Limpiar historial</button>
        <button type="button" class="dev-btn" data-dev="day-plus">Avanzar 1 día</button>
        <button type="button" class="dev-btn" data-dev="day-real">Volver a hoy real</button>
        <button type="button" class="dev-btn dev-btn-danger" data-dev="reset">Reset total</button>
        <p class="dev-note">Análisis siempre desbloqueado. Añade ?dev=0 a la URL para probar el comportamiento real.</p>
      </div>
      <button type="button" class="dev-pill" id="dev-pill">DEV</button>`;
    document.body.appendChild(wrap);

    document.getElementById('dev-pill').addEventListener('click', () => {
      document.getElementById('dev-menu').classList.toggle('hidden');
      updateNote();
    });

    wrap.querySelectorAll('[data-dev]').forEach(btn => {
      btn.addEventListener('click', () => {
        switch (btn.dataset.dev) {
          case 'seed14': seedHistory(14); break;
          case 'seed30': seedHistory(30); break;
          case 'clear': clearHistory(); break;
          case 'day-plus': advanceDay(1); break;
          case 'day-real': resetDay(); break;
          case 'reset': resetAll(); break;
        }
      });
    });
    updateNote();
  }

  document.addEventListener('DOMContentLoaded', buildPanel);

  return { enabled, dayOffset, seedHistory, clearHistory, advanceDay, resetDay, resetAll };
})();