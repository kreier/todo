/**
 * Main Application Orchestrator for Kreier ToDo
 * Coordinates Authentication, Google Drive Sync, Local Storage, and UI Views.
 */

class Application {
  constructor() {
    this.privateData = null;
    this.activeTab = 'stats';
    this.syncStatus = 'idle'; // 'idle', 'syncing', 'synced', 'error'
    this.driveFiles = [];
    this.pendingImportResult = null;
  }

  async init() {
    // 1. Initialize Theme
    this.initTheme();

    // 2. Load Public Statistics
    if (window.Stats) {
      window.Stats.loadPublicStats();
    }

    // 3. Load Private Data from Local Storage or Defaults
    this.loadLocalPrivateData();

    // 4. Setup Authentication and Listeners
    window.Auth?.onAuthChange(async ({ signedIn, user }) => {
      this.updateAuthUI(signedIn, user);
      this.updateActiveFolderUI();
      if (signedIn) {
        await this.syncFromGoogleDrive();
      } else {
        this.renderAllViews();
      }
    });

    // 5. Initialize Google Identity Services
    if (window.Auth) {
      await window.Auth.initGis();
    }

    // 6. Setup Global Event Handlers
    this.setupEventListeners();

    // 7. Initial View Render & Folder UI
    this.updateActiveFolderUI();
    this.renderAllViews();
  }

  // --- Theme Management ---
  initTheme() {
    const saved = localStorage.getItem(window.CONFIG.STORAGE_KEYS.THEME) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeButton(saved);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(window.CONFIG.STORAGE_KEYS.THEME, next);
    this.updateThemeButton(next);
  }

  updateThemeButton(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.innerHTML = theme === 'dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }
  }

  // --- Private Data Storage & Google Drive Sync ---
  loadLocalPrivateData() {
    try {
      const stored = localStorage.getItem(window.CONFIG.STORAGE_KEYS.PRIVATE_DATA);
      if (stored) {
        this.privateData = JSON.parse(stored);
      } else {
        // Initialize with default template structure
        this.privateData = {
          version: '1.0',
          recurring_tasks: window.Recurring?.getDefaultRecurringTasks() || [],
          ...(window.Tasks?.getDefaultData() || {})
        };
        this.saveLocalPrivateData();
      }
    } catch (e) {
      console.error('Error loading private data:', e);
      this.privateData = window.Tasks?.getDefaultData() || {};
    }
  }

  saveLocalPrivateData() {
    if (!this.privateData) return;
    localStorage.setItem(window.CONFIG.STORAGE_KEYS.PRIVATE_DATA, JSON.stringify(this.privateData));
  }

  getPrivateData() {
    if (!this.privateData) {
      this.loadLocalPrivateData();
    }
    return this.privateData;
  }

  async savePrivateData() {
    this.saveLocalPrivateData();

    if (window.Auth?.isSignedIn() && window.Drive) {
      this.setSyncStatus('syncing');
      try {
        this.privateData.last_sync = new Date().toISOString();
        await window.Drive.savePrivateData(this.privateData);
        this.setSyncStatus('synced');
      } catch (err) {
        console.error('Google Drive save error:', err);
        this.setSyncStatus('error');
      }
    } else {
      this.setSyncStatus('local');
    }
  }

  async syncFromGoogleDrive() {
    if (!window.Auth?.isSignedIn() || !window.Drive) return;

    this.setSyncStatus('syncing');
    try {
      const driveData = await window.Drive.loadPrivateData();
      if (driveData) {
        this.privateData = driveData;
        this.saveLocalPrivateData();
        this.showToast('Synchronized with Google Drive folder.', 'success');
      } else {
        // First time in this folder: upload local database
        await window.Drive.savePrivateData(this.privateData);
        this.showToast(`Initialized ToDo database inside folder: "${window.Drive.folderName || 'Kreier-ToDo'}".`, 'info');
      }
      this.setSyncStatus('synced');
      this.updateActiveFolderUI();
      this.renderAllViews();
      this.loadDriveFolderFiles();
    } catch (err) {
      console.error('Drive sync failed:', err);
      this.setSyncStatus('error');
      this.showToast('Failed to sync with Google Drive: ' + err.message, 'warning');
    }
  }

