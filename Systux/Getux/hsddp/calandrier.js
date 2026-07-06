/**
 * calandrier.js — Vista de calendario mensual
 */
/* global el, setText, Habits, Tasks, Logs, getDateStr, todayStr, calculateConsistency, getOperationalStatus, getTrend, getActiveHabitsForDate, openModal, closeModal */

const Calandrier = (() => {
  let currentMonth = new Date();
  currentMonth.setDate(1);

  const MONTH_NAMES_ES = [
    'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
    'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'
  ];

  function render() {
    bindNavButtons();
    renderCalendar();
  }

  function bindNavButtons() {
    const prev = el('cal-prev');
    const next = el('cal-next');
    if (prev) prev.onclick = () => { shiftMonth(-1); };
    if (next) next.onclick = () => { shiftMonth(1); };
  }

  function shiftMonth(dir) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + dir, 1);
    renderCalendar();
  }

  function renderCalendar() {
    const habits = Habits.list();
    const tasks = Tasks.list();
    const logs = Logs.list();

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const monthName = MONTH_NAMES_ES[month] + ' ' + year;
    const prevName = MONTH_NAMES_ES[(month + 11) % 12];
    const nextName = MONTH_NAMES_ES[(month + 1) % 12];

    setText('cal-month-name', monthName);
    setText('cal-prev-name', prevName);
    setText('cal-next-name', nextName);

    // Stats
    const consistency = calculateConsistency(logs, habits, 7);
    const status = getOperationalStatus(consistency);
    const trend = getTrend(logs, habits);
    setText('cal-consistency', consistency + '%');
    setText('cal-status', status.label);
    setText('cal-trend', trend.symbol);

    // Build grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayDate = new Date();
    const todayDateStr = getDateStr(todayDate);

    const grid = el('calendar-grid');
    if (!grid) return;

    let html = '';

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dueHabits = getActiveHabitsForDate(habits, dateStr);
      const log = logs.find(l => l.date === dateStr);
      const completed = log ? (log.completed_habits || []).filter(id => dueHabits.some(h => h.id === id)).length : 0;
      const pct = dueHabits.length > 0 ? Math.round((completed / dueHabits.length) * 100) : 0;

      const isToday = dateStr === todayDateStr;
      const isFuture = dateStr > todayDateStr;

      const pctCls = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : pct > 0 ? 'low' : '';
      const dayTasks = tasks.filter(t => t.due_date === dateStr);
      const taskDot = dayTasks.length ? `<span style="width:4px;height:4px;border-radius:50%;background:#fbbf24;"></span>` : '';

      html += `
        <div class="cal-day ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"
             data-date="${dateStr}" data-pct="${pctCls}">
          <span class="cal-day-num">${d}</span>
          ${dueHabits.length ? `<div class="cal-day-bar"><div class="cal-day-fill" style="width:${pct}%"></div></div>` : ''}
          ${taskDot}
        </div>`;
    }

    grid.innerHTML = html;

    // Day click → panel
    grid.querySelectorAll('.cal-day:not(.empty)').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        openDayPanel(dayEl.dataset.date, habits, tasks, logs);
      });
    });
  }

  function openDayPanel(dateStr, habits, tasks, logs) {
    const date = new Date(dateStr + 'T00:00:00');
    const todayDate = todayStr();
    const isPast = dateStr < todayDate;
    const isToday = dateStr === todayDate;

    const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const monthsShort = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const label = `${dayNames[date.getDay()]} ${date.getDate()} de ${monthsShort[date.getMonth()]}`;

    setText('day-panel-title', label.toUpperCase());

    const log = logs.find(l => l.date === dateStr);
    const completedIds = log ? (log.completed_habits || []) : [];
    const dueHabits = getActiveHabitsForDate(habits, dateStr);
    const completed = completedIds.filter(id => dueHabits.some(h => h.id === id)).length;
    const pct = dueHabits.length > 0 ? Math.round((completed / dueHabits.length) * 100) : 0;

    const dayTasks = tasks.filter(t => t.due_date === dateStr);

    let html = '';

    // Performance block
    if (dueHabits.length) {
      html += `<div class="day-perf">${completed}/${dueHabits.length} rutinas — ${pct}%</div>`;
    }

    if (isPast && !isToday) {
      html += `<p class="past-lock">⚿ Fecha pasada: solo consulta, sin modificaciones.</p>`;
    }

    // Habits section
    html += `<div class="day-panel-section">
      <p class="day-panel-section-title">Rutinas</p>`;

    if (dueHabits.length) {
      dueHabits.forEach(h => {
        const done = completedIds.includes(h.id);
        const clickable = !isPast || isToday;
        html += `
          <div class="day-panel-item ${done ? 'completed' : ''} ${clickable ? '' : 'no-pointer'}"
               data-habit-id="${h.id}" data-date="${dateStr}" data-clickable="${clickable}">
            <div class="today-check">${done ? '✓' : ''}</div>
            <span class="day-panel-item-name">${h.name}</span>
          </div>`;
      });
    } else {
      html += `<p class="today-empty">No hay rutinas para este día.</p>`;
    }

    html += `</div>`;

    // Tasks section
    html += `<div class="day-panel-section">
      <p class="day-panel-section-title">Tareas</p>`;

    if (dayTasks.length) {
      dayTasks.forEach(t => {
        const canModify = !isPast || isToday;
        html += `
          <div class="day-panel-item ${t.completed ? 'completed' : ''} ${canModify ? '' : 'no-pointer'}"
               data-task-id="${t.id}" data-date="${dateStr}" data-can-modify="${canModify}">
            <div class="today-check">${t.completed ? '✓' : ''}</div>
            <span class="day-panel-item-name">${t.name}</span>
          </div>`;
      });
    } else {
      html += `<p class="today-empty">No hay tareas para este día.</p>`;
    }

    html += `</div>`;

    const body = el('day-panel-body');
    if (body) {
      body.innerHTML = html;

      // Habit toggles (only current/future)
      body.querySelectorAll('[data-habit-id]').forEach(item => {
        if (item.dataset.clickable !== 'true') return;
        item.addEventListener('click', () => {
          const activeHabits = Habits.list().filter(h => h.active);
          Logs.toggleHabit(item.dataset.habitId, item.dataset.date, activeHabits.length);
          renderCalendar();
          openDayPanel(dateStr, Habits.list(), Tasks.list(), Logs.list());
        });
      });

      // Task toggles (BLOQUEADO para fechas pasadas)
      body.querySelectorAll('[data-task-id]').forEach(item => {
        const canModify = item.dataset.canModify === 'true';
        if (!canModify) return; // No permitir modificación en fechas pasadas
        item.addEventListener('click', () => {
          Tasks.toggle(item.dataset.taskId, item.dataset.date);
          openDayPanel(dateStr, Habits.list(), Tasks.list(), Logs.list());
        });
      });
    }

    openModal('modal-day');
  }

  return { render };
})();
