// Story Studio - Main Application
class StoryStudio {
  constructor() {
    this.db = this.initDB();
    this.state = {
      currentProject: null,
      projects: [],
      config: {},
      wordStock: { hooks: [], ctas: [], transitions: [], keywords: [], favorites: [] },
      synonyms: {},
      selectedBlock: null,
      selectedText: null,
    };
    this.autosaveTimer = null;
    this.init();
  }

  initDB() {
    return {
      get: (key) => JSON.parse(localStorage.getItem(key) || 'null'),
      set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
      remove: (key) => localStorage.removeItem(key),
    };
  }

  async init() {
    await this.loadConfig();
    await this.loadWordStock();
    await this.loadSynonyms();
    this.loadProjects();
    this.setupUI();
    this.setupEventListeners();
    this.showLoader();
    setTimeout(() => this.hideLoader(), 1200);
  }

  async loadConfig() {
    try {
      const res = await fetch('config.json');
      this.state.config = await res.json();
    } catch (e) {
      console.error('Config load error:', e);
      this.state.config = {};
    }
  }

  async loadWordStock() {
    try {
      const res = await fetch('wordStock.json');
      this.state.wordStock = await res.json();
    } catch (e) {
      this.state.wordStock = { hooks: [], ctas: [], transitions: [], keywords: [], favorites: [] };
    }
  }

  async loadSynonyms() {
    try {
      const res = await fetch('synonyms.json');
      this.state.synonyms = await res.json();
    } catch (e) {
      this.state.synonyms = {};
    }
  }

  loadProjects() {
    this.state.projects = this.db.get('projects') || [];
    if (this.state.projects.length === 0) this.createDefaultProject();
    this.renderProjectList();
    this.selectProject(this.state.projects[0].id);
  }

  createDefaultProject() {
    const project = {
      id: this.generateId(),
      name: 'My First Script',
      created: Date.now(),
      updated: Date.now(),
      blocks: [],
      media: [],
    };
    this.state.projects.push(project);
    this.db.set('projects', this.state.projects);
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  setupUI() {
    this.updateProjectCount();
    this.updateWordstockCount();
    this.renderBlockToolbar();
    this.renderLimits();
    this.renderContextPanel();
  }

  setupEventListeners() {
    // Tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(tab.dataset.tab));
    });

    // Projects
    document.getElementById('newProjectBtn').addEventListener('click', () => this.showNewProjectModal());
    document.getElementById('projectSearch').addEventListener('input', (e) => this.filterProjects(e.target.value));
    document.getElementById('exportBtn').addEventListener('click', () => this.exportProject());
    document.getElementById('importBtn').addEventListener('click', () => this.importProject());
    document.getElementById('teleprompterBtn').addEventListener('click', () => this.openTeleprompter());

    // Script title
    document.getElementById('scriptTitle').addEventListener('blur', (e) => this.updateScriptTitle(e.target.value));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Block toolbar
    this.renderBlockToolbar();

    // Context panel
    document.getElementById('contextPanel').addEventListener('click', (e) => {
      if (e.target.closest('.ctx-label')) {
        const section = e.target.closest('.context-section');
        section.classList.toggle('collapsed');
      }
    });

