/**
 * Google Drive API v3 Manager
 * Securely interacts with a user-selected Google Drive folder.
 * Operates strictly within the selected folder using drive.file scope.
 */

class DriveManager {
  constructor() {
    this.folderId = localStorage.getItem(window.CONFIG?.STORAGE_KEYS?.FOLDER_ID) || null;
    this.folderName = localStorage.getItem(window.CONFIG?.STORAGE_KEYS?.FOLDER_NAME) || null;
    this.folderUrl = null;
    this.dataFileId = null;
    this.importFolderId = null;
    this.pickerApiLoaded = false;
  }

  async getHeaders() {
    const token = window.Auth?.getAccessToken();
    if (!token) throw new Error('Not authenticated with Google');
    return {
      Authorization: `Bearer ${token}`
    };
  }

  /**
   * Helper to parse and extract a folder ID from either a plain ID or a Google Drive URL
   * e.g., https://drive.google.com/drive/folders/1aBcDeFgHi...
   * e.g., https://drive.google.com/drive/u/0/folders/1aBcDeFgHi...
   */
  extractFolderId(input) {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim();
    // Check if it's a URL with /folders/<ID>
    const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    // Check if it's a URL with id=<ID>
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
    // Otherwise assume it's the raw ID
    return trimmed;
  }

  /**
   * Set and verify a specific folder by ID
   */
  async setFolderById(folderIdOrUrl, customName = null) {
    const folderId = this.extractFolderId(folderIdOrUrl);
    if (!folderId) {
      throw new Error('Please enter a valid Google Drive folder ID or URL.');
    }

    const headers = await this.getHeaders();
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,webViewLink`, { headers });
      if (!res.ok) {
        if (res.status === 404 || res.status === 403) {
          throw new Error('Folder not found or not accessible. Make sure the folder exists and has been opened with or shared with this Google account.');
        }
        throw new Error(`Failed to access folder: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error(`The selected item "${data.name}" is a file, not a folder.`);
      }

      this.folderId = data.id;
      this.folderName = customName || data.name || 'ToDo Folder';
      this.folderUrl = data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`;
      this.dataFileId = null;
      this.importFolderId = null;

      // Persist in localStorage and CONFIG
      localStorage.setItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID, this.folderId);
      localStorage.setItem(window.CONFIG.STORAGE_KEYS.FOLDER_NAME, this.folderName);
      window.CONFIG.DRIVE_FOLDER_ID = this.folderId;
      window.CONFIG.DRIVE_FOLDER_NAME = this.folderName;

      return { id: this.folderId, name: this.folderName, url: this.folderUrl };
    } catch (err) {
      console.error('Folder validation error:', err);
      throw err;
    }
  }

  /**
   * Ensure app folder exists (either custom selected folder or default 'Kreier-ToDo')
   */
  async ensureAppFolder() {
    if (this.folderId) return this.folderId;

    const configuredFolderId = window.CONFIG.DRIVE_FOLDER_ID || localStorage.getItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID);
    if (configuredFolderId) {
      this.folderId = configuredFolderId.trim();
      return this.folderId;
    }

    const headers = await this.getHeaders();
    const folderName = window.CONFIG.DRIVE_FOLDER_NAME || 'Kreier-ToDo';

    // Search for existing folder created by this app
    const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`;

