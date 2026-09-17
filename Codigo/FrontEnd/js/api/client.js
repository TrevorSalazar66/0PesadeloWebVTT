/**
 * Cliente de Conexão Frontend Unificado para o Gateway do Arcana VTT
 * Comunica-se exclusivamente com os 2 endpoints (/api/auth e /api/sync)
 * Integrado com Fingerprinting de Dispositivo, OAuth e OTP
 */

import { getDeviceFingerprint } from '../security/fingerprint.js';

const API_BASE_URL = (typeof window !== 'undefined' && window.ARCANA_API_URL) || 'https://0pesadelo-web-vtt.trevorrot.workers.dev';

export const apiClient = {
  /**
   * Helper para injetar headers de segurança em todas as requisições
   */
  async _getHeaders() {
    let fingerprint = '';
    try {
      fingerprint = await getDeviceFingerprint();
    } catch (e) {
      console.warn('Falha ao coletar fingerprint local:', e);
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (fingerprint) {
      headers['X-Device-Fingerprint'] = fingerprint;
    }

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('arcana_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  },

  /**
   * Comunicação com o endpoint /api/auth
   */
  async auth(action, data = {}) {
    const headers = await this._getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/auth`, {
      method: 'POST',
      headers,
      credentials: 'include', // Envia e recebe cookies HttpOnly de forma automática
      body: JSON.stringify({ action, data })
    });

    const json = await res.json().catch(() => ({}));
    if (json && json.token) {
      try {
        localStorage.setItem('arcana_token', json.token);
      } catch (e) {}
    }

    if (!res.ok) {
      if (res.status === 401) {
        try { localStorage.removeItem('arcana_token'); } catch (e) {}
      }
      const error = new Error(json.erro || `Erro HTTP ${res.status}`);
      error.status = res.status;
      error.codigo = json.codigo;
      error.payload = json;
      throw error;
    }
    return json;
  },

  /**
   * Comunicação com o Gateway Unificado /api/sync (Command Pattern / RPC)
   */
  async sync(action, data = {}) {
    const headers = await this._getHeaders();
    const res = await fetch(`${API_BASE_URL}/api/sync`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ action, data })
    });

    const json = await res.json().catch(() => ({}));
    if (json && json.token) {
      try {
        localStorage.setItem('arcana_token', json.token);
      } catch (e) {}
    }

    if (!res.ok) {
      if (res.status === 401) {
        try { localStorage.removeItem('arcana_token'); } catch (e) {}
      }
      const error = new Error(json.erro || `Erro HTTP ${res.status}`);
      error.status = res.status;
      error.codigo = json.codigo;
      error.payload = json;
      throw error;
    }
    return json;
  },

  // === MÉTODOS SEMÂNTICOS DE AUTENTICAÇÃO ===

  login(email, password) {
    return this.auth('login', { email, password });
  },

  register(email, password, displayName) {
    return this.auth('register', { email, password, displayName });
  },

  verifyEmail(email, code) {
    return this.auth('verify_email', { email, code });
  },

  resendCode(email) {
    return this.auth('resend_code', { email });
  },

  logout() {
    return this.auth('logout');
  },

  loginWithGoogle() {
    window.location.href = `${API_BASE_URL}/api/auth/google/redirect`;
  },

  // === MÉTODOS DE SINCRONIZAÇÃO E REGRAS DE NEGÓCIO ===

  getProfile() {
    return this.sync('profile.get');
  },

  setupProfile({ name, nickname, ageGroup, bio, contacts = {}, avatarUrl = '', bannerUrl = '' }) {
    return this.sync('profile.setup', { name, nickname, ageGroup, bio, contacts, avatarUrl, bannerUrl });
  },

  updateProfile(displayName) {
    return this.sync('profile.update', { displayName });
  },

  listCampaigns() {
    return this.sync('campaigns.list');
  },

  getCampaignOptions() {
    return this.sync('campaigns.options');
  },

  getCampaign(params = {}) {
    return this.sync('campaigns.get', params);
  },

  createCampaign(campaignData = {}) {
    return this.sync('campaigns.create', campaignData);
  },

  listPublicCampaigns() {
    return this.sync('campaigns.public');
  },

  requestJoinCampaign(data) {
    return this.sync('campaigns.request', data);
  },

  listCampaignRequests(campaignId) {
    return this.sync('campaigns.requests.list', { campaignId });
  },

  updateCampaignRequest(requestId, status) {
    return this.sync('campaigns.requests.update', { requestId, status });
  },

  updateCampaignPlayerRole(campaignId, targetUserId, newRole) {
    return this.sync('campaigns.players.updateRole', { campaignId, targetUserId, newRole });
  },

  listCharacters() {
    return this.sync('characters.list');
  },

  createCharacter(name, sheetData = {}) {
    return this.sync('characters.create', { name, sheetData });
  },

  // === MÉTODOS DE ADMINISTRAÇÃO & SEGURANÇA ===

  adminListDevices() {
    return this.sync('admin.devices.list');
  },

  adminUnblockDevice(deviceHash) {
    return this.sync('admin.devices.unblock', { deviceHash });
  },

  adminSetUserRole(targetUserId, role) {
    return this.sync('admin.user.setRole', { targetUserId, role });
  }
};

if (typeof window !== 'undefined') {
  window.apiClient = apiClient;
}