    // Wordstock
    document.getElementById('wsAddBtn').addEventListener('click', () => this.addToWordstock());
    document.getElementById('wsAddInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addToWordstock();
    });

    // Wordstock categories
    document.querySelectorAll('.ws-cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.ws-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderWordstockList(btn.dataset.category);
      });
    });

    // Media upload
    const uploadZone = document.getElementById('uploadZone');
    uploadZone.addEventListener('click', () => this.triggerMediaUpload());
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      this.handleMediaDrop(e.dataTransfer.files);
    });

    // Teleprompter
    document.getElementById('tpPlayBtn').addEventListener('click', () => this.playTeleprompter());
    document.getElementById('tpPauseBtn').addEventListener('click', () => this.pauseTeleprompter());
    document.getElementById('tpResetBtn').addEventListener('click', () => this.resetTeleprompter());
    document.getElementById('tpCloseBtn').addEventListener('click', () => this.closeTeleprompter());
    document.getElementById('tpSpeed').addEventListener('input', (e) => {
      document.getElementById('tpSpeedValue').textContent = e.target.value + 'x';
    });
    document.getElementById('tpSize').addEventListener('input', (e) => {
      const size = e.target.value;
      document.getElementById('tpSizeValue').textContent = size;
      document.getElementById('teleprompterContent').style.fontSize = size + 'px';
    });
  }

  switchTab(tab) {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelector(`.tab-content[data-tab="${tab}"]`).style.display = 'block';

    if (tab === 'wordstock') this.renderWordstockList('all');
    if (tab === 'media') this.renderMediaGrid();
  }

  renderProjectList() {
    const list = document.getElementById('projectList');
    const search = document.getElementById('projectSearch').value.toLowerCase();
    const filtered = this.state.projects.filter(p => p.name.toLowerCase().includes(search));

    list.innerHTML = filtered.map(p => `
      <div class="project-item ${this.state.currentProject?.id === p.id ? 'active' : ''}" data-id="${p.id}">
        <div class="project-item-icon">📄</div>
        <div class="project-item-info">
          <div class="project-item-name">${this.escapeHtml(p.name)}</div>
          <div class="project-item-meta">${p.blocks.length} blocks · ${new Date(p.updated).toLocaleDateString()}</div>
        </div>
        <div class="project-item-actions">
          <button class="btn btn-icon" data-action="duplicate" title="Duplicate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 002 2h10a2 2 0 002-2V7"/><path d="M5 3a2 2 0 012-2h10a2 2 0 012 2v2H5z"/></svg>
          </button>
          <button class="btn btn-icon danger" data-action="delete" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6h16zM10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.project-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.project-item-actions')) {
          this.selectProject(item.dataset.id);
        }
      });
      item.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const id = item.dataset.id;
          if (action === 'duplicate') this.duplicateProject(id);
          if (action === 'delete') this.deleteProject(id);
        });
      });
    });
  }

  selectProject(id) {
    this.state.currentProject = this.state.projects.find(p => p.id === id);
    document.getElementById('projectName').textContent = this.state.currentProject.name;
    document.getElementById('scriptTitle').value = this.state.currentProject.name;
    this.renderBlocks();
    this.updateRitmoMeter();
    this.renderProjectList();
  }

  showNewProjectModal() {
    this.showModal('New Project', `
      <form id="newProjectForm" class="form-group">
        <label class="form-label">Project Name</label>
        <input type="text" class="form-input" id="projectNameInput" placeholder="My Script" required>
      </form>
    `, [
      { label: 'Cancel', action: () => this.hideModal() },
      { label: 'Create', action: () => this.createProject(), primary: true }
    ]);
    document.getElementById('projectNameInput').focus();
  }

  createProject() {
    const name = document.getElementById('projectNameInput').value.trim();
    if (!name) return this.notify('Project name required', 'error');
    if (this.state.projects.length >= 25) return this.notify('Limit reached: max 25 projects', 'error');

    const project = {
      id: this.generateId(),
      name,
      created: Date.now(),
      updated: Date.now(),
      blocks: [],
      media: [],
    };
    this.state.projects.push(project);
    this.db.set('projects', this.state.projects);
    this.hideModal();
    this.renderProjectList();
    this.selectProject(project.id);
    this.notify('Project created', 'success');
  }

  duplicateProject(id) {
    const original = this.state.projects.find(p => p.id === id);
    const copy = {
      ...JSON.parse(JSON.stringify(original)),
      id: this.generateId(),
      name: original.name + ' (Copy)',
      created: Date.now(),
      updated: Date.now(),
    };
    this.state.projects.push(copy);
    this.db.set('projects', this.state.projects);
    this.renderProjectList();
    this.notify('Project duplicated', 'success');
  }

  deleteProject(id) {
    if (confirm('Delete this project?')) {
      this.state.projects = this.state.projects.filter(p => p.id !== id);
      this.db.set('projects', this.state.projects);
      if (this.state.currentProject?.id === id) {
        this.selectProject(this.state.projects[0]?.id);
      }
      this.renderProjectList();
      this.notify('Project deleted', 'success');
    }
  }

  filterProjects(search) {
    this.renderProjectList();
  }

  updateScriptTitle(name) {
    if (this.state.currentProject) {
      this.state.currentProject.name = name;
      this.state.currentProject.updated = Date.now();
      this.saveProject();
      this.renderProjectList();
    }
  }

  renderBlockToolbar() {
    const toolbar = document.getElementById('blockToolbar');
    const blockTypes = this.state.config.editor?.defaultBlockTypes || [];
    toolbar.innerHTML = blockTypes.map(type => `
      <button class="block-type-btn" data-type="${type.id}" title="Add ${type.label}">
        <span class="dot" style="background: ${type.color}"></span>
        ${type.label}
      </button>
    `).join('');

    toolbar.querySelectorAll('.block-type-btn').forEach(btn => {
      btn.addEventListener('click', () => this.addBlock(btn.dataset.type));
    });
  }

  addBlock(type) {
    if (!this.state.currentProject) return;
    if (this.state.currentProject.blocks.length >= 1000) return this.notify('Block limit reached', 'error');

    const blockTypes = this.state.config.editor?.defaultBlockTypes || [];
    const blockType = blockTypes.find(t => t.id === type) || blockTypes[0];

    const block = {
      id: this.generateId(),
      type,
      title: blockType.label,
      content: '',
      notes: '',
      color: blockType.color,
      resources: [],
      collapsed: false,
    };
    this.state.currentProject.blocks.push(block);
    this.saveProject();
    this.renderBlocks();
    this.updateRitmoMeter();
  }

  renderBlocks() {
    const container = document.getElementById('blocksContainer');
    const blocks = this.state.currentProject?.blocks || [];

    if (blocks.length === 0) {
      container.innerHTML = `
        <div class="blocks-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
          <h3>No blocks yet</h3>
          <p>Create your first block to start building your script</p>
        </div>
      `;
      return;
    }

    container.innerHTML = blocks.map(block => this.renderBlockHTML(block)).join('');
    document.getElementById('blockCount').textContent = blocks.length + ' blocks';

    container.querySelectorAll('.script-block').forEach(el => {
      const blockId = el.dataset.id;
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;

      // Collapse/expand
      el.querySelector('.block-collapse-btn').addEventListener('click', () => this.toggleBlockCollapse(blockId));

      // Edit
      el.querySelector('.block-title-input').addEventListener('blur', (e) => {
        block.title = e.target.value;
        this.saveProject();
      });
      el.querySelector('.block-content-area').addEventListener('input', (e) => {
        block.content = e.target.value;
        this.saveProject();
        this.updateRitmoMeter();
      });

      // Notes
      el.querySelector('.block-notes-toggle')?.addEventListener('click', () => {
        el.querySelector('.block-notes-area').classList.toggle('visible');
      });
      el.querySelector('.block-notes-input')?.addEventListener('blur', (e) => {
        block.notes = e.target.value;
        this.saveProject();
      });

      // Actions
      el.querySelector('.block-duplicate-btn')?.addEventListener('click', () => this.duplicateBlock(blockId));
      el.querySelector('.block-delete-btn')?.addEventListener('click', () => this.deleteBlock(blockId));

      // Drag
      el.querySelector('.block-drag-handle').addEventListener('mousedown', (e) => this.startBlockDrag(e, blockId));

      // Selection
      el.addEventListener('click', () => this.selectBlock(blockId));
    });
  }

  renderBlockHTML(block) {
    const blockTypes = this.state.config.editor?.defaultBlockTypes || [];
    const type = blockTypes.find(t => t.id === block.type) || blockTypes[0];

    return `
      <div class="script-block ${block.collapsed ? 'collapsed' : ''}" data-id="${block.id}">
        <div class="block-color-bar" style="background: ${block.color}"></div>

        <div class="block-header">
          <div class="block-drag-handle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="16" cy="19" r="1"/></svg>
          </div>
          <div class="block-type-label" style="border-color: ${block.color}; color: ${block.color}">${type.label}</div>
          <input type="text" class="block-title-input" value="${this.escapeHtml(block.title)}" placeholder="Block title">
          <div class="block-actions">
            <button class="block-action-btn block-collapse-btn" title="Toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="block-action-btn block-duplicate-btn" title="Duplicate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 002 2h10a2 2 0 002-2V7"/><path d="M5 3a2 2 0 012-2h10a2 2 0 012 2v2H5z"/></svg>
            </button>
            <button class="block-action-btn danger block-delete-btn" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </div>

        <div class="block-body">
          <div class="block-content-area" contenteditable="true" data-placeholder="Write your content here...">${this.escapeHtml(block.content)}</div>

          <div class="block-footer">
            <button class="block-notes-toggle" title="Notes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              Notes
            </button>
            <span class="block-word-count">${block.content.split(/\s+/).filter(w => w).length} words</span>
          </div>

          <div class="block-notes-area">
            <textarea class="block-notes-input" placeholder="Internal notes...">${this.escapeHtml(block.notes)}</textarea>
          </div>

          ${block.resources.length > 0 ? `
            <div class="block-visual-refs">
              ${block.resources.map((res, i) => `
                <div class="block-visual-ref" data-index="${i}">
                  ${res.type === 'image' ? `<img src="${res.data}" alt="">` : `<video src="${res.data}"></video>`}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  toggleBlockCollapse(id) {
    const block = this.state.currentProject.blocks.find(b => b.id === id);
    if (block) {
      block.collapsed = !block.collapsed;
      this.saveProject();
      this.renderBlocks();
    }
  }

  duplicateBlock(id) {
    const idx = this.state.currentProject.blocks.findIndex(b => b.id === id);
    if (idx !== -1) {
      const copy = { ...JSON.parse(JSON.stringify(this.state.currentProject.blocks[idx])), id: this.generateId() };
      this.state.currentProject.blocks.splice(idx + 1, 0, copy);
      this.saveProject();
      this.renderBlocks();
      this.notify('Block duplicated', 'success');
    }
  }

  deleteBlock(id) {
    this.state.currentProject.blocks = this.state.currentProject.blocks.filter(b => b.id !== id);
    this.saveProject();
    this.renderBlocks();
    this.updateRitmoMeter();
  }

  selectBlock(id) {
    this.state.selectedBlock = id;
    document.querySelectorAll('.script-block').forEach(el => el.classList.remove('selected'));
    document.querySelector(`[data-id="${id}"]`)?.classList.add('selected');
  }

  startBlockDrag(e, blockId) {
    e.preventDefault();
    const blocks = this.state.currentProject.blocks;
    const idx = blocks.findIndex(b => b.id === blockId);
    let startY = e.clientY;

    const moveFn = (me) => {
      const delta = me.clientY - startY;
      if (Math.abs(delta) > 20) {
        const newIdx = delta > 0 ? idx + 1 : idx - 1;
        if (newIdx >= 0 && newIdx < blocks.length) {
          [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
          this.saveProject();
          this.renderBlocks();
          startY = me.clientY;
        }
      }
    };
    const upFn = () => {
      document.removeEventListener('mousemove', moveFn);
      document.removeEventListener('mouseup', upFn);
    };
    document.addEventListener('mousemove', moveFn);
    document.addEventListener('mouseup', upFn);
  }

  renderWordstockList(category) {
    const list = document.getElementById('wordstockList');
    let items = [];

    if (category === 'all') {
      items = [
        ...this.state.wordStock.hooks,
        ...this.state.wordStock.ctas,
        ...this.state.wordStock.transitions,
        ...this.state.wordStock.keywords,
        ...this.state.wordStock.favorites,
      ];
    } else {
      items = this.state.wordStock[category] || [];
    }

    list.innerHTML = items.map(item => `
      <div class="ws-item">
        <div class="ws-item-text">${this.escapeHtml(item)}</div>
        <div class="ws-item-actions">
          <button class="btn btn-icon" data-item="${item}" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-item]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.dataset.item;
        Object.keys(this.state.wordStock).forEach(k => {
          this.state.wordStock[k] = this.state.wordStock[k].filter(i => i !== item);
        });
        this.db.set('wordStock', this.state.wordStock);
        this.renderWordstockList(category);
        this.updateWordstockCount();
      });
    });
  }

  addToWordstock() {
    const input = document.getElementById('wsAddInput');
    const text = input.value.trim();
    if (!text) return;
    if (this.getTotalWordstockCount() >= 500) return this.notify('Word stock limit reached', 'error');

    this.state.wordStock.favorites.push(text);
    this.db.set('wordStock', this.state.wordStock);
    input.value = '';
    this.renderWordstockList('all');
    this.updateWordstockCount();
    this.notify('Added to word stock', 'success');
  }

  getTotalWordstockCount() {
    return Object.values(this.state.wordStock).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  }

  renderMediaGrid() {
    const grid = document.getElementById('mediaGrid');
    const media = this.state.currentProject?.media || [];
    grid.innerHTML = media.map((m, i) => `
      <div class="media-item" data-index="${i}">
        ${m.type === 'image' ? `<img src="${m.data}" alt="">` : `<video src="${m.data}"></video>`}
        <div class="media-item-badge">${m.type === 'image' ? '🖼️' : '🎬'}</div>
        <button class="media-item-del" data-index="${i}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `).join('');

    grid.querySelectorAll('.media-item-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        this.state.currentProject.media.splice(idx, 1);
        this.saveProject();
        this.renderMediaGrid();
      });
    });
  }

  triggerMediaUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,video/*';
    input.addEventListener('change', (e) => this.handleMediaUpload(e.target.files));
    input.click();
  }

  handleMediaUpload(files) {
    if (!this.state.currentProject) return;
    const limit = (this.state.currentProject.media.filter(m => m.type === 'image').length >= 20 ||
                   this.state.currentProject.media.filter(m => m.type === 'video').length >= 10);
    if (limit) return this.notify('Media limit reached', 'error');

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const type = file.type.startsWith('image') ? 'image' : 'video';
        this.state.currentProject.media.push({
          type,
          data: e.target.result,
          name: file.name,
        });
        this.saveProject();
        this.renderMediaGrid();
      };
      reader.readAsDataURL(file);
    });
  }

  handleMediaDrop(files) {
    this.handleMediaUpload(files);
  }

  updateRitmoMeter() {
    const blocks = this.state.currentProject?.blocks || [];
    const totalWords = blocks.reduce((sum, b) => sum + (b.content.split(/\s+/).filter(w => w).length || 0), 0);
    const readingTime = Math.ceil(totalWords / 150);
    const duration = Math.ceil(totalWords / 2.5);
    const density = Math.round((blocks.length / Math.max(totalWords, 1)) * 100);

    document.getElementById('ritmoWords').textContent = totalWords;
    document.getElementById('ritmoReading').textContent = readingTime + 'm';
    document.getElementById('ritmoDuration').textContent = duration + 's';
    document.getElementById('ritmoDensity').textContent = density + '%';

    const warnings = [];
    const hookBlock = blocks.find(b => b.type === 'hook');
    if (hookBlock && hookBlock.content.split(/\s+/).length > 40) {
      warnings.push({ type: 'warn', msg: 'Hook is too long (>40 words)' });
    }
    const ctaBlock = blocks.find(b => b.type === 'cta');
    if (ctaBlock && ctaBlock.content.split(/\s+/).length < 10) {
      warnings.push({ type: 'error', msg: 'CTA is too short (<10 words)' });
    }
    blocks.forEach(b => {
      if (b.content.split(/\s+/).length > 200) {
        warnings.push({ type: 'warn', msg: `Block "${b.title}" is very long (>200 words)` });
      }
    });

    const warnEl = document.getElementById('ritmoWarnings');
    warnEl.innerHTML = warnings.map(w => `
      <div class="ritmo-warning ${w.type}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ${w.msg}
      </div>
    `).join('');
  }

  updateProjectCount() {
    const count = this.state.projects.length;
    document.getElementById('projectCount').textContent = `${count}/25`;
  }

  updateWordstockCount() {
    const count = this.getTotalWordstockCount();
    document.getElementById('wordstockCount').textContent = `${count}/500`;
  }

  renderLimits() {
    const grid = document.getElementById('limitsGrid');
    const projectCount = this.state.projects.length;
    const wsCount = this.getTotalWordstockCount();
    const blockCount = this.state.currentProject?.blocks.length || 0;
    const imgCount = this.state.currentProject?.media.filter(m => m.type === 'image').length || 0;
    const vidCount = this.state.currentProject?.media.filter(m => m.type === 'video').length || 0;

    grid.innerHTML = `
      <div class="limit-card">
        <div class="limit-card-label">Projects</div>
        <div class="limit-card-value ${projectCount === 25 ? 'full' : ''}">
          ${projectCount}<span style="font-size: 11px; font-weight: 400;">/25</span>
        </div>
      </div>
      <div class="limit-card">
        <div class="limit-card-label">Words</div>
        <div class="limit-card-value ${wsCount === 500 ? 'full' : ''}">
          ${wsCount}<span style="font-size: 11px; font-weight: 400;">/500</span>
        </div>
      </div>
      <div class="limit-card">
        <div class="limit-card-label">Blocks</div>
        <div class="limit-card-value">${blockCount}</div>
      </div>
      <div class="limit-card">
        <div class="limit-card-label">Media</div>
        <div class="limit-card-value ${imgCount + vidCount === 30 ? 'full' : ''}">
          ${imgCount + vidCount}<span style="font-size: 11px; font-weight: 400;">/30</span>
        </div>
      </div>
    `;
  }

  renderContextPanel() {
    this.updateRitmoMeter();
    this.renderLimits();
  }

  exportProject() {
    if (!this.state.currentProject) return;
    const data = JSON.stringify(this.state.currentProject, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.state.currentProject.name}.json`;
    a.click();
    this.notify('Project exported', 'success');
  }

  importProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          imported.id = this.generateId();
          imported.created = Date.now();
          this.state.projects.push(imported);
          this.db.set('projects', this.state.projects);
          this.renderProjectList();
          this.selectProject(imported.id);
          this.notify('Project imported', 'success');
        } catch (err) {
          this.notify('Import failed: invalid JSON', 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  openTeleprompter() {
    const overlay = document.getElementById('teleprompter-overlay');
    const content = document.getElementById('teleprompterContent');
    const blocks = this.state.currentProject?.blocks || [];

    content.innerHTML = blocks.map(b => `
      <div class="tp-block-section">
        <div class="tp-block-label">${this.escapeHtml(b.title)}</div>
        <div class="tp-block-text">${this.escapeHtml(b.content)}</div>
      </div>
    `).join('');

    overlay.classList.add('active');
  }

  closeTeleprompter() {
    document.getElementById('teleprompter-overlay').classList.remove('active');
  }

  playTeleprompter() {
    const content = document.getElementById('teleprompterContent');
    const speed = parseInt(document.getElementById('tpSpeed').value);
    content.style.animation = `none`;
    setTimeout(() => {
      content.style.animation = `scroll-tp ${(content.scrollHeight / 100) * speed}s linear infinite`;
    }, 10);
  }

  pauseTeleprompter() {
    document.getElementById('teleprompterContent').style.animation = 'none';
  }

  resetTeleprompter() {
    const area = document.querySelector('.teleprompter-scroll-area');
    area.scrollTop = 0;
    document.getElementById('teleprompterContent').style.animation = 'none';
  }

  handleKeyboard(e) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') { e.preventDefault(); this.saveProject(); this.notify('Saved', 'success'); }
      if (e.key === 'n') { e.preventDefault(); this.addBlock('hook'); }
      if (e.key === 'd' && this.state.selectedBlock) { e.preventDefault(); this.duplicateBlock(this.state.selectedBlock); }
    }
  }

  saveProject() {
    if (this.state.currentProject) {
      this.state.currentProject.updated = Date.now();
      const idx = this.state.projects.findIndex(p => p.id === this.state.currentProject.id);
      if (idx !== -1) this.state.projects[idx] = this.state.currentProject;
      this.db.set('projects', this.state.projects);
      this.updateAutosaveBadge();
    }
  }

  updateAutosaveBadge() {
    const badge = document.getElementById('autosaveBadge');
    badge.classList.remove('saved');
    badge.classList.add('saving');
    badge.querySelector('span').textContent = 'Saving...';
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      badge.classList.remove('saving');
      badge.classList.add('saved');
      badge.querySelector('span').textContent = 'Saved';
    }, 500);
  }

  showModal(title, content, actions = []) {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modal');
    modal.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">${content}</div>
      <div class="modal-footer">
        ${actions.map((a, i) => `
          <button class="btn ${a.primary ? 'btn-primary' : ''}" data-action="${i}">${a.label}</button>
        `).join('')}
      </div>
    `;
    overlay.classList.add('active');
    modal.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => actions[parseInt(btn.dataset.action)].action());
    });
    modal.querySelector('.modal-close').addEventListener('click', () => this.hideModal());
  }

  hideModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  }

  notify(msg, type = 'info') {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3.05h16.94a2 2 0 001.71-3.05L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    el.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  showLoader() {
    document.getElementById('loader').style.display = 'flex';
  }

  hideLoader() {
    const loader = document.getElementById('loader');
    loader.classList.add('hidden');
    document.getElementById('app').classList.add('ready');
    setTimeout(() => loader.style.display = 'none', 300);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
  window.storyStudio = new StoryStudio();
});