    const res = await fetch(searchUrl, { headers });
    if (!res.ok) throw new Error(`Drive folder query failed: ${res.statusText}`);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      this.folderId = data.files[0].id;
      this.folderName = data.files[0].name;
      this.folderUrl = data.files[0].webViewLink;
      localStorage.setItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID, this.folderId);
      localStorage.setItem(window.CONFIG.STORAGE_KEYS.FOLDER_NAME, this.folderName);
      return this.folderId;
    }

    // Create folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (!createRes.ok) throw new Error(`Failed to create app folder: ${createRes.statusText}`);
    const newFolder = await createRes.json();
    this.folderId = newFolder.id;
    this.folderName = folderName;
    localStorage.setItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID, this.folderId);
    localStorage.setItem(window.CONFIG.STORAGE_KEYS.FOLDER_NAME, this.folderName);
    return this.folderId;
  }

  /**
   * Ensure the 'import' subfolder exists inside the active folder
   */
  async ensureImportFolder() {
    if (this.importFolderId) return this.importFolderId;
    const parentFolderId = await this.ensureAppFolder();
    const headers = await this.getHeaders();
    const subfolderName = window.CONFIG.DRIVE_IMPORT_FOLDER_NAME || 'import';

    // Search if 'import' subfolder already exists
    const q = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${subfolderName}' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;

    const res = await fetch(searchUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        this.importFolderId = data.files[0].id;
        return this.importFolderId;
      }
    }

    // Create 'import' subfolder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: subfolderName,
        parents: [parentFolderId],
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (!createRes.ok) throw new Error(`Failed to create import subfolder: ${createRes.statusText}`);
    const created = await createRes.json();
    this.importFolderId = created.id;
    return this.importFolderId;
  }

  /**
   * Google Drive Picker API: opens folder selector modal in the browser
   */
  async openFolderPicker(onSelectCallback) {
    if (!window.Auth?.isSignedIn()) {
      window.App?.showToast('Please sign in with Google first.', 'warning');
      return;
    }

    const token = window.Auth.getAccessToken();
    const apiKey = window.CONFIG.GOOGLE_API_KEY || localStorage.getItem(window.CONFIG.STORAGE_KEYS.API_KEY) || '';

    // If Google Picker API script is ready
    if (typeof google !== 'undefined' && google.picker) {
      this.createPicker(token, apiKey, onSelectCallback);
      return;
    }

    // Load gapi picker script
    if (typeof gapi !== 'undefined') {
      gapi.load('picker', {
        callback: () => {
          this.pickerApiLoaded = true;
          this.createPicker(token, apiKey, onSelectCallback);
        }
      });
      return;
    }

    // Fallback if picker script is not available: open Folder prompt modal
    this.openManualFolderPrompt();
  }

  createPicker(token, apiKey, onSelectCallback) {
    try {
      const docsView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setMimeTypes('application/vnd.google-apps.folder')
        .setSelectFolderEnabled(true);

      const builder = new google.picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(token)
        .setTitle('Select Google Drive Folder for ToDo App')
        .setCallback(async (data) => {
          if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
            const doc = data[google.picker.Response.DOCUMENTS][0];
            const folderId = doc[google.picker.Document.ID];
            const folderName = doc[google.picker.Document.NAME];
            try {
              await this.setFolderById(folderId, folderName);
              if (onSelectCallback) onSelectCallback({ id: folderId, name: folderName });
              window.App?.showToast(`✓ Operating folder set to: "${folderName}"`, 'success');
              await window.App?.syncFromGoogleDrive();
            } catch (err) {
              window.App?.showToast('Error setting folder: ' + err.message, 'error');
            }
          }
        });

      if (apiKey) {
        builder.setDeveloperKey(apiKey);
      }

      const picker = builder.build();
      picker.setVisible(true);
    } catch (e) {
      console.warn('Google Picker Builder failed, falling back to prompt:', e);
      this.openManualFolderPrompt();
    }
  }

  openManualFolderPrompt() {
    const modal = document.getElementById('folder-picker-modal');
    if (modal) {
      const input = document.getElementById('manual-folder-input');
      if (input) input.value = this.folderId || '';
      modal.classList.add('active');
    } else {
      const input = prompt('Enter Google Drive Folder ID or URL (e.g. from drive.google.com/drive/folders/...):', this.folderId || '');
      if (input && input.trim()) {
        this.setFolderById(input.trim())
          .then((f) => {
            window.App?.showToast(`✓ Connected to folder: "${f.name}"`, 'success');
            window.App?.syncFromGoogleDrive();
          })
          .catch((err) => window.App?.showToast('Error: ' + err.message, 'error'));
      }
    }
  }

  /**
   * Load private data JSON from Google Drive
   */
  async loadPrivateData() {
    const headers = await this.getHeaders();
    const folderId = await this.ensureAppFolder();
    const filename = window.CONFIG.DRIVE_DATA_FILENAME;

    const q = `'${folderId}' in parents and name='${filename}' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`;

    const res = await fetch(searchUrl, { headers });
    if (!res.ok) throw new Error(`Drive file search error: ${res.statusText}`);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      this.dataFileId = data.files[0].id;
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${this.dataFileId}?alt=media`, { headers });
      if (!fileRes.ok) throw new Error(`Failed to download data file: ${fileRes.statusText}`);
      const content = await fileRes.json();
      return content;
    }

    return null;
  }

  /**
   * Save private data JSON to Google Drive
   */
  async savePrivateData(payload) {
    const headers = await this.getHeaders();
    const folderId = await this.ensureAppFolder();
    const filename = window.CONFIG.DRIVE_DATA_FILENAME;
    const bodyStr = JSON.stringify(payload, null, 2);

    if (this.dataFileId) {
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${this.dataFileId}?uploadType=media`;
      const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: bodyStr
      });
      if (!res.ok) throw new Error(`Failed to update Drive data: ${res.statusText}`);
      return await res.json();
    } else {
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: filename,
        parents: [folderId],
        mimeType: 'application/json'
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        bodyStr +
        closeDelimiter;

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      });

      if (!res.ok) throw new Error(`Failed to create file on Drive: ${res.statusText}`);
      const created = await res.json();
      this.dataFileId = created.id;
      return created;
    }
  }

  /**
   * List documents & files stored inside the active folder
   */
  async listFolderFiles() {
    const headers = await this.getHeaders();
    const folderId = await this.ensureAppFolder();

    const q = `'${folderId}' in parents and trashed=false`;
    const fields = 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink,iconLink)';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&fields=${encodeURIComponent(fields)}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to list files: ${res.statusText}`);
    const data = await res.json();
    return data.files || [];
  }

  /**
   * Upload an arbitrary document or markdown file into the active folder (or subfolder)
   */
  async uploadFile(fileObj, customName = null, parentFolderId = null) {
    const headers = await this.getHeaders();
    const folderId = parentFolderId || await this.ensureAppFolder();
    const fileName = customName || fileObj.name;

    const metadata = {
      name: fileName,
      parents: [folderId]
    };

    const boundary = '-------UploadBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const contentType = fileObj.type || 'application/octet-stream';
          const postData = new Blob([
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${contentType}\r\n\r\n`,
            reader.result,
            closeDelimiter
          ]);

          const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: postData
          });

          if (!res.ok) throw new Error(`Upload error: ${res.statusText}`);
          const fileData = await res.json();
          resolve(fileData);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(fileObj);
    });
  }

  /**
   * Upload raw text / markdown content as a file into the import subfolder
   */
  async uploadMarkdownText(filename, content, inImportFolder = true) {
    const headers = await this.getHeaders();
    const targetFolderId = inImportFolder ? await this.ensureImportFolder() : await this.ensureAppFolder();

    const metadata = {
      name: filename,
      parents: [targetFolderId],
      mimeType: 'text/markdown'
    };

    const boundary = '-------MdBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
      content +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    return await res.json();
  }

  /**
   * Delete a file by ID
   */
  async deleteFile(fileId) {
    const headers = await this.getHeaders();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete file: ${res.statusText}`);
    }
    return true;
  }
}

window.Drive = new DriveManager();
