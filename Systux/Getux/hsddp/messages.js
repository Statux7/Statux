/* Centro de mensajes: eventos diarios, recordatorios y rotación del dashboard. */
/* global Habits, Tasks, Blocks, Logs, User, todayStr, subDays, isHabitDue,
   getDayProgress, getDaysRemainingToMaturity, hasMaturity, calculateConsistency,
   getDomainLevel, IdentityReport, el */
const MessageCenter = (() => {
  const KEY = 'habitos_message_state';
  let carousel = [];
  let index = 0;
  let timer = null;
  let listening = false;

  function readState() {
    const defaults = { lastVisit: '', daily: {}, domainLevel: null, events: {} };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY)) || {};
      return { ...defaults, ...saved, daily: saved.daily || {}, events: saved.events || {} };
    } catch { return defaults; }
  }
  function saveState(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { console.warn('No se pudo guardar el estado de mensajes.', err); }
  }
  function push(list, id, text, tone = 'info') {
    if (text && !list.some(item => item.id === id)) list.push({ id, text, tone });
  }
  function rate(date, logs, habits) {
    const log = logs.find(item => item.date === date);
    const due = habits.filter(h => h.active && !['unhabit', 'habitod'].includes(h.type) && isHabitDue(h, date));
    return { log, due, pct: getDayProgress(log, due) };
  }
  function closeOfDay(date, logs, habits) {
    const out = [];
    const day = rate(date, logs, habits);
    if (day.log && day.due.length) {
      if (day.pct >= 80) push(out, 'perfect:' + date, `Informe técnico: la jornada del ${date} cerró con ${day.pct}% de consistencia.`, 'positive');
      else if (day.pct < 40) push(out, 'low:' + date, `Diagnóstico: la jornada del ${date} cerró con ${day.pct}%. Hoy puedes retomar con un paso pequeño.`, 'alert');
    }
    if (new Date(date + 'T12:00:00').getDay() === 0) {
      let best = null;
      for (let n = 1; n <= 7; n++) {
        const candidateDate = subDays(date, n), candidate = rate(candidateDate, logs, habits);
        if (candidate.log && candidate.due.length && (!best || candidate.pct > best.pct)) best = { date: candidateDate, pct: candidate.pct };
      }
      if (best) {
        const weekday = new Date(best.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' });
        push(out, 'weekly-best:' + date, `Balance semanal: tu mejor día fue ${weekday}, con ${best.pct}% de progreso.`, 'positive');
      }
    }
    return out;
  }
  function makeDaily(state, logs, habits, today) {
    if (state.lastVisit !== today) {
      const start = state.lastVisit ? subDays(state.lastVisit, -1) : subDays(today, 1);
      let date = start > today ? today : start;
      const min = subDays(today, 7);
      if (date < min) date = min;
      const daily = [];
      while (date < today) {
        daily.push(...closeOfDay(date, logs, habits));
        date = subDays(date, -1);
      }
      state.daily[today] = daily;
      state.lastVisit = today;
      Object.keys(state.daily).forEach(key => { if (key !== today) delete state.daily[key]; });
    }
  }
  function live(logs, habits, tasks, today) {
    const out = [], now = new Date(), minute = now.getHours() * 60 + now.getMinutes();
    if (hasMaturity(logs, habits, 2)) {
      const recent = calculateConsistency(logs, habits, 3), baseline = calculateConsistency(logs, habits, 7);
      if (baseline > 0 && recent < baseline - 20) push(out, 'decline:' + today, `⚠ Descenso de consistencia: ${baseline}% → ${recent}%.`, 'alert');
    }
    habits.filter(h => h.active && !['unhabit', 'habitod'].includes(h.type)).forEach(h => {
      const age = h.created_date ? Math.floor((Date.now() - new Date(h.created_date).getTime()) / 86400000) : 0;
      if (age < 7) return;
      let due = 0, done = 0;
      for (let n = 0; n < Math.min(age, 30); n++) {
        const date = subDays(today, n);
        if (!isHabitDue(h, date)) continue;
        due++;
        const log = logs.find(item => item.date === date);
        const frozen = log && log.frozen_habit_rates;
        if (frozen && Object.prototype.hasOwnProperty.call(frozen, h.id)
          ? frozen[h.id] === 1
          : log && (log.completed_habits || []).includes(h.id)) done++;
      }
      if (due >= 3 && done / due < 0.25) push(out, 'calibration:' + h.id,
        `Sugerencia de calibración: “${h.name}” registra menos de 25% de cumplimiento. Prueba reducir su dificultad o cambiar su horario.`, 'alert');
    });
    if (minute >= 1110) Blocks.list().forEach(block => {
      const important = habits.filter(h => h.active && h.block_id === block.id && !['unhabit', 'habitod'].includes(h.type) &&
        ['critical', 'high'].includes(h.priority) && isHabitDue(h, today));
      const log = logs.find(item => item.date === today), done = new Set(log ? log.completed_habits || [] : []);
      if (important.length && !important.some(h => done.has(h.id))) push(out, 'inactive:' + block.id + ':' + today,
        `Control de tiempo: “${block.name}” sigue sin actividad y tiene rutinas prioritarias pendientes.`, 'alert');
    });
    if (now.getDay() === 5 && minute >= 960) habits.filter(h => h.active && h.type === 'unhabit' && ['critical', 'high'].includes(h.priority))
      .forEach(h => push(out, 'weekend:' + h.id + ':' + today, `Fin de semana crítico: protege tu avance frente a “${h.name}”.`, 'alert'));
    habits.filter(h => h.active && h.type === 'habitod').forEach(h => {
      const data = h.type_data || {}, interval = Math.max(1, Number(data.every_days) || 7);
      const anchor = data.last_triggered_date || (h.created_date || today).slice(0, 10);
      const elapsed = Math.floor((new Date(today + 'T12:00:00') - new Date(anchor + 'T12:00:00')) / 86400000);
      if ((elapsed >= interval || anchor === today) && (!data.pending_until || today <= data.pending_until))
        push(out, 'habitod:' + h.id + ':' + today, data.message || `Es hoy el Habitód “${h.name}”.`);
    });
    habits.filter(h => h.active && h.type === 'habitor').forEach(h => {
      const data = h.type_data || {}, item = (data.items || []).find(entry => entry.id === data.current_item_id);
      if (item) push(out, 'habitor:' + h.id + ':' + today, `Ítem del día para “${h.name}”: ${item.label}.`);
    });
    tasks.filter(task => task.due_date === today && !task.completed)
      .forEach(task => push(out, 'task:' + task.id + ':' + today, `Es hoy la tarea “${task.name}”.`));

    if (new Date(today + 'T12:00:00').getDay() === 5 && minute >= 960) {
      // Friday context remains active only while it is Friday afternoon.
    }

    const state = readState(), sent = state.unhabitMilestones || {};
    const anchorSent = state.goldenAnchor || {};
    habits.filter(h => h.active && h.type === 'unhabit').forEach(h => {
      const cleanDays = Habits.cleanDays(h.id), dates = (h.type_data && h.type_data.relapse_dates) || [];
      const cycle = dates.length ? dates[dates.length - 1] : 'start';
      [3, 7, 15, 30, 60, 90].forEach(mark => {
        const id = h.id + ':' + cycle + ':' + mark;
        if (cleanDays >= mark && !sent[id]) {
          sent[id] = today;
          push(out, 'unhabit:' + id, `Escudo operativo: llevas ${cleanDays} días limpios de “${h.name}”.`, 'positive');
        }
      });
    });
    state.unhabitMilestones = sent;
    saveState(state);

    Blocks.list().forEach(block => {
      let streak = 0;
      for (let n = 0; n < 60; n++) {
        const date = subDays(today, n);
        const due = habits.filter(h => h.active && h.block_id === block.id && !['unhabit', 'habitod'].includes(h.type) && isHabitDue(h, date));
        if (!due.length) continue;
        const log = logs.find(item => item.date === date), done = new Set(log ? log.completed_habits || [] : []);
        const complete = h => {
          const rates = log && log.frozen_habit_rates;
          return rates && Object.prototype.hasOwnProperty.call(rates, h.id)
            ? rates[h.id] === 1
            : done.has(h.id);
        };
        if (!due.every(complete)) break;
        streak++;
      }
      [3, 7, 15].forEach(mark => {
        if (streak === mark) push(out, 'block:' + block.id + ':' + mark + ':' + today,
          `Racha de bloque: “${block.name}” completó ${mark} días al 100%.`, 'positive');
      });
    });

    const identityReport = typeof IdentityReport !== 'undefined' ? IdentityReport.get() : null;
    const report = el('identity-report-text');
    if (identityReport && identityReport.lastShown === today && report && report.textContent)
      push(out, 'identity-report:' + today, report.textContent, 'positive');

    // Golden Anchor: strongest active habit over the last month.
    let best = null;
    habits.filter(h => h.active && !['unhabit', 'habitod'].includes(h.type)).forEach(h => {
      let due = 0, done = 0;
      for (let n = 0; n < 30; n++) {
        const date = subDays(today, n);
        if (!isHabitDue(h, date)) continue;
        due++;
        const log = logs.find(item => item.date === date);
        const frozen = log && log.frozen_habit_rates;
        if (frozen && Object.prototype.hasOwnProperty.call(frozen, h.id)
          ? frozen[h.id] === 1
          : log && (log.completed_habits || []).includes(h.id)) done++;
      }
      const ratio = due ? done / due : 0;
      if (ratio > 0 && (!best || ratio > best.ratio)) best = { habit: h, ratio };
    });
    const monthKey = today.slice(0, 7);
    if (best && !anchorSent[monthKey]) {
      anchorSent[monthKey] = today;
      push(out, 'anchor:' + monthKey, `Ancla dorada: “${best.habit.name}” es tu hábito más consistente del último mes (${Math.round(best.ratio * 100)}%).`, 'positive');
    }
    state.goldenAnchor = anchorSent;
    state.unhabitMilestones = sent;
    saveState(state);

    return out;
  }
  function collect(logs, habits, tasks) {
    const today = todayStr(), state = readState();
    makeDaily(state, logs, habits, today);
    const level = getDomainLevel(calculateConsistency(logs, habits, 7)).level;
    state.daily[today] = state.daily[today] || [];
    if (state.domainLevel !== null && level > state.domainLevel)
      state.daily[today].push({ id: 'level:' + today, text: `⚡ Nivel de Dominio Incrementado: ascendiste al nivel ${level}/5.`, tone: 'positive' });
    state.domainLevel = level;
    saveState(state);

    const result = [...(state.daily[today] || []), ...live(logs, habits, tasks, today)];
    Object.values(state.events[today] || {}).forEach(event => result.push(event));
    const unique = [];
    result.forEach(item => push(unique, item.id, item.text, item.tone));
    if (!unique.length && !hasMaturity(logs, habits, 2))
      push(unique, 'maturity:' + today, getDaysRemainingToMaturity(logs, habits).message);
    if (!unique.length) push(unique, 'none:' + today, 'Sin alertas activas.');
    return unique;
  }
  function install() {
    if (listening || typeof window === 'undefined') return;
    listening = true;
    window.addEventListener('habits:toggle', event => {
      const detail = event.detail || {};
      if (detail.date !== todayStr()) return;
      const habit = Habits.find(detail.habitId);
      if (!habit || habit.difficulty !== 'extreme') return;
      const state = readState(); state.events[todayStr()] = state.events[todayStr()] || {};
      const key = 'extreme:' + habit.id;
      if (detail.completed) state.events[todayStr()][key] = {
        id: key, text: `Excelente: completaste “${habit.name}”, de dificultad extrema.`, tone: 'positive'
      };
      else delete state.events[todayStr()][key];
      saveState(state);
      render();
    });
    window.addEventListener('tasks:toggle', () => render());
  }
  function render(logs = Logs.list(), habits = Habits.list(), tasks = Tasks.list()) {
    install();
    carousel = collect(logs, habits, tasks);
    index = carousel.length ? index % carousel.length : 0;
    const list = el('alerts-list');
    if (!list) return;
    let next = el('alerts-next');
    if (!next) {
      next = document.createElement('button');
      next.id = 'alerts-next'; next.className = 'alerts-next'; next.type = 'button'; next.textContent = 'Siguiente mensaje';
      list.insertAdjacentElement('afterend', next);
    }
    next.classList.toggle('hidden', carousel.length < 2);
    next.onclick = () => { index = (index + 1) % carousel.length; draw(); };
    function draw() {
      list.replaceChildren();
      const message = carousel[index];
      if (!message) return;
      const item = document.createElement('div');
      item.className = message.tone === 'alert' ? 'alert-item' : 'maturity-msg';
      item.textContent = message.text;
      list.appendChild(item);
    }
    draw();
    if (!timer) timer = setInterval(() => {
      carousel = collect(Logs.list(), Habits.list(), Tasks.list());
      index = carousel.length ? (index + 1) % carousel.length : 0;
      draw();
      next.classList.toggle('hidden', carousel.length < 2);
    }, 5000);
  }
  return { render };
})();
