/**
 * Google Drive API v3 Manager
 * Securely interacts with the user's private Google Drive subfolder.
 */

class DriveManager {
  constructor() {
    this.folderId = null;
    this.dataFileId = null;
  }

  async getHeaders() {
    const token = window.Auth?.getAccessToken();
    if (!token) throw new Error('Not authenticated with Google');
    return {
      Authorization: `Bearer ${token}`
    };
  }

  /**
   * Find or create the dedicated app folder in Google Drive (e.g., 'Kreier-ToDo')
   * With drive.file scope, the app only accesses this dedicated folder and cannot see the rest of your drive.
   */
  async ensureAppFolder() {
    if (this.folderId) return this.folderId;
    
    // Check if user set an explicit folder ID in settings
    const configuredFolderId = window.CONFIG.DRIVE_FOLDER_ID || localStorage.getItem(window.CONFIG.STORAGE_KEYS.FOLDER_ID);
    if (configuredFolderId) {
      this.folderId = configuredFolderId.trim();
      return this.folderId;
    }

    const headers = await this.getHeaders();
    const folderName = window.CONFIG.DRIVE_FOLDER_NAME;

    // Search for existing folder
    const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;

    const res = await fetch(searchUrl, { headers });
    if (!res.ok) throw new Error(`Drive folder query failed: ${res.statusText}`);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      this.folderId = data.files[0].id;
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
    return this.folderId;
  }

  /**
   * Load private data JSON from Google Drive
   */
  async loadPrivateData() {
    const headers = await this.getHeaders();
    const folderId = await this.ensureAppFolder();
    const filename = window.CONFIG.DRIVE_DATA_FILENAME;

    // Find data file inside the folder
    const q = `'${folderId}' in parents and name='${filename}' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`;

    const res = await fetch(searchUrl, { headers });
    if (!res.ok) throw new Error(`Drive file search error: ${res.statusText}`);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      this.dataFileId = data.files[0].id;
      // Download file content
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${this.dataFileId}?alt=media`, { headers });
      if (!fileRes.ok) throw new Error(`Failed to download data file: ${fileRes.statusText}`);
      const content = await fileRes.json();
      return content;
    }

    // No file exists yet; return null to indicate first-time setup
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
      // Update existing file
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
      // Create new file with multipart upload metadata
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
   * List documents & files stored in the Kreier-ToDo subfolder
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
   * Upload an arbitrary document or receipt (PDF, image, etc.) into the subfolder
   */
  async uploadFile(fileObj, customName = null) {
    const headers = await this.getHeaders();
    const folderId = await this.ensureAppFolder();
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
