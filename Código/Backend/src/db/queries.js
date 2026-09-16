/**
 * Consultas parametrizadas (Prepared Statements) e RLS Lógico para o Cloudflare D1
 */

export const dbQueries = {
  // ==========================================
  // USUÁRIOS & AUTENTICAÇÃO
  // ==========================================
  async getUserByEmail(db, email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return await stmt.bind(email.toLowerCase().trim()).first();
  },

  async getUserById(db, id) {
    const stmt = db.prepare('SELECT id, email, display_name, role, created_at FROM users WHERE id = ?');
    return await stmt.bind(id).first();
  },

  async createUser(db, { id, email, passwordHash, salt, displayName, role = 'Jogador' }) {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, display_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return await stmt.bind(id, email.toLowerCase().trim(), passwordHash, salt, displayName.trim(), role).run();
  },

  async updateUserProfile(db, id, { displayName }) {
    const stmt = db.prepare('UPDATE users SET display_name = ? WHERE id = ?');
    return await stmt.bind(displayName.trim(), id).run();
  },

  // ==========================================
  // CAMPANHAS (COM FILTRAGEM RLS POR USUÁRIO)
  // ==========================================
  async getCampaignsByUser(db, userId) {
    // Retorna campanhas das quais o usuário é mestre (owner) ou jogador convidado
    const stmt = db.prepare(`
      SELECT c.*, 
        CASE WHEN c.owner_id = ? THEN 'Mestre' ELSE 'Jogador' END AS user_role
      FROM campaigns c
      LEFT JOIN campaign_players cp ON c.id = cp.campaign_id AND cp.user_id = ?
      WHERE c.owner_id = ? OR cp.user_id = ?
      ORDER BY c.created_at DESC
    `);
    const res = await stmt.bind(userId, userId, userId, userId).all();
    return res.results || res;
  },

  async createCampaign(db, { id, name, ownerId, systemId = 'retroforge-core', description = '' }) {
    const stmt = db.prepare(`
      INSERT INTO campaigns (id, name, owner_id, system_id, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    return await stmt.bind(id, name.trim(), ownerId, systemId, description).run();
  },

  // ==========================================
  // PERSONAGENS (RLS ESTRITO POR USUÁRIO)
  // ==========================================
  async getCharactersByUser(db, userId) {
    const stmt = db.prepare('SELECT * FROM characters WHERE user_id = ? ORDER BY created_at DESC');
    const res = await stmt.bind(userId).all();
    return res.results || res;
  },

  async createCharacter(db, { id, userId, campaignId = null, name, sheetData = '{}' }) {
    const stmt = db.prepare(`
      INSERT INTO characters (id, user_id, campaign_id, name, sheet_data)
      VALUES (?, ?, ?, ?, ?)
    `);
    return await stmt.bind(id, userId, campaignId, name.trim(), typeof sheetData === 'string' ? sheetData : JSON.stringify(sheetData)).run();
  }
};
