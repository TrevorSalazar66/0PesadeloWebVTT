/**
 * Cliente de Conexão Frontend Unificado para o Gateway do Arcana VTT
 * Comunica-se exclusivamente com os 2 endpoints (/api/auth e /api/sync)
 */

const API_BASE_URL = window.ARCANA_API_URL || 'http://localhost:8787';

export const apiClient = {
  /**
   * Comunicação com o endpoint /api/auth
   */
  async auth(action, data = {}) {
    const res = await fetch(`${API_BASE_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Envia e recebe cookies HttpOnly de forma automática
      body: JSON.stringify({ action, data })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.erro || `Erro HTTP ${res.status}`);
    }
    return json;
  },

  /**
   * Comunicação com o Gateway Unificado /api/sync (Command Pattern / RPC)
   */
  async sync(action, data = {}) {
    const res = await fetch(`${API_BASE_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ action, data })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.erro || `Erro HTTP ${res.status}`);
    }
    return json;
  },

  // Atalhos Semânticos
  login(email, password) {
    return this.auth('login', { email, password });
  },

  register(email, password, displayName) {
    return this.auth('register', { email, password, displayName });
  },

  logout() {
    return this.auth('logout');
  },

  getProfile() {
    return this.sync('profile.get');
  },

  updateProfile(displayName) {
    return this.sync('profile.update', { displayName });
  },

  listCampaigns() {
    return this.sync('campaigns.list');
  },

  createCampaign(name, systemId = 'retroforge-core', description = '') {
    return this.sync('campaigns.create', { name, systemId, description });
  },

  listCharacters() {
    return this.sync('characters.list');
  },

  createCharacter(name, sheetData = {}) {
    return this.sync('characters.create', { name, sheetData });
  }
};
