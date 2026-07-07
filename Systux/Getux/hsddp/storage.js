/**
 * storage.js — Capa de persistencia localStorage
 */

const KEYS = {
  USERNAME: 'habitos_username',
  GENDER: 'habitos_gender',
  HABITS: 'habitos_habits',
  TASKS: 'habitos_tasks',
  LOGS: 'habitos_logs',
  BLOCKS: 'habitos_blocks',
  IDENTITIES: 'habitos_identities',
  CONNECTIONS: 'habitos_connections',
  SILHOUETTE: 'habitos_silhouette',
  CANVAS_VIEW: 'habitos_canvas_view',
  IDENTITY_REPORT: 'habitos_identity_report',
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function now() {
  return new Date().toISOString();
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* --- Username & Gender ---
 * gender: 'male' | 'female' — determina qué silueta SVG se usa como nodo final
 */
const User = {
  get: () => load(KEYS.USERNAME, null),
  set: (name) => save(KEYS.USERNAME, name),
  getGender: () => load(KEYS.GENDER, null),
  setGender: (gender) => save(KEYS.GENDER, gender),
};

/* --- Habits ---
 * type: 'habito' | 'habitor' | 'habitod'  (default: 'habito' para compatibilidad)
 * block_id: id del Block (nodo contenedor) al que pertenece este hábito; null si está huérfano
 *
 * Campos comunes (todos los tipos): name, priority, active
 * Campos específicos por tipo (se guardan en type_data):
 *
 *  habito (hábito normal, repetitivo):
 *    usa los campos ya existentes a nivel raíz: purpose, benefit, frequency,
 *    custom_days, difficulty, schedule_time. type_data = {}
 *
 *  habitor (repositorio dinámico, ej "Expandir vocabulario"):
 *    type_data = {
 *      items: [{ id, label }],
 *      rotation_days: number,           // cada cuántos días cambia el ítem
 *      current_item_id: string|null,    // ítem activo actualmente
 *      current_item_set_date: string|null, // fecha (YYYY-MM-DD) en que se fijó el ítem actual
 *    }
 *
 *  habitod (acción programada con notificación, ej "Depilarme"):
 *    type_data = {
 *      every_days: number,              // frecuencia, ej cada 15 días
 *      message: string,                 // mensaje de la notificación
 *      persist_days: number,            // días que insiste si no se completa
 *      last_triggered_date: string|null,// última fecha en que se generó la notificación
 *      pending_until: string|null,      // fecha límite (YYYY-MM-DD) hasta la que sigue pendiente/insistiendo
 *    }
 */
const Habits = {
  list: () => load(KEYS.HABITS, []),
  create: (data) => {
    const habits = Habits.list();
    const h = {
      type: 'habito',
      block_id: null,
      type_data: {},
      ...data,
      id: uid(),
      created_date: now(),
      updated_date: now(),
    };
    habits.push(h);
    save(KEYS.HABITS, habits);
    return h;
  },
  update: (id, data) => {
    const habits = Habits.list().map(h =>
      h.id === id ? { ...h, ...data, updated_date: now() } : h
    );
    save(KEYS.HABITS, habits);
    return habits.find(h => h.id === id);
  },
  remove: (id) => {
    save(KEYS.HABITS, Habits.list().filter(h => h.id !== id));
    // Clean logs
    const logs = Logs.list().map(l => ({
      ...l,
      completed_habits: (l.completed_habits || []).filter(hid => hid !== id),
    }));
    save(KEYS.LOGS, logs);
  },
  find: (id) => Habits.list().find(h => h.id === id),
  byBlock: (blockId) => Habits.list().filter(h => h.block_id === blockId),
};

/* --- Tasks ---
 * SEGURIDAD: Solo se puede editar/eliminar tareas de hoy o futuro
 */
const Tasks = {
  list: () => load(KEYS.TASKS, []),
  create: (data) => {
    const tasks = Tasks.list();
    const t = { ...data, id: uid(), completed: false, created_date: now(), updated_date: now() };
    tasks.push(t);
    save(KEYS.TASKS, tasks);
    return t;
  },
  update: (id, data) => {
    const task = Tasks.find(id);
    if (!task) return null;
    // Verificar que no sea una tarea pasada (seguridad)
    const today = new Date().toISOString().slice(0, 10);
    if (task.due_date && task.due_date < today) {
      console.warn('❌ No se puede editar una tarea pasada');
      return null;
    }
    const tasks = Tasks.list().map(t =>
      t.id === id ? { ...t, ...data, updated_date: now() } : t
    );
    save(KEYS.TASKS, tasks);
    return tasks.find(t => t.id === id);
  },
  remove: (id) => {
    const task = Tasks.find(id);
    if (!task) return false;
    // Verificar que no sea una tarea pasada (seguridad)
    const today = new Date().toISOString().slice(0, 10);
    if (task.due_date && task.due_date < today) {
      console.warn('❌ No se puede eliminar una tarea pasada');
      return false;
    }
    save(KEYS.TASKS, Tasks.list().filter(t => t.id !== id));
    return true;
  },
  toggle: (id, dateStr) => {
    const tasks = Tasks.list();
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    // Permitir toggle en cualquier fecha (solo consulta, no edición destructiva)
    const completed = !task.completed;
    Tasks.update(id, { completed, completed_date: completed ? dateStr : null });
  },
  find: (id) => Tasks.list().find(t => t.id === id),
  canEdit: (id) => {
    const task = Tasks.find(id);
    if (!task) return false;
    const today = new Date().toISOString().slice(0, 10);
    return !task.due_date || task.due_date >= today;
  },
};

/* --- Logs --- */
const Logs = {
  list: () => load(KEYS.LOGS, []),
  get: (dateStr) => Logs.list().find(l => l.date === dateStr) || null,
  upsert: (dateStr, data) => {
    const logs = Logs.list();
    const idx = logs.findIndex(l => l.date === dateStr);
    const entry = { date: dateStr, completed_habits: [], total_habits: 0, ...data };
    if (idx >= 0) {
      logs[idx] = { ...logs[idx], ...data, date: dateStr };
    } else {
      logs.push(entry);
    }
    save(KEYS.LOGS, logs);
    return logs[idx >= 0 ? idx : logs.length - 1];
  },
  toggleHabit: (habitId, dateStr, totalActive) => {
    const log = Logs.get(dateStr) || { date: dateStr, completed_habits: [], total_habits: totalActive };
    const ids = log.completed_habits || [];
    const newIds = ids.includes(habitId) ? ids.filter(id => id !== habitId) : [...ids, habitId];
    Logs.upsert(dateStr, { completed_habits: newIds, total_habits: totalActive });
  },
  purgeOld: (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutStr = cutoff.toISOString().slice(0, 10);
    save(KEYS.LOGS, Logs.list().filter(l => l.date >= cutStr));
  },
};

/* --- Blocks ---
 * Nodo contenedor del canvas. Agrupa hasta 3 hábitos (mezclados de cualquier tipo).
 * { id, name, x, y, created_date, updated_date }
 * Los hábitos referencian su bloque vía habit.block_id (no al revés), así que
 * la lista de hábitos de un bloque siempre se obtiene con Habits.byBlock(id).
 */
const MAX_HABITS_PER_BLOCK = 3;

const Blocks = {
  list: () => load(KEYS.BLOCKS, []),
  create: (data) => {
    const blocks = Blocks.list();
    const b = {
      name: '',
      x: 0,
      y: 0,
      ...data,
      id: uid(),
      created_date: now(),
      updated_date: now(),
    };
    blocks.push(b);
    save(KEYS.BLOCKS, blocks);
    return b;
  },
  update: (id, data) => {
    const blocks = Blocks.list().map(b =>
      b.id === id ? { ...b, ...data, updated_date: now() } : b
    );
    save(KEYS.BLOCKS, blocks);
    return blocks.find(b => b.id === id);
  },
  remove: (id) => {
    save(KEYS.BLOCKS, Blocks.list().filter(b => b.id !== id));
    // Huérfanos: los hábitos del bloque eliminado quedan sin bloque (no se borran)
    const habits = Habits.list().map(h => h.block_id === id ? { ...h, block_id: null } : h);
    save(KEYS.HABITS, habits);
    // Limpiar conexiones que tocaban este bloque
    Connections.removeForNode(id, 'block');
  },
  find: (id) => Blocks.list().find(b => b.id === id),
  setPosition: (id, x, y) => Blocks.update(id, { x, y }),
  canAddHabit: (id) => Habits.byBlock(id).length < MAX_HABITS_PER_BLOCK,
};

/* --- Identities ---
 * Nodos de identidad genéricos (ya no hay distinción actual/objetivo).
 * { id, label, x, y }
 */
const Identities = {
  list: () => load(KEYS.IDENTITIES, []),
  create: (data) => {
    const identities = Identities.list();
    const i = {
      label: '',
      x: 0,
      y: 0,
      ...data,
      id: uid(),
      created_date: now(),
      updated_date: now(),
    };
    identities.push(i);
    save(KEYS.IDENTITIES, identities);
    return i;
  },
  update: (id, data) => {
    const identities = Identities.list().map(i =>
      i.id === id ? { ...i, ...data, updated_date: now() } : i
    );
    save(KEYS.IDENTITIES, identities);
    return identities.find(i => i.id === id);
  },
  remove: (id) => {
    save(KEYS.IDENTITIES, Identities.list().filter(i => i.id !== id));
    Connections.removeForNode(id, 'identity');
  },
  find: (id) => Identities.list().find(i => i.id === id),
  setPosition: (id, x, y) => Identities.update(id, { x, y }),
};

/* --- Connections (aristas del canvas) ---
 * { id, from_id, from_type: 'block'|'identity', to_id, to_type: 'block'|'identity'|'silhouette' }
 * Tipos de arista válidos:
 *   block    -> block      (bloque conecta con otro bloque)
 *   block    -> identity   (bloque conecta con un nodo de identidad)
 *   identity -> silhouette (identidad conecta con la silueta final)
 */
const Connections = {
  list: () => load(KEYS.CONNECTIONS, []),
  create: (data) => {
    const conns = Connections.list();
    const dup = conns.find(c =>
      c.from_id === data.from_id && c.to_id === data.to_id &&
      c.from_type === data.from_type && c.to_type === data.to_type
    );
    if (dup) return dup;
    const c = { ...data, id: uid(), created_date: now() };
    conns.push(c);
    save(KEYS.CONNECTIONS, conns);
    return c;
  },
  remove: (id) => {
    save(KEYS.CONNECTIONS, Connections.list().filter(c => c.id !== id));
  },
  removeForNode: (nodeId, nodeType) => {
    const conns = Connections.list().filter(c =>
      !((c.from_id === nodeId && c.from_type === nodeType) ||
        (c.to_id === nodeId && c.to_type === nodeType))
    );
    save(KEYS.CONNECTIONS, conns);
  },
  fromNode: (nodeId, nodeType) => Connections.list().filter(c => c.from_id === nodeId && c.from_type === nodeType),
  toNode: (nodeId, nodeType) => Connections.list().filter(c => c.to_id === nodeId && c.to_type === nodeType),
};

/* --- Silhouette ---
 * Nodo único, final y fijo. Representa el cuerpo (hombre/mujer según User.getGender()).
 * Solo se persiste su posición en el canvas; el dibujo SVG lo decide la UI según género.
 */
const Silhouette = {
  get: () => load(KEYS.SILHOUETTE, { x: 0, y: 0 }),
  save: (data) => save(KEYS.SILHOUETTE, data),
  setPosition: (x, y) => Silhouette.save({ ...Silhouette.get(), x, y }),
};

/* --- Canvas view state (pan/zoom persistente entre sesiones) --- */
const CanvasView = {
  get: () => load(KEYS.CANVAS_VIEW, { x: 0, y: 0, scale: 1 }),
  save: (data) => save(KEYS.CANVAS_VIEW, data),
};

/* --- Identity Report --- */
const IdentityReport = {
  get: () => load(KEYS.IDENTITY_REPORT, { lastShown: null, lastWeekPct: null }),
  save: (data) => save(KEYS.IDENTITY_REPORT, data),
};
