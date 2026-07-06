/**
 * canvas.js — Motor de canvas infinito estilo n8n
 * Pan, zoom, drag de nodos, conexiones bezier, minimap, snap to grid,
 * fondo Starlight (Rolls-Royce style), y sistema de eventos genérico.
 *
 * Uso:
 *   const engine = CanvasEngine.create(containerEl, options);
 *   engine.setNodes(nodes);        // [{ id, x, y, width, height, render(ctx,node,camera) }]
 *   engine.setConnections(conns);  // [{ id, fromId, toId, color? }]
 *   engine.on('nodeMoved', (id, x, y) => { ... });
 *   engine.on('nodeClick', (id, e) => { ... });
 *   engine.on('nodeDblClick', (id, e) => { ... });
 *   engine.on('nodeRightClick', (id, e) => { ... });
 *   engine.on('nodeLongPress', (id, e, pos) => { ... }); // NUEVO: para móvil
 *   engine.on('canvasClick', (worldX, worldY) => { ... });
 *   engine.destroy();
 */

const CanvasEngine = (() => {

  /* ============================================
     CONSTANTES
     ============================================ */
  const ZOOM_MIN = 0.2;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.1;
  const GRID_SIZE = 20;
  const MINIMAP_W = 160;
  const MINIMAP_H = 100;
  const MINIMAP_PAD = 12;
  const CONNECTION_COLOR = '#ffffff22';
  const CONNECTION_HOVER_COLOR = '#ffffff55';
  const BEZIER_CP_OFFSET = 120; // control point horizontal offset
  const LONG_PRESS_DURATION = 500; // ms para considerar long press en móvil

  /* ============================================
     STARLIGHT BACKGROUND (MEJORADO)
     ============================================ */
  function createStars(count) {
    return Array.from({ length: count }, () => ({
      x: Math.random(),        // 0–1 normalized (relative to canvas size)
      y: Math.random(),
      r: Math.random() < 0.7 ? 0.5 : Math.random() < 0.9 ? 0.8 : 1,
      baseAlpha: 0.06 + Math.random() * 0.18,
      twinkleSpeed: Math.random() < 0.35 ? 0.0004 + Math.random() * 0.0012 : 0,
      twinkleOffset: Math.random() * Math.PI * 2,
      pulsePhase: Math.random() * Math.PI * 2,
    }));
  }

  function drawStars(ctx, stars, w, h, t) {
    stars.forEach(s => {
      let alpha = s.baseAlpha;
      // Twinkle suave con variación de fade
      if (s.twinkleSpeed > 0) {
        alpha = s.baseAlpha * (0.4 + 0.6 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset));
      }
      // Agregar micro-pulsación para más vida
      alpha *= (0.9 + 0.1 * Math.sin(t * 0.0001 + s.pulsePhase));
      
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /* ============================================
     MATH HELPERS
     ============================================ */
  function screenToWorld(sx, sy, cam) {
    return {
      x: (sx - cam.x) / cam.scale,
      y: (sy - cam.y) / cam.scale,
    };
  }

  function worldToScreen(wx, wy, cam) {
    return {
      x: wx * cam.scale + cam.x,
      y: wy * cam.scale + cam.y,
    };
  }

  function snapToGrid(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /* ============================================
     HIT TESTING
     ============================================ */
  function hitNode(node, wx, wy) {
    return (
      wx >= node.x &&
      wx <= node.x + node.width &&
      wy >= node.y &&
      wy <= node.y + node.height
    );
  }

  function hitNodeAt(nodes, wx, wy) {
    // Iterate in reverse so top-rendered nodes (last) are hit first
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (hitNode(nodes[i], wx, wy)) return nodes[i];
    }
    return null;
  }

  /* ============================================
     CONNECTION DRAWING
     ============================================ */
  function drawConnection(ctx, from, to, color, hovered) {
    const fx = from.x + from.width;
    const fy = from.y + from.height / 2;
    const tx = to.x;
    const ty = to.y + to.height / 2;

    // If 'to' is the silhouette node (special final node), connect to center-top
    if (to._silhouette) {
      const tsx = to.x + to.width / 2;
      const tsy = to.y;
      drawBezier(ctx, fx, fy, tsx, tsy, color, hovered, true);
      return;
    }

    drawBezier(ctx, fx, fy, tx, ty, color, hovered, false);
  }

  function drawBezier(ctx, fx, fy, tx, ty, color, hovered, toCenter) {
    const dx = Math.abs(tx - fx);
    const cpOffset = Math.max(BEZIER_CP_OFFSET, dx * 0.5);

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.bezierCurveTo(
      fx + cpOffset, fy,
      tx - (toCenter ? 0 : cpOffset), ty,
      tx, ty
    );
    ctx.strokeStyle = hovered ? CONNECTION_HOVER_COLOR : (color || CONNECTION_COLOR);
    ctx.lineWidth = hovered ? 1.5 : 1;
    ctx.stroke();

    // Arrowhead
    drawArrow(ctx, tx - (toCenter ? 0 : 6), ty, tx, ty, hovered ? CONNECTION_HOVER_COLOR : (color || CONNECTION_COLOR));
  }

  function drawArrow(ctx, fromX, fromY, toX, toY, color) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const len = 6;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - len * Math.cos(angle - Math.PI / 6), toY - len * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - len * Math.cos(angle + Math.PI / 6), toY - len * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* ============================================
     MINIMAP
     ============================================ */
  function drawMinimap(ctx, nodes, cam, canvasW, canvasH) {
    const mx = canvasW - MINIMAP_W - MINIMAP_PAD;
    const my = canvasH - MINIMAP_H - MINIMAP_PAD;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    roundRect(ctx, mx, my, MINIMAP_W, MINIMAP_H, 6);
    ctx.fill();
    ctx.stroke();

    if (!nodes.length) return;

    // Compute world bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    const pad = 40;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;

    const scaleX = MINIMAP_W / worldW;
    const scaleY = MINIMAP_H / worldH;
    const ms = Math.min(scaleX, scaleY);

    // Draw nodes
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, mx, my, MINIMAP_W, MINIMAP_H, 6);
    ctx.clip();

    nodes.forEach(n => {
      const nx = mx + (n.x - minX) * ms;
      const ny = my + (n.y - minY) * ms;
      const nw = n.width * ms;
      const nh = n.height * ms;
      ctx.fillStyle = n._silhouette ? '#ffffff22' : (n._identity ? '#ffffff18' : '#ffffff15');
      ctx.strokeStyle = n._silhouette ? '#ffffff55' : (n._identity ? '#ffffff33' : '#ffffff25');
      ctx.lineWidth = 0.5;
      roundRect(ctx, nx, ny, Math.max(nw, 4), Math.max(nh, 4), 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw viewport rect
    const vx = mx + (-cam.x / cam.scale - minX) * ms;
    const vy = my + (-cam.y / cam.scale - minY) * ms;
    const vw = (canvasW / cam.scale) * ms;
    const vh = (canvasH / cam.scale) * ms;
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);

    ctx.restore();
  }

  /* ============================================
     ROUNDED RECT HELPER
     ============================================ */
  function roundRect(ctx, x, y, w, h, r) {
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
     FACTORY PRINCIPAL
     ============================================ */
  function create(container, options = {}) {
    const opts = {
      snapToGrid: false,
      starCount: 75,
      ...options,
    };

    /* --- State --- */
    let nodes = [];
    let connections = [];
    let camera = CanvasView ? CanvasView.get() : { x: 0, y: 0, scale: 1 };
    let dragging = null;        // { node, startWorldX, startWorldY, startNodeX, startNodeY }
    let panning = false;
    let panStart = { x: 0, y: 0, camX: 0, camY: 0 };
    let hoveredNodeId = null;
    let hoveredConnId = null;
    let snapEnabled = opts.snapToGrid;
    let listeners = {};
    let rafId = null;
    let t = 0;
    let stars = createStars(opts.starCount);
    let longPressTimer = null;
    let longPressNode = null;

    /* --- Canvas setup --- */
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    /* --- Resize --- */
    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    function resize() {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    resize();

    /* --- Events --- */
    function emit(event, ...args) {
      (listeners[event] || []).forEach(fn => fn(...args));
    }

    function on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    }

    function off(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(f => f !== fn);
    }

    /* --- Mouse helpers --- */
    function getMousePos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    /* --- Pointer down --- */
    function onPointerDown(e) {
      if (e.button === 2) return; // right click handled separately
      const pos = getMousePos(e);
      const world = screenToWorld(pos.x, pos.y, camera);
      const node = hitNodeAt(nodes, world.x, world.y);

      // Start long-press timer para móvil
      if (node && (e.touches || window.innerWidth <= 768)) {
        longPressNode = node;
        longPressTimer = setTimeout(() => {
          emit('nodeLongPress', node.id, e, pos);
          longPressTimer = null;
        }, LONG_PRESS_DURATION);
      }

      if (node) {
        dragging = {
          node,
          startWorldX: world.x,
          startWorldY: world.y,
          startNodeX: node.x,
          startNodeY: node.y,
          moved: false,
        };
        canvas.style.cursor = 'grabbing';
      } else {
        panning = true;
        panStart = { x: pos.x, y: pos.y, camX: camera.x, camY: camera.y };
        canvas.style.cursor = 'grabbing';
      }

      e.preventDefault();
    }

    /* --- Pointer move --- */
    function onPointerMove(e) {
      const pos = getMousePos(e);
      const world = screenToWorld(pos.x, pos.y, camera);

      // Cancelar long-press si hay movimiento
      if (dragging && longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (dragging) {
        const dx = world.x - dragging.startWorldX;
        const dy = world.y - dragging.startWorldY;
        let nx = dragging.startNodeX + dx;
        let ny = dragging.startNodeY + dy;

        if (snapEnabled) {
          nx = snapToGrid(nx);
          ny = snapToGrid(ny);
        }

        dragging.node.x = nx;
        dragging.node.y = ny;
        dragging.moved = true;
        return;
      }

      if (panning) {
        camera.x = panStart.camX + (pos.x - panStart.x);
        camera.y = panStart.camY + (pos.y - panStart.y);
        return;
      }

      // Hover detection
      const hovered = hitNodeAt(nodes, world.x, world.y);
      const newHoverId = hovered ? hovered.id : null;
      if (newHoverId !== hoveredNodeId) {
        hoveredNodeId = newHoverId;
        canvas.style.cursor = hoveredNodeId ? 'pointer' : 'grab';
      }
    }

    /* --- Pointer up --- */
    function onPointerUp(e) {
      // Cancelar long-press si termina sin hacer movimiento significativo
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (dragging) {
        if (dragging.moved) {
          emit('nodeMoved', dragging.node.id, dragging.node.x, dragging.node.y);
          // Persist camera
          if (CanvasView) CanvasView.save(camera);
        } else {
          emit('nodeClick', dragging.node.id, e);
        }
        dragging = null;
      } else if (panning) {
        panning = false;
        if (CanvasView) CanvasView.save(camera);
      }
      canvas.style.cursor = hoveredNodeId ? 'pointer' : 'grab';
    }

    /* --- Double click --- */
    function onDblClick(e) {
      const pos = getMousePos(e);
      const world = screenToWorld(pos.x, pos.y, camera);
      const node = hitNodeAt(nodes, world.x, world.y);
      if (node) emit('nodeDblClick', node.id, e);
      else emit('canvasDblClick', world.x, world.y);
    }

    /* --- Right click --- */
    function onContextMenu(e) {
      e.preventDefault();
      const pos = getMousePos(e);
      const world = screenToWorld(pos.x, pos.y, camera);
      const node = hitNodeAt(nodes, world.x, world.y);
      if (node) emit('nodeRightClick', node.id, e, pos);
      else emit('canvasRightClick', world.x, world.y, e);
    }

    /* --- Wheel (zoom) --- */
    function onWheel(e) {
      e.preventDefault();
      const pos = getMousePos(e);
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newScale = clamp(camera.scale + delta, ZOOM_MIN, ZOOM_MAX);

      // Zoom towards cursor
      const worldBefore = screenToWorld(pos.x, pos.y, camera);
      camera.scale = newScale;
      const worldAfter = screenToWorld(pos.x, pos.y, camera);
      camera.x += (worldAfter.x - worldBefore.x) * camera.scale;
      camera.y += (worldAfter.y - worldBefore.y) * camera.scale;
    }

    /* --- Touch --- */
    let lastTouchDist = null;
    function onTouchMove(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastTouchDist !== null) {
          const delta = (dist - lastTouchDist) * 0.005;
          camera.scale = clamp(camera.scale + delta, ZOOM_MIN, ZOOM_MAX);
        }
        lastTouchDist = dist;
      } else {
        lastTouchDist = null;
        onPointerMove(e);
      }
    }

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp);

    /* ============================================
       RENDER LOOP
       ============================================ */
    function draw() {
      rafId = requestAnimationFrame(draw);
      t++;

      const W = canvas.width;
      const H = canvas.height;
      if (!W || !H) return;

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Starlight (con más vida)
      drawStars(ctx, stars, W, H, t);

      // Transform: world space
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.scale, camera.scale);

      // Connections
      ctx.save();
      connections.forEach(conn => {
        const fromNode = nodes.find(n => n.id === conn.fromId);
        const toNode = nodes.find(n => n.id === conn.toId);
        if (!fromNode || !toNode) return;
        const hovered = hoveredConnId === conn.id;
        drawConnection(ctx, fromNode, toNode, conn.color, hovered);
      });
      ctx.restore();

      // Nodes
      nodes.forEach(node => {
        ctx.save();
        ctx.translate(node.x, node.y);
        if (node.render) node.render(ctx, node, camera, t);
        ctx.restore();
      });

      ctx.restore(); // end world space

      // Minimap (screen space, always on top)
      drawMinimap(ctx, nodes, camera, W, H);
    }

    /* ============================================
       PUBLIC API
       ============================================ */
    function setNodes(newNodes) {
      nodes = newNodes;
    }

    function setConnections(newConns) {
      connections = newConns;
    }

    function getNode(id) {
      return nodes.find(n => n.id === id);
    }

    function centerOn(worldX, worldY) {
      const W = canvas.width;
      const H = canvas.height;
      camera.x = W / 2 - worldX * camera.scale;
      camera.y = H / 2 - worldY * camera.scale;
    }

    function fitAll() {
      if (!nodes.length) return;
      const W = canvas.width;
      const H = canvas.height;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      });
      const pad = 80;
      const worldW = maxX - minX + pad * 2;
      const worldH = maxY - minY + pad * 2;
      const scale = clamp(Math.min(W / worldW, H / worldH), ZOOM_MIN, ZOOM_MAX);
      camera.scale = scale;
      camera.x = W / 2 - ((minX + maxX) / 2) * scale;
      camera.y = H / 2 - ((minY + maxY) / 2) * scale;
    }

    function setSnap(enabled) {
      snapEnabled = enabled;
    }

    function getCamera() {
      return { ...camera };
    }

    function setCamera(cam) {
      camera = { ...camera, ...cam };
    }

    function destroy() {
      cancelAnimationFrame(rafId);
      if (longPressTimer) clearTimeout(longPressTimer);
      ro.disconnect();
      canvas.removeEventListener('mousedown', onPointerDown);
      canvas.removeEventListener('mousemove', onPointerMove);
      canvas.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('mouseleave', onPointerUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onPointerDown);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onPointerUp);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    // Start loop
    draw();

    return {
      on, off,
      setNodes, setConnections,
      getNode,
      centerOn, fitAll,
      setSnap, getCamera, setCamera,
      destroy,
      // Expose for external renders
      roundRect,
      get canvas() { return canvas; },
      get ctx() { return ctx; },
    };
  }

  return { create, GRID_SIZE, snapToGrid };

})();