  setSyncStatus(status) {
    this.syncStatus = status;
    const badge = document.getElementById('sync-badge');
    if (!badge) return;

    if (status === 'syncing') {
      badge.className = 'status-badge status-syncing';
      badge.innerHTML = '<span class="pulse-dot"></span> Syncing Drive...';
    } else if (status === 'synced') {
      badge.className = 'status-badge status-synced';
      badge.innerHTML = '✓ Google Drive Synced';
    } else if (status === 'error') {
      badge.className = 'status-badge status-error';
      badge.innerHTML = '⚠ Sync Error';
    } else {
      badge.className = 'status-badge status-local';
      badge.innerHTML = '💾 Local Mode';
    }
  }

  // --- Active Folder UI & Folder Picker ---
  updateActiveFolderUI() {
    const signedIn = window.Auth?.isSignedIn();
    const folderName = window.Drive?.folderName || localStorage.getItem(window.CONFIG.STORAGE_KEYS.FOLDER_NAME) || 'Kreier-ToDo';
    const folderId = window.Drive?.folderId || localStorage.getItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID);
    const folderUrl = window.Drive?.folderUrl || (folderId ? `https://drive.google.com/drive/folders/${folderId}` : null);

    const folderPill = document.getElementById('active-folder-pill');
    if (folderPill) {
      if (signedIn) {
        folderPill.style.display = 'inline-flex';
        folderPill.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span>Folder: <strong>${this.escapeHtml(folderName)}</strong></span>
          <button class="btn btn-xs btn-ghost" onclick="App.openFolderPickerModal()" title="Change Google Drive Folder">Change</button>
        `;
      } else {
        folderPill.style.display = 'none';
      }
    }

    const driveInfoCard = document.getElementById('drive-folder-info-card');
    if (driveInfoCard) {
      if (signedIn) {
        driveInfoCard.innerHTML = `
          <div class="folder-header-details">
            <div class="folder-title-row">
              <span class="folder-name-title">📁 ${this.escapeHtml(folderName)}</span>
              <span class="badge badge-success">Active Storage Root</span>
            </div>
            <div class="folder-meta-row">
              ${folderId ? `<span>Folder ID: <code>${folderId}</code></span>` : ''}
              ${folderUrl ? `<span>• <a href="${folderUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary);">Open in Google Drive ↗</a></span>` : ''}
            </div>
            <p class="text-sm text-muted" style="margin-top: 0.35rem;">
              The app operates <strong>exclusively inside this folder</strong>. All tasks, JSON database, receipts, and imported notes are kept here.
            </p>
          </div>
          <div class="btn-group-sm">
            <button class="btn btn-secondary btn-sm" onclick="App.openFolderPickerModal()">
              📂 Switch / Select Folder
            </button>
          </div>
        `;
      } else {
        driveInfoCard.innerHTML = `
          <div>
            <p><strong>Connect to Google Drive:</strong> Sign in with Google above to choose or create a dedicated folder for your ToDo files.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Auth.signIn()">Sign In</button>
        `;
      }
    }
  }

  openFolderPickerModal() {
    const modal = document.getElementById('folder-picker-modal');
    if (!modal) return;

    const input = document.getElementById('manual-folder-input');
    if (input) {
      input.value = window.Drive?.folderId || localStorage.getItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID) || '';
    }
    modal.classList.add('active');
  }

  closeFolderPickerModal() {
    const modal = document.getElementById('folder-picker-modal');
    if (modal) modal.classList.remove('active');
  }

  async connectFolderFromInput() {
    const input = document.getElementById('manual-folder-input');
    const val = input ? input.value.trim() : '';
    if (!val) {
      this.showToast('Please enter a Google Drive folder ID or URL.', 'warning');
      return;
    }

    this.showToast('Connecting to folder...', 'info');
    try {
      const folder = await window.Drive.setFolderById(val);
      this.closeFolderPickerModal();
      this.showToast(`✓ Connected to folder: "${folder.name}"`, 'success');
      this.updateActiveFolderUI();
      await this.syncFromGoogleDrive();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async useDefaultAppFolder() {
    this.showToast('Setting up default "Kreier-ToDo" folder...', 'info');
    try {
      localStorage.removeItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID);
      window.CONFIG.DRIVE_FOLDER_ID = '';
      window.CONFIG.DRIVE_FOLDER_NAME = 'Kreier-ToDo';
      window.Drive.folderId = null;
      window.Drive.folderName = 'Kreier-ToDo';

      await window.Drive.ensureAppFolder();
      this.closeFolderPickerModal();
      this.showToast('✓ Connected to default "Kreier-ToDo" folder.', 'success');
      this.updateActiveFolderUI();
      await this.syncFromGoogleDrive();
    } catch (err) {
      this.showToast('Failed to setup default folder: ' + err.message, 'error');
    }
  }

  // --- Google Drive File Explorer & Document Upload ---
  async loadDriveFolderFiles() {
    if (!window.Auth?.isSignedIn() || !window.Drive) return;
    const container = document.getElementById('drive-files-container');
    if (!container) return;

    container.innerHTML = `<div class="empty-state"><span class="pulse-dot"></span> Loading Drive files...</div>`;

    try {
      const files = await window.Drive.listFolderFiles();
      this.driveFiles = files;
      this.renderDriveFilesList(files);
    } catch (e) {
      console.warn('Failed to load drive files:', e);
      container.innerHTML = `<div class="empty-state"><p>Could not list files from Google Drive folder.</p></div>`;
    }
  }

  renderDriveFilesList(files) {
    const container = document.getElementById('drive-files-container');
    if (!container) return;

    if (!files || files.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No documents uploaded in <strong>${this.escapeHtml(window.Drive?.folderName || 'this')}</strong> folder yet.</p>
          <p class="text-muted text-sm">Upload rent receipts, maintenance invoices, contract documents, or import Apple Notes below.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = files.map(f => {
      const isJson = f.name.endsWith('.json');
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      const isMd = f.name.endsWith('.md') || f.name.endsWith('.markdown');
      const sizeStr = f.size ? `${(f.size / 1024).toFixed(1)} KB` : '';
      const dateStr = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : '';

      return `
        <div class="drive-file-card">
          <div class="file-icon">
            ${isFolder ? `
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            ` : `
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            `}
          </div>
          <div class="file-info">
            <a href="${f.webViewLink || '#'}" target="_blank" rel="noopener noreferrer" class="file-title">
              ${this.escapeHtml(f.name)}
            </a>
            <div class="file-meta">
              <span>${dateStr}</span>
              ${sizeStr ? `<span>• ${sizeStr}</span>` : ''}
              ${isJson ? `<span class="badge badge-subtle">App Database</span>` : ''}
              ${isFolder ? `<span class="badge badge-subtle">Folder</span>` : ''}
              ${isMd ? `<span class="badge badge-subtle">Markdown Note</span>` : ''}
            </div>
          </div>
          <div class="file-actions">
            ${f.webViewLink ? `<a href="${f.webViewLink}" target="_blank" class="btn btn-xs btn-ghost" title="Open in Google Drive">View</a>` : ''}
            ${!isJson ? `<button class="btn btn-xs btn-ghost text-danger" onclick="App.deleteDriveFile('${f.id}')" title="Delete">Delete</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async uploadFileToDrive(fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    if (!window.Auth?.isSignedIn()) {
      this.showToast('Please sign in with Google to upload documents to Drive.', 'warning');
      return;
    }

    const file = fileInput.files[0];
    this.showToast(`Uploading "${file.name}" to Google Drive...`, 'info');

    try {
      await window.Drive.uploadFile(file);
      this.showToast(`✓ "${file.name}" saved to Google Drive folder!`, 'success');
      fileInput.value = '';
      await this.loadDriveFolderFiles();
    } catch (err) {
      console.error(err);
      this.showToast('Upload failed: ' + err.message, 'error');
    }
  }

  async deleteDriveFile(fileId) {
    if (!confirm('Are you sure you want to delete this file from Google Drive?')) return;
    try {
      await window.Drive.deleteFile(fileId);
      this.showToast('File deleted from Google Drive.', 'info');
      await this.loadDriveFolderFiles();
    } catch (e) {
      this.showToast('Delete failed: ' + e.message, 'error');
    }
  }

  // --- Apple Notes / Markdown Batch Importer Modal ---
  openImportNotesModal() {
    const modal = document.getElementById('import-notes-modal');
    if (!modal) return;

    this.pendingImportResult = null;
    document.getElementById('import-preview-box').style.display = 'none';
    document.getElementById('import-progress-box').style.display = 'none';
    document.getElementById('btn-apply-import').disabled = true;

    modal.classList.add('active');
  }

  closeImportNotesModal() {
    const modal = document.getElementById('import-notes-modal');
    if (modal) modal.classList.remove('active');
  }

  async handleBatchNotesFiles(fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;

    const files = fileInput.files;
    const progressBox = document.getElementById('import-progress-box');
    const progressBar = document.getElementById('import-progress-fill');
    const progressLabel = document.getElementById('import-progress-label');
    const previewBox = document.getElementById('import-preview-box');

    if (progressBox) progressBox.style.display = 'block';
    if (previewBox) previewBox.style.display = 'none';

    try {
      const summary = await window.Importer.processFiles(files, (curr, total, name) => {
        const pct = Math.round((curr / total) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressLabel) progressLabel.textContent = `Parsing ${curr} of ${total} notes (${name})...`;
      });

      this.pendingImportResult = summary;

      if (progressBox) progressBox.style.display = 'none';
      if (previewBox) {
        previewBox.style.display = 'block';
        previewBox.innerHTML = `
          <div class="summary-stat-grid">
            <div class="summary-stat-card">
              <span class="summary-stat-val">${summary.totalNotes}</span>
              <span class="summary-stat-lbl">Notes Parsed</span>
            </div>
            <div class="summary-stat-card">
              <span class="summary-stat-val">${summary.totalOpenTasks}</span>
              <span class="summary-stat-lbl">Open Tasks Found</span>
            </div>
            <div class="summary-stat-card">
              <span class="summary-stat-val" style="font-size: 1rem;">${summary.oldestDate}</span>
              <span class="summary-stat-lbl">Oldest Record</span>
            </div>
            <div class="summary-stat-card">
              <span class="summary-stat-val" style="font-size: 1rem;">${summary.newestDate}</span>
              <span class="summary-stat-lbl">Newest Record</span>
            </div>
          </div>
          <div class="notes-sample-list">
            <strong>Sample of parsed notes:</strong>
            <ul style="margin-left: 1.25rem; font-size: 0.85rem; margin-top: 0.25rem;">
              ${summary.notes.slice(0, 5).map(n => `<li><code>${n.date}</code>: <strong>${this.escapeHtml(n.title)}</strong> (${n.todos.length} checklist items)</li>`).join('')}
              ${summary.notes.length > 5 ? `<li>... and ${summary.notes.length - 5} more notes.</li>` : ''}
            </ul>
          </div>
        `;
      }

      const applyBtn = document.getElementById('btn-apply-import');
      if (applyBtn) applyBtn.disabled = false;

    } catch (err) {
      if (progressBox) progressBox.style.display = 'none';
      this.showToast('Import parsing error: ' + err.message, 'error');
    }
  }

  async executeNotesImport() {
    if (!this.pendingImportResult) return;

    const addToArchive = document.getElementById('opt-import-archive')?.checked ?? true;
    const extractTasks = document.getElementById('opt-import-tasks')?.checked ?? true;
    const uploadToDrive = document.getElementById('opt-import-drive')?.checked ?? false;

    const progressBox = document.getElementById('import-progress-box');
    const progressBar = document.getElementById('import-progress-fill');
    const progressLabel = document.getElementById('import-progress-label');

    if (progressBox) progressBox.style.display = 'block';
    if (progressLabel) progressLabel.textContent = 'Applying changes to database...';

    try {
      const res = await window.Importer.applyToAppData({
        addToArchive,
        extractTasks,
        uploadToDrive,
        driveProgressCallback: (curr, total, name) => {
          const pct = Math.round((curr / total) * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressLabel) progressLabel.textContent = `Uploading note ${curr}/${total} to Drive "import/" folder...`;
        }
      });

      this.closeImportNotesModal();
      this.showToast(`✓ Successfully integrated ${res.addedNotesCount} notes and ${res.addedTasksCount} tasks!`, 'success');
      this.renderAllViews();
    } catch (err) {
      this.showToast('Failed to apply import: ' + err.message, 'error');
    }
  }

  // --- Auth UI Management ---
  updateAuthUI(signedIn, user) {
    const authContainer = document.getElementById('auth-section');
    if (!authContainer) return;

    if (signedIn && user) {
      authContainer.innerHTML = `
        <div class="user-pill">
          ${user.picture ? `<img src="${user.picture}" alt="${this.escapeHtml(user.name)}" class="user-avatar" referrerpolicy="no-referrer">` : ''}
          <div class="user-info">
            <span class="user-name">${this.escapeHtml(user.name || 'User')}</span>
            <span class="user-email">${this.escapeHtml(user.email || '')}</span>
          </div>
          <button class="btn btn-xs btn-ghost" onclick="Auth.signOut()" title="Sign Out">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      `;
    } else {
      authContainer.innerHTML = `
        <button class="btn btn-google" onclick="Auth.signIn()">
          <svg class="google-logo" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Sign in with Google</span>
        </button>
      `;
    }

    const banner = document.getElementById('auth-warning-banner');
    if (banner) {
      banner.style.display = signedIn ? 'none' : 'flex';
    }
  }

  // --- Views Navigation ---
  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.view-tab-content').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    if (tabId === 'stats' && window.Stats) {
      window.Stats.renderCharts();
    } else if (tabId === 'recurring' && window.Recurring) {
      window.Recurring.render();
    } else if (tabId === 'tasks' && window.Tasks) {
      window.Tasks.renderAll();
    } else if (tabId === 'drive' && window.Auth?.isSignedIn()) {
      this.updateActiveFolderUI();
      this.loadDriveFolderFiles();
    } else if (tabId === 'notes' && window.Tasks) {
      window.Tasks.renderHistoricalNotes();
    }
  }

  renderAllViews() {
    if (window.Recurring) window.Recurring.render();
    if (window.Tasks) window.Tasks.renderAll();
    if (window.Stats) window.Stats.renderKPIs();
  }

  // --- Settings & Import / Export ---
  openSettingsModal(highlightClientId = false) {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    const clientIdInput = document.getElementById('setting-client-id');
    const folderInput = document.getElementById('setting-drive-folder');
    const folderIdInput = document.getElementById('setting-drive-folder-id');

    if (clientIdInput) {
      clientIdInput.value = localStorage.getItem(window.CONFIG.STORAGE_KEYS.CLIENT_ID) || window.CONFIG.GOOGLE_CLIENT_ID || '';
      if (highlightClientId) clientIdInput.focus();
    }
    if (folderInput) {
      folderInput.value = window.CONFIG.DRIVE_FOLDER_NAME;
    }
    if (folderIdInput) {
      folderIdInput.value = localStorage.getItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID) || window.CONFIG.DRIVE_FOLDER_ID || '';
    }

    modal.classList.add('active');
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
  }

  saveSettings() {
    const clientId = document.getElementById('setting-client-id').value.trim();
    const folder = document.getElementById('setting-drive-folder').value.trim();
    const folderId = document.getElementById('setting-drive-folder-id')?.value.trim() || '';

    if (clientId) {
      localStorage.setItem(window.CONFIG.STORAGE_KEYS.CLIENT_ID, clientId);
      window.CONFIG.GOOGLE_CLIENT_ID = clientId;
    } else {
      localStorage.removeItem(window.CONFIG.STORAGE_KEYS.CLIENT_ID);
      window.CONFIG.GOOGLE_CLIENT_ID = '';
    }

    if (folder) {
      window.CONFIG.DRIVE_FOLDER_NAME = folder;
      localStorage.setItem(window.CONFIG.STORAGE_KEYS.FOLDER_NAME, folder);
    }

    if (folderId) {
      window.CONFIG.DRIVE_FOLDER_ID = folderId;
      localStorage.setItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID, folderId);
      if (window.Drive) window.Drive.folderId = folderId;
    } else {
      window.CONFIG.DRIVE_FOLDER_ID = '';
      localStorage.removeItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID);
    }

    this.closeSettingsModal();
    this.showToast('Settings saved. Re-initializing Google auth...', 'success');
    window.Auth?.initGis();
  }

  exportDataJson() {
    const data = this.getPrivateData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kreier_todo_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Exported backup JSON file.', 'success');
  }

  importDataJson(fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.recurring_tasks || parsed.active_tasks || parsed.historical_notes) {
          this.privateData = {
            ...this.privateData,
            ...parsed
          };
          this.savePrivateData();
          this.renderAllViews();
          this.showToast('Backup successfully imported!', 'success');
        } else {
          this.showToast('Invalid ToDo data format.', 'error');
        }
      } catch (err) {
        this.showToast('Failed to parse JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  // --- UI Toast Notifications ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">${this.escapeHtml(message)}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Enter key for active task input
    const taskInput = document.getElementById('new-task-input');
    if (taskInput) {
      taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          window.Tasks?.addNewTaskFromForm();
        }
      });
    }

    // Modal background close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.App = new Application();
window.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
