/**
 * habitos.js — Sección de Hábitos
 * Fase 2: Motor de canvas activo con toolbar, focus day, tutorial y fondo starlight.
 * Los nodos reales (bloques, identidades, silueta) se renderizan en Fase 3.
 * Las tareas se mantienen funcionales en el modal flotante.
 */
/* global el, setText, show, hide, openModal, closeModal,
   Tasks, Habits, Logs, Blocks, Identities, Connections, Silhouette,
   CanvasView, User, todayStr, CanvasEngine */

const Habitos = (() => {

  let engine = null;
  let contextTarget = null;  // { type: 'block'|'identity'|'silhouette', id }

  /* ============================================
     RENDER PRINCIPAL
     ============================================ */
  function render() {
    initCanvas();
    bindToolbar();
    bindFocusDay();
    bindTutorial();
    bindTaskModal();
    renderFocusDay();
  }

  /* ============================================
     CANVAS ENGINE INIT
     ============================================ */
  function initCanvas() {
    const container = el('canvas-container');
    if (!container) return;

    // Destruir instancia previa si existe (re-render por cambio de ruta)
    if (engine) {
      engine.destroy();
      engine = null;
    }

    engine = CanvasEngine.create(container, {
      snapToGrid: false,
      starCount: 75,
    });

    // Restaurar snap toggle state
    const snapToggle = el('toggle-snap');
    if (snapToggle) engine.setSnap(snapToggle.checked);

    // Eventos del engine
    engine.on('nodeDblClick', (id, e) => handleNodeDblClick(id, e));
    engine.on('nodeRightClick', (id, e, pos) => showContextMenu(id, pos));
    engine.on('nodeMoved', (id, x, y) => handleNodeMoved(id, x, y));
    engine.on('canvasDblClick', () => hideContextMenu());

    // Cargar nodos actuales
    refreshCanvas();

    // Cerrar context menu al hacer click en canvas
    container.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#canvas-context-menu')) hideContextMenu();
    });
  }

  /* ============================================
     REFRESH CANVAS (reconstruir nodos desde storage)
     ============================================ */
  function refreshCanvas() {
    if (!engine) return;

    const blocks = Blocks.list();
    const identities = Identities.list();
    const today = todayStr();
    const logs = Logs.list();
    const habits = Habits.list();

    const canvasNodes = [];
    const canvasConns = [];

    // ── Nodos de bloque ──
    blocks.forEach(b => {
      canvasNodes.push(buildBlockNode(b, habits, logs, today));
    });

    // ── Nodos de identidad ──
    identities.forEach(id => {
      canvasNodes.push(buildIdentityNode(id, habits, logs, blocks, today));
    });

    // ── Nodo silueta (solo si hay identidades) ──
    if (identities.length > 0 || blocks.length > 0) {
      canvasNodes.push(buildSilhouetteNode());
    }

    // ── Conexiones ──
    Connections.list().forEach(c => {
      canvasConns.push({
        id: c.id,
        fromId: c.from_id,
        toId: c.to_id === 'silhouette' ? '_silhouette' : c.to_id,
        color: c.from_type === 'identity' ? '#ffffff22' : '#ffffff18',
      });
    });

    engine.setNodes(canvasNodes);
    engine.setConnections(canvasConns);

    // Tutorial si canvas vacío
    const hasContent = blocks.length > 0 || identities.length > 0;
    const tutorialSeen = localStorage.getItem('habitos_tutorial_seen');
    if (!hasContent && !tutorialSeen) {
      show('canvas-tutorial');
      show('tutorial-step-1');
    }
  }

  /* ============================================
     NODE BUILDERS (Fase 2: placeholders visuales)
     Los renders reales con hábitos/barra/glow se implementan en Fase 3.
     Por ahora dibujan la caja básica para que el canvas funcione completo.
     ============================================ */

  const BLOCK_W = 160;
  const BLOCK_H = 90;
  const IDENTITY_W = 130;
  const IDENTITY_H = 70;
  const SILHOUETTE_W = 80;
  const SILHOUETTE_H = 130;

  function buildBlockNode(block, habits, logs, today) {
    const blockHabits = habits.filter(h => h.block_id === block.id);
    const todayLog = logs.find(l => l.date === today);
    const completedIds = todayLog ? (todayLog.completed_habits || []) : [];
    const completedToday = blockHabits.filter(h => completedIds.includes(h.id)).length;
    const total = blockHabits.length;
    const pct = total > 0 ? completedToday / total : 0;

    return {
      id: block.id,
      x: block.x,
      y: block.y,
      width: BLOCK_W,
      height: BLOCK_H,
      _type: 'block',
      _name: block.name,
      _habitCount: total,
      _completedToday: completedToday,
      _pct: pct,
      render: (ctx, node, cam, t) => renderBlockNode(ctx, node, t),
    };
  }

  function buildIdentityNode(identity, habits, logs, blocks, today) {
    return {
      id: identity.id,
      x: identity.x,
      y: identity.y,
      width: IDENTITY_W,
      height: IDENTITY_H,
      _type: 'identity',
      _identity: true,
      _name: identity.label,
      _emoji: identity.emoji || '◈',
      render: (ctx, node, cam, t) => renderIdentityNode(ctx, node, t),
    };
  }

  function buildSilhouetteNode() {
    const pos = Silhouette.get();
    return {
      id: '_silhouette',
      x: pos.x || 0,
      y: pos.y || 0,
      width: SILHOUETTE_W,
      height: SILHOUETTE_H,
      _type: 'silhouette',
      _silhouette: true,
      render: (ctx, node, cam, t) => renderSilhouetteNode(ctx, node, t),
    };
  }

  /* ============================================
     NODE RENDERERS (Fase 2 — visuales base)
     ============================================ */

  function renderBlockNode(ctx, node, t) {
    const W = node.width;
    const H = node.height;
    const pct = node._pct || 0;
    const total = node._habitCount || 0;
    const completed = node._completedToday || 0;

    // Borde por estado
    let borderColor = '#333';
    let glowAlpha = 0;
    if (total === 0) {
      borderColor = '#2a2a2a';
    } else if (pct === 1) {
      borderColor = '#4ade80';
    } else if (pct > 0) {
      borderColor = '#fbbf24';
      // Glow pulsante si hay pendientes
      glowAlpha = 0.12 + 0.06 * Math.sin(t * 0.06);
    } else {
      borderColor = '#444';
      glowAlpha = 0.08 + 0.04 * Math.sin(t * 0.04);
    }

    // Glow
    if (glowAlpha > 0) {
      ctx.save();
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = glowAlpha * 3;
      roundRectPath(ctx, 0, 0, W, H, 10);
      ctx.fillStyle = borderColor;
      ctx.fill();
      ctx.restore();
    }

    // Fondo
    roundRectPath(ctx, 0, 0, W, H, 10);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Borde
    roundRectPath(ctx, 0, 0, W, H, 10);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Nombre (encima del nodo — fuera de la caja, se dibuja encima)
    ctx.fillStyle = '#aaa';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node._name || 'Sin nombre', W / 2, -8);

    // Puntos de hábitos
    if (total > 0) {
      const dotR = 5;
      const spacing = 14;
      const startX = W / 2 - ((total - 1) * spacing) / 2;
      const dotY = H / 2 - 8;

      for (let i = 0; i < total; i++) {
        const done = i < completed;
        ctx.beginPath();
        ctx.arc(startX + i * spacing, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = done ? '#4ade80' : '#333';
        ctx.fill();
        ctx.strokeStyle = done ? '#4ade80' : '#555';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      // Sin hábitos aún
      ctx.fillStyle = '#333';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin hábitos', W / 2, H / 2);
    }

    // Mini barra de progreso
    if (total > 0) {
      const barY = H - 18;
      const barW = W - 24;
      const barH = 3;
      const barX = 12;

      ctx.fillStyle = '#222';
      roundRectPath(ctx, barX, barY, barW, barH, 2);
      ctx.fill();

      if (pct > 0) {
        ctx.fillStyle = pct === 1 ? '#4ade80' : '#fbbf24';
        roundRectPath(ctx, barX, barY, barW * pct, barH, 2);
        ctx.fill();
      }

      // Porcentaje texto
      ctx.fillStyle = '#555';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(pct * 100) + '%', W - 12, barY - 3);
    }
  }

  function renderIdentityNode(ctx, node, t) {
    const W = node.width;
    const H = node.height;

    // Fondo
    roundRectPath(ctx, 0, 0, W, H, 10);
    ctx.fillStyle = '#0d0d0d';
    ctx.fill();

    // Borde sutil
    roundRectPath(ctx, 0, 0, W, H, 10);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Nombre encima
    ctx.fillStyle = '#888';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node._name || 'Identidad', W / 2, -7);

    // Emoji central
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node._emoji || '◈', W / 2, H / 2 + 8);
  }

  function renderSilhouetteNode(ctx, node, t) {
    const W = node.width;
    const H = node.height;
    const gender = User.getGender ? User.getGender() : 'male';

    // Glow tenue pulsante
    const glowA = 0.04 + 0.02 * Math.sin(t * 0.03);
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.globalAlpha = glowA * 4;
    roundRectPath(ctx, 0, 0, W, H, 12);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();

    // Fondo
    roundRectPath(ctx, 0, 0, W, H, 12);
    ctx.fillStyle = '#080808';
    ctx.fill();

    // Borde
    roundRectPath(ctx, 0, 0, W, H, 12);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Placeholder SVG silueta (reemplazar con el SVG real en Fase 3)
    drawPlaceholderSilhouette(ctx, W, H, gender, t);

    // Etiqueta encima
    ctx.fillStyle = '#555';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TÚ', W / 2, -7);
  }

  function drawPlaceholderSilhouette(ctx, W, H, gender, t) {
    // Silueta humana simplificada (placeholder hasta que el usuario entregue los SVG)
    const cx = W / 2;
    const pulse = 0.85 + 0.05 * Math.sin(t * 0.03);
    ctx.save();
    ctx.globalAlpha = pulse * 0.6;
    ctx.fillStyle = '#ffffff18';
    ctx.strokeStyle = '#ffffff33';
    ctx.lineWidth = 1;

    // Cabeza
    ctx.beginPath();
    ctx.arc(cx, H * 0.18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cuerpo
    ctx.beginPath();
    ctx.moveTo(cx, H * 0.28);
    ctx.lineTo(cx, H * 0.62);
    ctx.stroke();

    // Brazos
    ctx.beginPath();
    ctx.moveTo(cx - 14, H * 0.38);
    ctx.lineTo(cx + 14, H * 0.38);
    ctx.stroke();

    // Piernas
    ctx.beginPath();
    ctx.moveTo(cx, H * 0.62);
    ctx.lineTo(cx - 10, H * 0.85);
    ctx.moveTo(cx, H * 0.62);
    ctx.lineTo(cx + 10, H * 0.85);
    ctx.stroke();

    ctx.restore();
  }

  /* Rounded rect path helper (sin fill/stroke) */
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ============================================
     NODE EVENTS
     ============================================ */
  function handleNodeDblClick(id, e) {
    hideContextMenu();
    if (id === '_silhouette') return;
    const block = Blocks.find(id);
    if (block) { openBlockForm(block); return; }
    const identity = Identities.find(id);
    if (identity) openIdentityForm(identity);
  }

  function handleNodeMoved(id, x, y) {
    if (id === '_silhouette') { Silhouette.setPosition(x, y); return; }
    const block = Blocks.find(id);
    if (block) { Blocks.setPosition(id, x, y); return; }
    const identity = Identities.find(id);
    if (identity) Identities.setPosition(id, x, y);
  }

  /* ============================================
     CONTEXT MENU
     ============================================ */
  function showContextMenu(nodeId, pos) {
    contextTarget = nodeId;
    const menu = el('canvas-context-menu');
    if (!menu) return;
    menu.style.left = pos.x + 'px';
    menu.style.top = pos.y + 'px';
    menu.classList.remove('hidden');
  }

  function hideContextMenu() {
    const menu = el('canvas-context-menu');
    if (menu) menu.classList.add('hidden');
    contextTarget = null;
  }

  function bindContextMenu() {
    const menu = el('canvas-context-menu');
    if (!menu) return;
    menu.querySelectorAll('.ctx-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = contextTarget;
        hideContextMenu();
        if (!id) return;

        if (action === 'edit') {
          if (id === '_silhouette') return;
          const block = Blocks.find(id);
          if (block) { openBlockForm(block); return; }
          const identity = Identities.find(id);
          if (identity) openIdentityForm(identity);
        } else if (action === 'connect') {
          openConnectModal(id);
        } else if (action === 'delete') {
          confirmDeleteNode(id);
        }
      });
    });
  }

  /* ============================================
     TOOLBAR
     ============================================ */
  function bindToolbar() {
    const btnBlock = el('btn-new-block');
    if (btnBlock) btnBlock.onclick = () => openBlockForm(null);

    const btnIdentity = el('btn-new-identity');
    if (btnIdentity) btnIdentity.onclick = () => openIdentityForm(null);

    const btnFit = el('btn-fit-all');
    if (btnFit) btnFit.onclick = () => engine && engine.fitAll();

    const btnLayout = el('btn-auto-layout');
    if (btnLayout) btnLayout.onclick = autoLayout;

    const snapToggle = el('toggle-snap');
    if (snapToggle) {
      snapToggle.onchange = () => engine && engine.setSnap(snapToggle.checked);
    }

    const btnFocusDay = el('btn-focus-day');
    if (btnFocusDay) {
      btnFocusDay.onclick = () => {
        const panel = el('focus-day-panel');
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        if (isHidden) { renderFocusDay(); panel.classList.remove('hidden'); }
        else panel.classList.add('hidden');
      };
    }

    const btnTask = el('btn-new-task-canvas');
    if (btnTask) btnTask.onclick = () => openTaskForm(null);

    bindContextMenu();
  }

  /* ============================================
     AUTO LAYOUT
     Organiza nodos en filas: bloques arriba (y=80),
     identidades en medio (y=320), silueta abajo (y=560)
     ============================================ */
  function autoLayout() {
    const blocks = Blocks.list();
    const identities = Identities.list();

    const BLOCK_GAP = 200;
    const IDENTITY_GAP = 180;

    // Bloques: fila superior, centrados
    const totalBlockW = blocks.length * BLOCK_W + (blocks.length - 1) * (BLOCK_GAP - BLOCK_W);
    blocks.forEach((b, i) => {
      const x = i * BLOCK_GAP - totalBlockW / 2 + BLOCK_W / 2;
      Blocks.setPosition(b.id, x, 80);
    });

    // Identidades: fila media
    const totalIdW = identities.length * IDENTITY_W + (identities.length - 1) * (IDENTITY_GAP - IDENTITY_W);
    identities.forEach((id, i) => {
      const x = i * IDENTITY_GAP - totalIdW / 2 + IDENTITY_W / 2;
      Identities.setPosition(id.id, x, 320);
    });

    // Silueta: fija debajo de todo
    Silhouette.setPosition(-SILHOUETTE_W / 2, 560);

    refreshCanvas();
    if (engine) setTimeout(() => engine.fitAll(), 50);
  }

  /* ============================================
     FOCUS DAY PANEL
     ============================================ */
  function bindFocusDay() {
    const btnClose = el('btn-close-focus');
    if (btnClose) btnClose.onclick = () => el('focus-day-panel').classList.add('hidden');
  }

  function renderFocusDay() {
    const list = el('focus-day-list');
    if (!list) return;

    const today = todayStr();
    const habits = Habits.list().filter(h => h.active);
    const todayLog = Logs.get(today);
    const completedIds = todayLog ? (todayLog.completed_habits || []) : [];

    // Solo hábitos con bloque, tipo habito/habitor que sean activos hoy
    const todayHabits = habits.filter(h => {
      if (h.type === 'habitod') return false; // habitod tienen su propia lógica de notificación
      return true;
    });

    if (!todayHabits.length) {
      list.innerHTML = '<p class="focus-day-empty">Sin hábitos para hoy.</p>';
      return;
    }

    list.innerHTML = todayHabits.map(h => {
      const done = completedIds.includes(h.id);
      const typeBadge = h.type === 'habitor' ? 'R' : h.type === 'habitod' ? 'D' : '';
      return `
        <div class="focus-day-item ${done ? 'done' : ''}" data-habit-id="${h.id}">
          <div class="focus-day-check">${done ? '✓' : ''}</div>
          <span class="focus-day-name">${h.name}</span>
          ${typeBadge ? `<span class="focus-day-type-badge">${typeBadge}</span>` : ''}
        </div>`;
    }).join('');

    list.querySelectorAll('[data-habit-id]').forEach(item => {
      item.addEventListener('click', () => {
        const activeCount = habits.length;
        Logs.toggleHabit(item.dataset.habitId, today, activeCount);
        renderFocusDay();
        refreshCanvas();
      });
    });
  }

  /* ============================================
     TUTORIAL
     ============================================ */
  function bindTutorial() {
    const next1 = el('tutorial-next-1');
    const next2 = el('tutorial-next-2');
    const finish = el('tutorial-finish');

    if (next1) next1.onclick = () => {
      hide('tutorial-step-1');
      show('tutorial-step-2');
    };

    if (next2) next2.onclick = () => {
      hide('tutorial-step-2');
      show('tutorial-step-3');
    };

    if (finish) finish.onclick = () => {
      hide('canvas-tutorial');
      localStorage.setItem('habitos_tutorial_seen', '1');
    };
  }

  /* ============================================
     BLOCK FORM (stub — formulario completo en Fase 4)
     ============================================ */
  function openBlockForm(block) {
    // Stub: en Fase 4 se abre el modal de bloque con sus 3 tipos de hábito.
    // Por ahora solo permite crear/renombrar un bloque.
    const name = prompt(block ? 'Renombrar bloque:' : 'Nombre del bloque:', block ? block.name : '');
    if (!name || !name.trim()) return;

    if (block) {
      Blocks.update(block.id, { name: name.trim() });
    } else {
      // Posición inicial: centro del canvas visible
      const cam = engine ? engine.getCamera() : { x: 0, y: 0, scale: 1 };
      const container = el('canvas-container');
      const cx = container ? container.clientWidth / 2 : 300;
      const cy = container ? container.clientHeight / 2 : 200;
      const wx = (cx - cam.x) / cam.scale;
      const wy = (cy - cam.y) / cam.scale;
      Blocks.create({ name: name.trim(), x: wx - BLOCK_W / 2, y: wy - BLOCK_H / 2 });
    }

    refreshCanvas();
  }

  /* ============================================
     IDENTITY FORM (stub — formulario completo en Fase 4)
     ============================================ */
  function openIdentityForm(identity) {
    const label = prompt(identity ? 'Renombrar identidad:' : 'Nombre de la identidad:', identity ? identity.label : '');
    if (!label || !label.trim()) return;

    if (identity) {
      Identities.update(identity.id, { label: label.trim() });
    } else {
      const emoji = prompt('Emoji para esta identidad (opcional):', '◈') || '◈';
      const cam = engine ? engine.getCamera() : { x: 0, y: 0, scale: 1 };
      const container = el('canvas-container');
      const cx = container ? container.clientWidth / 2 : 300;
      const cy = container ? container.clientHeight / 2 : 400;
      const wx = (cx - cam.x) / cam.scale;
      const wy = (cy - cam.y) / cam.scale + 200;
      Identities.create({ label: label.trim(), emoji, x: wx - IDENTITY_W / 2, y: wy });
    }

    refreshCanvas();
  }

  /* ============================================
     CONNECT MODAL (stub — completo en Fase 4)
     ============================================ */
  function openConnectModal(fromId) {
    const blocks = Blocks.list();
    const identities = Identities.list();
    const fromBlock = Blocks.find(fromId);
    const fromIdentity = Identities.find(fromId);

    let options = [];
    if (fromBlock) {
      options = [
        ...blocks.filter(b => b.id !== fromId).map(b => ({ id: b.id, type: 'block', label: b.name })),
        ...identities.map(id => ({ id: id.id, type: 'identity', label: id.label })),
      ];
    } else if (fromIdentity) {
      options = [{ id: 'silhouette', type: 'silhouette', label: 'Silueta (tú)' }];
    }

    if (!options.length) {
      alert('No hay nodos disponibles para conectar. Crea más bloques o identidades primero.');
      return;
    }

    const choice = prompt(
      'Conectar a:\n' + options.map((o, i) => `${i + 1}. ${o.label} (${o.type})`).join('\n') +
      '\n\nEscribe el número:'
    );
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= options.length) return;

    const target = options[idx];
    const fromType = fromBlock ? 'block' : 'identity';
    Connections.create({
      from_id: fromId,
      from_type: fromType,
      to_id: target.id,
      to_type: target.type,
    });

    refreshCanvas();
  }

  /* ============================================
     DELETE NODE
     ============================================ */
  function confirmDeleteNode(id) {
    const block = Blocks.find(id);
    const identity = Identities.find(id);
    const label = block ? block.name : identity ? identity.label : id;
    if (!confirm(`¿Eliminar "${label}"? Las conexiones también se eliminarán.`)) return;

    if (block) Blocks.remove(id);
    else if (identity) Identities.remove(id);

    refreshCanvas();
  }

  /* ============================================
     TASK FORM
     ============================================ */
  function openTaskForm(task) {
    el('task-edit-id').value = task ? task.id : '';
    el('task-name').value = task ? task.name : '';
    el('task-purpose').value = task ? task.purpose : '';
    el('task-date').value = task ? (task.due_date || todayStr()) : todayStr();
    el('task-priority').value = task ? task.priority : 'medium';
    hide('task-error');
    setText('modal-task-title', task ? 'Editar Tarea' : 'Nueva Tarea');
    setText('btn-save-task', task ? 'Guardar Cambios' : 'Crear Tarea');
    openModal('modal-task');
  }

  function bindTaskModal() {
    const btnSaveTask = el('btn-save-task');
    if (btnSaveTask) {
      btnSaveTask.onclick = () => {
        const name = el('task-name').value.trim();
        const purpose = el('task-purpose').value.trim();
        if (!name) { showTaskError('Nombre requerido.'); return; }
        if (!purpose) { showTaskError('Propósito obligatorio.'); return; }
        const data = {
          name, purpose,
          due_date: el('task-date').value,
          priority: el('task-priority').value,
        };
        const editId = el('task-edit-id').value;
        if (editId) Tasks.update(editId, data);
        else Tasks.create(data);
        closeModal('modal-task');
      };
    }

    const btnConfirm = el('btn-confirm-delete');
    if (btnConfirm) {
      btnConfirm.onclick = () => {
        if (Habitos._pendingDeleteFn) { Habitos._pendingDeleteFn(); Habitos._pendingDeleteFn = null; }
        closeModal('modal-confirm');
      };
    }
  }

  function showTaskError(msg) {
    const e = el('task-error');
    if (e) { e.textContent = msg; e.classList.remove('hidden'); }
  }

  return { render, refreshCanvas, _pendingDeleteFn: null };
})();
