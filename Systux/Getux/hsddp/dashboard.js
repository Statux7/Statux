/**
 * dashboard.js — Lógica del Dashboard
 */
/* global Habits, Tasks, Logs, User, el, setText, show, hide, todayStr, subDays, calculateConsistency, calculateStreak, getOperationalStatus, getTrend, getDomainLevel, getMostConsistentHabit, getMostAbandonedHabit, getActiveHabitsForDate, getWeeklyIdentityReport, getDayOfWeek */

const Dashboard = (() => {

  function render() {
    const habits = Habits.list();
    const tasks = Tasks.list();
    const logs = Logs.list();
    const username = User.get() || '';
    const today = todayStr();

    // Subtitle
    const d = new Date();
    const dateLabel = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
    setText('dashboard-subtitle', `${dateLabel} — ${getGreeting(username)}`);

    const hasData = habits.length > 0 || logs.length > 0;

    if (!hasData) {
      show('dashboard-empty');
      hide('dashboard-content');
      return;
    }

    hide('dashboard-empty');
    show('dashboard-content');

    const consistency = calculateConsistency(logs, habits, 7);
    const streak = calculateStreak(logs, habits);
    const status = getOperationalStatus(consistency);
    const trend = getTrend(logs, habits);
    const domain = getDomainLevel(consistency);
    const best = getMostConsistentHabit(logs, habits);
    const worst = getMostAbandonedHabit(logs, habits);

    // Status widget
    const mcStatus = el('mc-status');
    mcStatus.className = 'metric-card ' + status.cls;
    setText('mc-status-val', status.label);

    setText('mc-consistency', consistency + '%');
    setText('mc-streak', streak);
    setText('mc-streak-sub', streak === 1 ? 'día' : 'días');
    setText('mc-trend', trend.symbol);
    setText('mc-trend-sub', trend.direction === 'up' ? 'Mejorando' : trend.direction === 'down' ? 'Decayendo' : 'Estable');
    setText('mc-domain', domain.label);
    setText('mc-domain-sub', `Nivel ${domain.level}/5`);

    if (best) { setText('mc-best', best.habit.name); setText('mc-best-sub', best.rate + '%'); }
    else { setText('mc-best', '—'); setText('mc-best-sub', '—'); }

    if (worst) { setText('mc-worst', worst.habit.name); setText('mc-worst-sub', worst.rate + '%'); }
    else { setText('mc-worst', '—'); setText('mc-worst-sub', '—'); }

    renderWeeklyChart(logs, habits);
    renderAlerts(logs, habits);
    renderTodayHabits(habits, logs, today);
    renderTodayTasks(tasks, today);
    renderIdentityReport(logs, habits);
  }

  function getGreeting(name) {
    const greetings = [
      n => `Bienvenido de nuevo, ${n}.`,
      n => `Estado operativo listo, ${n}.`,
      n => `Dominio activo, ${n}.`,
      n => `Sistema iniciado, ${n}.`,
      n => `Disciplina en curso, ${n}.`,
    ];
    const idx = name.charCodeAt ? name.charCodeAt(0) % greetings.length : 0;
    return greetings[idx](name);
  }

  function renderWeeklyChart(logs, habits) {
    const chart = el('weekly-chart');
    if (!chart) return;
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const today = todayStr();
    let html = '';

    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dueHabits = getActiveHabitsForDate(habits, d);
      const log = logs.find(l => l.date === d);
      const completed = log ? (log.completed_habits || []).filter(id => dueHabits.some(h => h.id === id)).length : 0;
      const pct = dueHabits.length > 0 ? Math.round((completed / dueHabits.length) * 100) : 0;

      const isToday = d === today;
      const fillCls = isToday ? 'today' : pct >= 70 ? 'good' : pct >= 40 ? 'ok' : '';
      const dow = getDayOfWeek(d);

      html += `
        <div class="chart-bar-wrap">
          <div class="chart-bar-bg">
            <div class="chart-bar-fill ${fillCls}" style="height:${pct}%"></div>
          </div>
          <span class="chart-bar-label">${days[dow]}</span>
        </div>`;
    }

    chart.innerHTML = html;
  }

  function renderAlerts(logs, habits) {
    const list = el('alerts-list');
    if (!list) return;
    const alerts = generateAlerts(logs, habits);
    if (!alerts.length) {
      list.innerHTML = '<p class="no-alerts">Sin alertas activas.</p>';
      return;
    }
    list.innerHTML = alerts.map(a => `<div class="alert-item">${a}</div>`).join('');
  }

  function generateAlerts(logs, habits) {
    const alerts = [];
    const today = todayStr();

    // Overall decline
    const recent = calculateConsistency(logs, habits, 3);
    const older = calculateConsistency(logs, habits, 7);
    if (older > 0 && recent < older - 20) {
      alerts.push(`⚠ Descenso de consistencia: ${older}% → ${recent}% en los últimos días.`);
    }

    // Abandoned habits (0 completions in last 7 days)
    habits.filter(h => h.active).forEach(h => {
      let due = 0, done = 0;
      for (let i = 0; i < 7; i++) {
        const d = subDays(today, i);
        if (!isHabitDue(h, d)) continue;
        due++;
        const log = logs.find(l => l.date === d);
        if (log && (log.completed_habits || []).includes(h.id)) done++;
      }
      if (due >= 3 && done === 0) {
        alerts.push(`↓ "${h.name}" sin completar en ${due} días hábiles.`);
      }
    });

    return alerts.slice(0, 4);
  }

  function renderTodayHabits(habits, logs, today) {
    const container = el('today-habits');
    if (!container) return;
    const todayLog = logs.find(l => l.date === today);
    const completedIds = todayLog ? (todayLog.completed_habits || []) : [];
    const dueHabits = getActiveHabitsForDate(habits, today);

    if (!dueHabits.length) {
      container.innerHTML = '<p class="today-empty">No hay rutinas para hoy.</p>';
      return;
    }

    container.innerHTML = dueHabits.map(h => {
      const done = completedIds.includes(h.id);
      return `
        <div class="today-item ${done ? 'completed' : ''}" data-id="${h.id}" data-type="habit">
          <div class="today-check">${done ? '✓' : ''}</div>
          <span class="today-item-name">${h.name}</span>
          <span class="priority-dot ${h.priority || 'medium'}"></span>
        </div>`;
    }).join('');

    container.querySelectorAll('.today-item[data-type="habit"]').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const activeHabits = Habits.list().filter(h => h.active);
        Logs.toggleHabit(id, today, activeHabits.length);
        render();
      });
    });
  }

  function renderTodayTasks(tasks, today) {
    const container = el('today-tasks');
    if (!container) return;
    const todayTasks = tasks.filter(t => t.due_date === today);

    if (!todayTasks.length) {
      container.innerHTML = '<p class="today-empty">No hay tareas para hoy.</p>';
      return;
    }

    container.innerHTML = todayTasks.map(t => `
      <div class="today-item ${t.completed ? 'completed' : ''}" data-id="${t.id}" data-type="task">
        <div class="today-check">${t.completed ? '✓' : ''}</div>
        <span class="today-item-name">${t.name}</span>
        <span class="priority-dot ${t.priority || 'medium'}"></span>
      </div>`).join('');

    container.querySelectorAll('.today-item[data-type="task"]').forEach(item => {
      item.addEventListener('click', () => {
        Tasks.toggle(item.dataset.id, today);
        render();
      });
    });
  }

  function renderIdentityReport(logs, habits) {
    const report = getWeeklyIdentityReport(logs, habits);
    if (!report) {
      hide('identity-report-block');
      return;
    }
    show('identity-report-block');
    setText('identity-report-text', report);
  }

  return { render };
})();
