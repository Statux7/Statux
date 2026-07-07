/**
 * utils.js — Utilidades compartidas
 */

/* --- Date helpers --- */
function getDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return getDateStr(new Date());
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return getDateStr(d);
}

function subDays(dateStr, n) {
  return addDays(dateStr, -n);
}

function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}

/* --- Habit scheduling --- */
function isHabitDue(habit, dateStr) {
  if (!habit.active) return false;
  const dow = getDayOfWeek(dateStr);
  switch (habit.frequency) {
    case 'daily': return true;
    case 'weekdays': return dow >= 1 && dow <= 5;
    case 'weekends': return dow === 0 || dow === 6;
    case 'custom': return (habit.custom_days || []).includes(dow);
    default: return true;
  }
}

function getActiveHabitsForDate(habits, dateStr) {
  return habits.filter(h => h.active && isHabitDue(h, dateStr));
}

/* --- Analytics --- */
function calculateConsistency(logs, habits, days) {
  if (!habits.length) return 0;
  let total = 0, done = 0;
  for (let i = 0; i < days; i++) {
    const d = subDays(todayStr(), i);
    const dueHabits = getActiveHabitsForDate(habits, d);
    if (!dueHabits.length) continue;
    const log = logs.find(l => l.date === d);
    const completed = log ? (log.completed_habits || []).filter(id => dueHabits.some(h => h.id === id)).length : 0;
    total += dueHabits.length;
    done += completed;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function calculateStreak(logs, habits) {
  if (!habits.length) return 0;
  let streak = 0;
  let d = todayStr();
  while (true) {
    const dueHabits = getActiveHabitsForDate(habits, d);
    if (!dueHabits.length) { d = subDays(d, 1); continue; }
    const log = logs.find(l => l.date === d);
    const completed = log ? (log.completed_habits || []).filter(id => dueHabits.some(h => h.id === id)).length : 0;
    if (completed === 0) break;
    const pct = completed / dueHabits.length;
    if (pct >= 0.5) { streak++; d = subDays(d, 1); }
    else break;
    if (streak > 365) break;
  }
  return streak;
}

function getTrend(logs, habits) {
  const recent = calculateConsistency(logs, habits, 3);
  const older = calculateConsistency(logs.filter(l => {
    const cutoff = subDays(todayStr(), 3);
    return l.date < cutoff;
  }), habits, 4);
  if (recent > older + 5) return { symbol: '↑', direction: 'up' };
  if (recent < older - 5) return { symbol: '↓', direction: 'down' };
  return { symbol: '→', direction: 'stable' };
}

function getOperationalStatus(pct) {
  if (pct >= 85) return { label: 'Excelente', cls: 'status-excellent' };
  if (pct >= 65) return { label: 'Operativo', cls: 'status-good' };
  if (pct >= 40) return { label: 'Regular', cls: 'status-regular' };
  return { label: 'Crítico', cls: 'status-bad' };
}

function getDomainLevel(pct) {
  if (pct >= 90) return { label: 'Maestro', level: 5 };
  if (pct >= 75) return { label: 'Avanzado', level: 4 };
  if (pct >= 55) return { label: 'Intermedio', level: 3 };
  if (pct >= 35) return { label: 'Básico', level: 2 };
  return { label: 'Iniciado', level: 1 };
}

function getMostConsistentHabit(logs, habits) {
  if (!habits.length) return null;
  let best = null;
  habits.filter(h => h.active).forEach(h => {
    let due = 0, done = 0;
    for (let i = 0; i < 14; i++) {
      const d = subDays(todayStr(), i);
      if (!isHabitDue(h, d)) continue;
      due++;
      const log = logs.find(l => l.date === d);
      if (log && (log.completed_habits || []).includes(h.id)) done++;
    }
    const rate = due > 0 ? Math.round((done / due) * 100) : 0;
    if (!best || rate > best.rate) best = { habit: h, rate };
  });
  return best;
}

function getMostAbandonedHabit(logs, habits) {
  if (!habits.length) return null;
  let worst = null;
  habits.filter(h => h.active).forEach(h => {
    let due = 0, done = 0;
    for (let i = 0; i < 14; i++) {
      const d = subDays(todayStr(), i);
      if (!isHabitDue(h, d)) continue;
      due++;
      const log = logs.find(l => l.date === d);
      if (log && (log.completed_habits || []).includes(h.id)) done++;
    }
    const rate = due > 0 ? Math.round((done / due) * 100) : 0;
    if (!worst || rate < worst.rate) worst = { habit: h, rate };
  });
  return worst;
}

/* --- Identity weekly report --- */
function getWeeklyIdentityReport(logs, habits) {
  const reportData = IdentityReport.get();
  if (!reportData) return null;

  const now = todayStr();
  const daysSinceLast = reportData.lastShown
    ? Math.floor((new Date(now) - new Date(reportData.lastShown)) / 86400000)
    : 999;

  if (daysSinceLast < 7) return null;

  const connectedHabits = habits.filter(h => h.target_identity_ids && h.target_identity_ids.length > 0);
  if (!connectedHabits.length) return null;

  const thisWeekPct = calculateConsistency(logs, connectedHabits, 7);
  const lastWeekPct = reportData.lastWeekPct || thisWeekPct;
  const diff = thisWeekPct - lastWeekPct;

  IdentityReport.save({ lastShown: now, lastWeekPct: thisWeekPct });

  const arrow = diff > 0 ? 'más' : diff < 0 ? 'menos' : 'igual de';
  const absDiff = Math.abs(Math.round(diff));

  return `Esta semana estuviste ${absDiff > 0 ? absDiff + '% ' : ''}${arrow} consistente que la semana anterior. Persistencia: ${thisWeekPct}%.`;
}

/* --- Format helpers --- */
function formatPriority(p) {
  const map = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' };
  return map[p] || p;
}

function formatFrequency(f) {
  const map = { daily: 'Diario', weekdays: 'Lun-Vie', weekends: 'Sáb-Dom', custom: 'Custom' };
  return map[f] || f;
}

/* --- DOM helpers --- */
function el(id) { return document.getElementById(id); }
function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }

function setHTML(id, html) {
  const e = el(id);
  if (e) e.innerHTML = html;
}

function setText(id, text) {
  const e = el(id);
  if (e) e.textContent = text;
}

function show(id) { const e = el(id); if (e) e.classList.remove('hidden'); }
function hide(id) { const e = el(id); if (e) e.classList.add('hidden'); }

function openModal(id) { const e = el(id); if (e) e.classList.remove('hidden'); }
function closeModal(id) { const e = el(id); if (e) e.classList.add('hidden'); }
