/**
 * Google Identity Services (GIS) OAuth 2.0 Authentication Client
 * Secures browser-based authentication directly with Google.
 */

class AuthManager {
  constructor() {
    this.tokenClient = null;
    this.accessToken = sessionStorage.getItem('google_access_token') || null;
    this.tokenExpiresAt = parseInt(sessionStorage.getItem('google_token_expires') || '0', 10);
    this.user = this.loadSavedUser();
    this.listeners = [];
  }

  loadSavedUser() {
    try {
      const saved = localStorage.getItem(window.CONFIG.STORAGE_KEYS.GOOGLE_USER);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  saveUser(user) {
    this.user = user;
    if (user) {
      localStorage.setItem(window.CONFIG.STORAGE_KEYS.GOOGLE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(window.CONFIG.STORAGE_KEYS.GOOGLE_USER);
    }
  }

  initGis() {
    return new Promise((resolve) => {
      const clientId = window.CONFIG.GOOGLE_CLIENT_ID || localStorage.getItem(window.CONFIG.STORAGE_KEYS.CLIENT_ID);
      if (!clientId) {
        console.warn('Google Client ID not yet configured.');
        resolve(false);
        return;
      }

      if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        console.warn('Google Identity Services library not yet loaded.');
        resolve(false);
        return;
      }

      try {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: window.CONFIG.SCOPES,
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              this.accessToken = tokenResponse.access_token;
              const expiresIn = (parseInt(tokenResponse.expires_in, 10) || 3600) * 1000;
              this.tokenExpiresAt = Date.now() + expiresIn;
              sessionStorage.setItem('google_access_token', this.accessToken);
              sessionStorage.setItem('google_token_expires', this.tokenExpiresAt.toString());

              // Fetch user profile info
              await this.fetchUserProfile();
              this.notifyListeners();
            }
          },
          error_callback: (error) => {
            console.error('GIS Error:', error);
            window.App?.showToast('Google Sign-In failed or cancelled: ' + (error.message || error), 'error');
          }
        });
        resolve(true);
      } catch (err) {
        console.error('Failed to init GIS token client:', err);
        resolve(false);
      }
    });
  }

  async fetchUserProfile() {
    if (!this.accessToken) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (res.ok) {
        const profile = await res.json();
        this.saveUser({
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          picture: profile.picture
        });
        return this.user;
      }
    } catch (e) {
      console.warn('Failed to fetch user profile:', e);
    }
    return null;
  }

  signIn() {
    const clientId = window.CONFIG.GOOGLE_CLIENT_ID || localStorage.getItem(window.CONFIG.STORAGE_KEYS.CLIENT_ID);
    if (!clientId) {
      window.App?.openSettingsModal(true);
      return;
    }

    if (!this.tokenClient) {
      this.initGis().then((ok) => {
        if (ok && this.tokenClient) {
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
          window.App?.showToast('Please verify your Google Client ID in settings.', 'warning');
        }
      });
      return;
    }

    this.tokenClient.requestAccessToken({ prompt: '' });
  }

  signOut() {
    if (this.accessToken && typeof google !== 'undefined' && google.accounts?.oauth2) {
      try {
        google.accounts.oauth2.revoke(this.accessToken, () => {
          console.log('Google token revoked');
        });
      } catch (e) {
        console.warn(e);
      }
    }

    this.accessToken = null;
    this.tokenExpiresAt = 0;
    sessionStorage.removeItem('google_access_token');
    sessionStorage.removeItem('google_token_expires');
    this.saveUser(null);
    this.notifyListeners();
    window.App?.showToast('Signed out of Google Account.', 'info');
  }

  isSignedIn() {
    const isValid = this.accessToken && Date.now() < this.tokenExpiresAt;
    return !!isValid;
  }

  getAccessToken() {
    if (this.isSignedIn()) {
      return this.accessToken;
    }
    return null;
  }

  getUser() {
    return this.user;
  }

  onAuthChange(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    const signedIn = this.isSignedIn();
    const user = this.getUser();
    for (const cb of this.listeners) {
      try {
        cb({ signedIn, user });
      } catch (e) {
        console.error(e);
      }
    }
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { signedIn, user } }));
  }
}

window.Auth = new AuthManager();
