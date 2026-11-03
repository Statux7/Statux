/**
 * utils.js — Utilidades compartidas
 */

/* --- Date helpers --- */
function getDateStr(date) {
  // Si ya es 'YYYY-MM-DD', devolver tal cual (evita desfase por zona horaria)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;   // FECHA LOCAL, no UTC
}

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T00:00:00');
  const b = new Date(toStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
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
/* Solo estos tipos suman al porcentaje de progreso.
 * habitod y unhabit quedan fuera hasta la misión 6B. */
function countsForProgress(h) {
  return h.type !== 'unhabit' && h.type !== 'habitod';
}

function isHabitDue(habit, dateStr) {
  if (!habit.active) return false;

  // No existía todavía en esa fecha
  if (habit.created_date && dateStr < getDateStr(habit.created_date)) return false;

  // Hábito pausado (bloqueador)
  if (habit.paused) {
    const from = habit.paused_from || '0000-00-00';
    const until = habit.paused_until || '9999-12-31';
    if (dateStr >= from && dateStr <= until) return false;
  }

  // Día de descanso elegido por el usuario
  if ((habit.rest_dates || []).includes(dateStr)) return false;

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
  return habits.filter(h => h.active && countsForProgress(h) && isHabitDue(h, dateStr));
}

/* Estadística de UN día.
 * Días pasados: usa la foto guardada en el log (scheduled_habits) → inmutable.
 * Hoy y futuro: calcula con los hábitos actuales. */
function getDayStats(logs, habits, dateStr) {
  const today = todayStr();
  const log = logs.find(l => l.date === dateStr) || null;
  let scheduledIds;
  if (dateStr < today && log && Array.isArray(log.scheduled_habits)) {
    scheduledIds = log.scheduled_habits;
  } else {
    scheduledIds = getActiveHabitsForDate(habits, dateStr).map(h => h.id);
  }
  const completedSet = new Set(log ? (log.completed_habits || []) : []);
  const completed = scheduledIds.filter(id => completedSet.has(id)).length;
  const total = scheduledIds.length;
  return {
    scheduledIds, completed, total,
    pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    log,
  };
}


/* --- Analytics --- */
/* days = cuántos días; offset = cuántos días saltar hacia atrás desde hoy */
function calculateConsistency(logs, habits, days, offset = 0) {
  if (!habits.length) return 0;
  const today = todayStr();
  let total = 0, done = 0;
  for (let i = offset; i < offset + days; i++) {
    const st = getDayStats(logs, habits, subDays(today, i));
    total += st.total;
    done += st.completed;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function calculateStreak(logs, habits) {
  if (!habits.length) return 0;
  const today = todayStr();
  let streak = 0;
  let d = today;
  for (let guard = 0; guard < 400; guard++) {
    const st = getDayStats(logs, habits, d);
    if (st.total === 0) { d = subDays(d, 1); continue; }
    const ok = st.completed > 0 && (st.completed / st.total) >= 0.5;
    if (!ok) {
      if (d === today) { d = subDays(d, 1); continue; }
      break;
    }
    streak++;
    d = subDays(d, 1);
  }
  return streak;
}

function getTrend(logs, habits) {
  const recent = calculateConsistency(logs, habits, 3, 0);
  const older = calculateConsistency(logs, habits, 4, 3);
  if (recent > older + 5) return { symbol: '↑', direction: 'up' };
  if (recent < older - 5) return { symbol: '↓', direction: 'down' };
  return { symbol: '→', direction: 'stable' };
}

function getHabitRates(logs, habits, windowDays) {
  const today = todayStr();
  return habits
    .filter(h => h.active && countsForProgress(h))
    .map(h => {
      let due = 0, done = 0;
      for (let i = 1; i <= windowDays; i++) {
        const st = getDayStats(logs, habits, subDays(today, i));
        if (!st.scheduledIds.includes(h.id)) continue;
        due++;
        if (st.log && (st.log.completed_habits || []).includes(h.id)) done++;
      }
      const ageDays = h.created_date ? daysBetween(getDateStr(h.created_date), today) : 999;
      return { habit: h, due, done, rate: due > 0 ? Math.round((done / due) * 100) : 0, ageDays };
    });
}

function getMostConsistentHabit(logs, habits) {
  const rates = getHabitRates(logs, habits, 14).filter(r => r.due > 0);
  if (!rates.length) return null;
  return rates.reduce((a, b) => (b.rate > a.rate || (b.rate === a.rate && b.due > a.due)) ? b : a);
}

function getMostAbandonedHabit(logs, habits) {
  const rates = getHabitRates(logs, habits, 14).filter(r => r.ageDays >= 3 && r.due >= 3);
  if (!rates.length) return null;
  return rates.reduce((a, b) => b.rate < a.rate ? b : a);
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

/* --- Data maturity --- */
/**
 * Nivel de madurez del sistema (0–3).
 * 0 = observando  → cuenta < 7 días Y < 10 registros válidos
 * 1 = básico      → 7+ días O 10+ registros válidos
 * 2 = análisis    → 14+ días Y 10+ registros válidos
 * 3 = completo    → 30+ días Y 30+ registros válidos
 *
 * "Registro válido" = día en que completed_habits.length > 0
 */
function getDataMaturity(logs, habits) {
  if (!habits.length) return 0;
  const today = todayStr();
  const oldestStr = habits.map(h => getDateStr(h.created_date || new Date())).sort()[0];
  const daysSinceStart = daysBetween(oldestStr, today);
  const validDays = new Set(
    logs.filter(l => l.completed_habits && l.completed_habits.length > 0).map(l => l.date)
  ).size;

  if (daysSinceStart >= 14 && validDays >= 10) return 3;
  if (daysSinceStart >= 3 && validDays >= 2) return 2;
  if (daysSinceStart >= 3) return 1;
  return 0;
}


/**
 * Devuelve true si la madurez es >= level.
 * level 1 = básico (tendencia, racha)
 * level 2 = alertas y hábito más abandonado
 * level 3 = informe de identidad
 */
/**
 * Cuenta el tiempo que falta para cumplir los dos requisitos del análisis:
 * 14 días desde el primer hábito y 10 días distintos con actividad válida.
 */
function getDaysRemainingToMaturity(logs, habits) {
  if (!habits.length) {
    return { daysRemaining: 3, validDaysRemaining: 2, message: 'Crea un hábito para comenzar a reunir datos.' };
  }
  const today = todayStr();
  const oldestStr = habits.map(h => getDateStr(h.created_date || new Date())).sort()[0];
  const daysSinceStart = daysBetween(oldestStr, today);
  const daysRemaining = Math.max(0, 3 - daysSinceStart);
  const validDays = new Set(
    logs.filter(l => l.date <= today && l.completed_habits && l.completed_habits.length > 0).map(l => l.date)
  ).size;
  const validDaysRemaining = Math.max(0, 2 - validDays);
  const parts = [];
  if (daysRemaining > 0) parts.push(`el análisis se activa en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}`);
  if (validDaysRemaining > 0) parts.push(`registra actividad en ${validDaysRemaining} ${validDaysRemaining === 1 ? 'día' : 'días'} para activar las alertas`);
  return {
    daysRemaining,
    validDaysRemaining,
    message: parts.length ? parts.join('; ') + '.' : 'El análisis está listo.',
  };
}

function hasMaturity(logs, habits, level) {
  return getDataMaturity(logs, habits) >= level;
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
