/**
 * Consultas parametrizadas (Prepared Statements) e RLS Lógico para o Cloudflare D1
 * Suporte completo a Google OAuth, Códigos OTP e Segurança de Dispositivos (Anti-Sybil)
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
    const stmt = db.prepare('SELECT id, email, display_name, role, avatar_url, email_verified, auth_provider, created_at FROM users WHERE id = ?');
    return await stmt.bind(id).first();
  },

  async getUserByGoogleId(db, googleId) {
    const stmt = db.prepare('SELECT * FROM users WHERE google_id = ?');
    return await stmt.bind(googleId).first();
  },

  async createUser(db, { id, email, passwordHash, salt, displayName, role = 'Jogador', emailVerified = 0, authProvider = 'email', googleId = null, avatarUrl = '' }) {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, display_name, role, email_verified, auth_provider, google_id, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return await stmt.bind(
      id,
      email.toLowerCase().trim(),
      passwordHash,
      salt,
      displayName.trim(),
      role,
      emailVerified,
      authProvider,
      googleId,
      avatarUrl
    ).run();
  },

  async linkGoogleAccount(db, userId, googleId, avatarUrl = '') {
    const stmt = db.prepare(`
      UPDATE users 
      SET google_id = ?, avatar_url = COALESCE(NULLIF(?, ''), avatar_url), auth_provider = 'both', email_verified = 1 
      WHERE id = ?
    `);
    return await stmt.bind(googleId, avatarUrl, userId).run();
  },

  async updateUserProfile(db, id, { displayName }) {
    const stmt = db.prepare('UPDATE users SET display_name = ? WHERE id = ?');
    return await stmt.bind(displayName.trim(), id).run();
  },

  // ==========================================
  // VERIFICAÇÃO DE E-MAIL (OTP DE 6 DÍGITOS)
  // ==========================================
  async createEmailVerification(db, { id, email, codeHash, expiresAt }) {
    // Apaga registros anteriores do mesmo e-mail antes de inserir novo
    await db.prepare('DELETE FROM email_verifications WHERE email = ?').bind(email.toLowerCase().trim()).run();
    const stmt = db.prepare(`
      INSERT INTO email_verifications (id, email, code_hash, expires_at, attempts)
      VALUES (?, ?, ?, ?, 0)
    `);
    return await stmt.bind(id, email.toLowerCase().trim(), codeHash, expiresAt).run();
  },

  async getEmailVerification(db, email) {
    const stmt = db.prepare('SELECT * FROM email_verifications WHERE email = ?');
    return await stmt.bind(email.toLowerCase().trim()).first();
  },

  async incrementVerificationAttempts(db, email) {
    const stmt = db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?');
    return await stmt.bind(email.toLowerCase().trim()).run();
  },

  async deleteEmailVerification(db, email) {
    const stmt = db.prepare('DELETE FROM email_verifications WHERE email = ?');
    return await stmt.bind(email.toLowerCase().trim()).run();
  },

  async markEmailVerified(db, email) {
    const stmt = db.prepare('UPDATE users SET email_verified = 1 WHERE email = ?');
    return await stmt.bind(email.toLowerCase().trim()).run();
  },

  // ==========================================
  // SEGURANÇA DE DISPOSITIVOS & ANTI-SYBIL
  // ==========================================
  async getDeviceSecurity(db, deviceHash) {
    const stmt = db.prepare('SELECT * FROM device_security WHERE device_hash = ?');
    return await stmt.bind(deviceHash).first();
  },

  async registerDeviceAttempt(db, deviceHash, ip) {
    const existing = await this.getDeviceSecurity(db, deviceHash);
    if (!existing) {
      const stmt = db.prepare(`
        INSERT INTO device_security (device_hash, first_ip, last_ip, accounts_created_count, status)
        VALUES (?, ?, ?, 1, 'ACTIVE')
      `);
      await stmt.bind(deviceHash, ip, ip).run();
      return { accountsCount: 1, status: 'ACTIVE' };
    }

    const nextCount = existing.accounts_created_count + 1;
    let nextStatus = existing.status;
    let reason = existing.reason;

    // Se criar mais de 3 contas no mesmo dispositivo, trava permanentemente
    if (nextCount > 3 && existing.status !== 'BLOCKED_PERMANENT') {
      nextStatus = 'BLOCKED_PERMANENT';
      reason = 'Excesso de contas geradas no mesmo dispositivo (defesa anti-Sybil)';
      const stmt = db.prepare(`
        UPDATE device_security 
        SET last_ip = ?, accounts_created_count = ?, status = ?, reason = ?, blocked_at = datetime('now')
        WHERE device_hash = ?
      `);
      await stmt.bind(ip, nextCount, nextStatus, reason, deviceHash).run();
    } else {
      const stmt = db.prepare(`
        UPDATE device_security 
        SET last_ip = ?, accounts_created_count = ?
        WHERE device_hash = ?
      `);
      await stmt.bind(ip, nextCount, deviceHash).run();
    }

    return { accountsCount: nextCount, status: nextStatus, reason };
  },

  async blockDevicePermanently(db, deviceHash, reason = 'Bloqueio administrativo ou violação de termos') {
    const stmt = db.prepare(`
      INSERT INTO device_security (device_hash, first_ip, last_ip, accounts_created_count, status, reason, blocked_at)
      VALUES (?, '0.0.0.0', '0.0.0.0', 0, 'BLOCKED_PERMANENT', ?, datetime('now'))
      ON CONFLICT(device_hash) DO UPDATE SET 
        status = 'BLOCKED_PERMANENT',
        reason = excluded.reason,
        blocked_at = datetime('now')
    `);
    return await stmt.bind(deviceHash, reason).run();
  },

  async unblockDevice(db, deviceHash, adminId) {
    const stmt = db.prepare(`
      UPDATE device_security
      SET status = 'ACTIVE',
          accounts_created_count = 0,
          reason = 'Liberado por administrador',
          unblocked_by = ?,
          unblocked_at = datetime('now')
      WHERE device_hash = ?
    `);
    return await stmt.bind(adminId, deviceHash).run();
  },

  async listBlockedDevices(db) {
    const stmt = db.prepare(`
      SELECT device_hash, first_ip, last_ip, accounts_created_count, status, reason, blocked_at, unblocked_by, unblocked_at, created_at
      FROM device_security
      WHERE status = 'BLOCKED_PERMANENT'
      ORDER BY blocked_at DESC
    `);
    const res = await stmt.all();
    return res.results || res;
  },

  // ==========================================
  // CAMPANHAS (COM FILTRAGEM RLS POR USUÁRIO)
  // ==========================================
  async getCampaignsByUser(db, userId) {
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
