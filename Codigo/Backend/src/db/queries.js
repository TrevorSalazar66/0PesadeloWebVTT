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
    const stmt = db.prepare('SELECT id, email, display_name, role, avatar_url, email_verified, profile_completed, auth_provider, created_at FROM users WHERE id = ?');
    return await stmt.bind(id).first();
  },

  async getUserByGoogleId(db, googleId) {
    const stmt = db.prepare('SELECT * FROM users WHERE google_id = ?');
    return await stmt.bind(googleId).first();
  },

  async createUser(db, { id, email, passwordHash, salt, displayName, role = 'jogador', emailVerified = 0, profileCompleted = 0, authProvider = 'email', googleId = null, avatarUrl = '' }) {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, display_name, role, email_verified, profile_completed, auth_provider, google_id, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return await stmt.bind(
      id,
      email.toLowerCase().trim(),
      passwordHash,
      salt,
      displayName.trim(),
      role,
      emailVerified,
      profileCompleted,
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

  async updateUserRole(db, userId, newRole) {
    const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    return await stmt.bind(newRole, userId).run();
  },

  // ==========================================
  // PERFIS DE AVENTUREIROS (ONBOARDING & SOCIAL)
  // ==========================================
  async getUserProfile(db, userId) {
    const stmt = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?');
    const profile = await stmt.bind(userId).first();
    if (profile && typeof profile.contacts === 'string') {
      try {
        profile.contacts = JSON.parse(profile.contacts);
      } catch (_) {
        profile.contacts = {};
      }
    }
    return profile;
  },

  async getProfileByNickname(db, nickname) {
    const stmt = db.prepare('SELECT user_id, nickname FROM user_profiles WHERE nickname = ? COLLATE NOCASE');
    return await stmt.bind(nickname.trim()).first();
  },

  async saveUserProfile(db, { userId, name, nickname, ageGroup, bio, contacts = {}, avatarUrl = '', bannerUrl = '' }) {
    const contactsJson = typeof contacts === 'string' ? contacts : JSON.stringify(contacts);
    const stmtProfile = db.prepare(`
      INSERT INTO user_profiles (user_id, name, nickname, age_group, bio, contacts, avatar_url, banner_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        name = excluded.name,
        nickname = excluded.nickname,
        age_group = excluded.age_group,
        bio = excluded.bio,
        contacts = excluded.contacts,
        avatar_url = excluded.avatar_url,
        banner_url = excluded.banner_url,
        updated_at = datetime('now')
    `);
    await stmtProfile.bind(
      userId,
      name.trim(),
      nickname.trim(),
      ageGroup.trim(),
      bio.trim(),
      contactsJson,
      avatarUrl.trim(),
      bannerUrl.trim()
    ).run();

    const stmtUser = db.prepare(`
      UPDATE users 
      SET display_name = ?, profile_completed = 1, avatar_url = COALESCE(NULLIF(?, ''), avatar_url)
      WHERE id = ?
    `);
    return await stmtUser.bind(name.trim(), avatarUrl.trim(), userId).run();
  },

  async getUserWithAuth(db, id) {
    const stmt = db.prepare('SELECT id, email, password_hash, salt, display_name, role, avatar_url, email_verified, profile_completed, auth_provider, is_blocked, created_at FROM users WHERE id = ?');
    return await stmt.bind(id).first();
  },

  async updateUserPassword(db, userId, passwordHash, salt) {
    const stmt = db.prepare(`
      UPDATE users
      SET password_hash = ?, salt = ?, auth_provider = CASE WHEN auth_provider = 'google' THEN 'both' ELSE auth_provider END
      WHERE id = ?
    `);
    return await stmt.bind(passwordHash, salt, userId).run();
  },

  async getUserStats(db, userId) {
    let totalCampaigns = 0;
    let totalCreatedCampaigns = 0;
    let totalCharacters = 0;

    try {
      const campCountStmt = db.prepare(`
        SELECT COUNT(DISTINCT campaign_id) as total FROM (
          SELECT campaign_id FROM campaign_players WHERE user_id = ?
          UNION
          SELECT id as campaign_id FROM campaigns WHERE owner_id = ?
        )
      `);
      const campRes = await campCountStmt.bind(userId, userId).first();
      totalCampaigns = campRes?.total || 0;
    } catch (_) {
      try {
        const campCountStmt = db.prepare('SELECT COUNT(*) as total FROM campaign_players WHERE user_id = ?');
        const campRes = await campCountStmt.bind(userId).first();
        totalCampaigns = campRes?.total || 0;
      } catch (__) {}
    }

    try {
      const createdCountStmt = db.prepare('SELECT COUNT(*) as total FROM campaigns WHERE owner_id = ?');
      const createdRes = await createdCountStmt.bind(userId).first();
      totalCreatedCampaigns = createdRes?.total || 0;
    } catch (_) {}

    try {
      const charCountStmt = db.prepare('SELECT COUNT(*) as total FROM characters WHERE user_id = ?');
      const charRes = await charCountStmt.bind(userId).first();
      totalCharacters = charRes?.total || 0;
    } catch (_) {}

    return {
      totalCampaigns,
      totalCreatedCampaigns,
      totalCharacters
    };
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
  // CAMPANHAS (COM FILTRAGEM RLS POR USUÁRIO & CONTAGEM DE JOGADORES)
  // ==========================================
  async getCampaignsByUser(db, userId) {
    const stmt = db.prepare(`
      SELECT c.*, 
        CASE WHEN c.owner_id = ? THEN 'Mestre' ELSE 'Jogador' END AS user_role,
        (SELECT COUNT(*) FROM campaign_players cp2 WHERE cp2.campaign_id = c.id) AS current_players
      FROM campaigns c
      LEFT JOIN campaign_players cp ON c.id = cp.campaign_id AND cp.user_id = ?
      WHERE c.owner_id = ? OR cp.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    const res = await stmt.bind(userId, userId, userId, userId).all();
    return res.results || res;
  },

  async getPublicCampaigns(db, userId) {
    const stmt = db.prepare(`
      SELECT c.*, 
        u.display_name AS owner_name,
        u.avatar_url AS owner_avatar,
        (SELECT COUNT(*) FROM campaign_players cp2 WHERE cp2.campaign_id = c.id) AS current_players,
        (SELECT status FROM campaign_requests cr WHERE cr.campaign_id = c.id AND cr.user_id = ?) AS request_status
      FROM campaigns c
      JOIN users u ON c.owner_id = u.id
      WHERE c.owner_id != ? 
        AND NOT EXISTS (
          SELECT 1 FROM campaign_players cp WHERE cp.campaign_id = c.id AND cp.user_id = ?
        )
      ORDER BY c.created_at DESC
    `);
    const res = await stmt.bind(userId, userId, userId).all();
    return res.results || res;
  },

  async getCampaignById(db, campaignId) {
    const stmt = db.prepare(`
      SELECT c.*, 
        u.display_name AS owner_name,
        u.avatar_url AS owner_avatar,
        (SELECT COUNT(*) FROM campaign_players cp WHERE cp.campaign_id = c.id) AS current_players
      FROM campaigns c
      JOIN users u ON c.owner_id = u.id
      WHERE c.id = ?
    `);
    return await stmt.bind(campaignId).first();
  },

  async getCampaignBySimpleId(db, simpleId) {
    const stmt = db.prepare(`
      SELECT c.*, 
        u.display_name AS owner_name,
        (SELECT COUNT(*) FROM campaign_players cp WHERE cp.campaign_id = c.id) AS current_players
      FROM campaigns c
      JOIN users u ON c.owner_id = u.id
      WHERE c.simple_id = ? COLLATE NOCASE
    `);
    return await stmt.bind(simpleId.trim()).first();
  },

  async getCampaignPlayers(db, campaignId) {
    const stmt = db.prepare(`
      SELECT cp.campaign_id, cp.user_id, cp.role, cp.joined_at,
             u.display_name, u.avatar_url,
             p.nickname
      FROM campaign_players cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN user_profiles p ON cp.user_id = p.user_id
      WHERE cp.campaign_id = ?
      ORDER BY cp.joined_at ASC
    `);
    const res = await stmt.bind(campaignId).all();
    return res.results || res;
  },

  async createCampaign(db, { id, simpleId, name, ownerId, systemId = 'custom', themeId = 'dark-fantasy', loreDescription = '', imageUrl = '', bannerUrl = '', maxPlayers = 5 }) {
    const stmtCamp = db.prepare(`
      INSERT INTO campaigns (id, simple_id, name, owner_id, system_id, theme_id, lore_description, image_url, banner_url, max_players)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = await stmtCamp.bind(
      id,
      simpleId.trim(),
      name.trim(),
      ownerId,
      systemId,
      themeId,
      loreDescription.trim(),
      imageUrl.trim(),
      bannerUrl.trim(),
      Math.min(Math.max(Number(maxPlayers) || 5, 1), 12)
    ).run();

    // Vincula automaticamente o criador como Mestre da campanha
    try {
      const stmtPlayer = db.prepare(`
        INSERT OR IGNORE INTO campaign_players (campaign_id, user_id, role)
        VALUES (?, ?, 'Mestre')
      `);
      await stmtPlayer.bind(id, ownerId).run();
    } catch (_) {}

    return info;
  },

  async updateCampaign(db, campaignId, { name, systemId, themeId, sessions, nextSession, loreDescription, notices, maxPlayers }) {
    const stmt = db.prepare(`
      UPDATE campaigns 
      SET name = COALESCE(?, name),
          system_id = COALESCE(?, system_id),
          theme_id = COALESCE(?, theme_id),
          sessions = COALESCE(?, sessions),
          next_session = COALESCE(?, next_session),
          lore_description = COALESCE(?, lore_description),
          notices = COALESCE(?, notices),
          max_players = COALESCE(?, max_players)
      WHERE id = ?
    `);
    return await stmt.bind(
      name ? name.trim() : null,
      systemId ? String(systemId).trim() : null,
      themeId ? String(themeId).trim() : null,
      sessions !== undefined && sessions !== null && sessions !== '' ? Number(sessions) || 0 : null,
      nextSession !== undefined && nextSession !== null ? String(nextSession).trim() : null,
      loreDescription !== undefined && loreDescription !== null ? String(loreDescription).trim() : null,
      notices !== undefined && notices !== null ? String(notices).trim() : null,
      maxPlayers !== undefined && maxPlayers !== null ? Math.min(Math.max(Number(maxPlayers) || 5, 1), 12) : null,
      campaignId
    ).run();
  },

  async updateCampaignClock(db, campaignId, clockData) {
    const stmt = db.prepare('UPDATE campaigns SET clock_data = ? WHERE id = ?');
    return await stmt.bind(typeof clockData === 'string' ? clockData : JSON.stringify(clockData), campaignId).run();
  },

  async updateCampaignSettings(db, campaignId, settingsData) {
    const stmt = db.prepare('UPDATE campaigns SET settings = ? WHERE id = ?');
    return await stmt.bind(typeof settingsData === 'string' ? settingsData : JSON.stringify(settingsData), campaignId).run();
  },

  async addPlayerToCampaign(db, campaignId, userId, role = 'jogador') {
    const stmt = db.prepare(`
      INSERT INTO campaign_players (campaign_id, user_id, role)
      VALUES (?, ?, ?)
      ON CONFLICT(campaign_id, user_id) DO NOTHING
    `);
    return await stmt.bind(campaignId, userId, role).run();
  },

  async updateCampaignPlayerRole(db, campaignId, userId, newRole) {
    const stmt = db.prepare(`
      UPDATE campaign_players SET role = ?
      WHERE campaign_id = ? AND user_id = ?
    `);
    return await stmt.bind(newRole, campaignId, userId).run();
  },

  async isUserInCampaign(db, campaignId, userId) {
    const stmt = db.prepare('SELECT role FROM campaign_players WHERE campaign_id = ? AND user_id = ?');
    const res = await stmt.bind(campaignId, userId).first();
    return !!res;
  },

  async getCampaignPlayerRole(db, campaignId, userId) {
    const stmt = db.prepare('SELECT role FROM campaign_players WHERE campaign_id = ? AND user_id = ?');
    const res = await stmt.bind(campaignId, userId).first();
    return res ? res.role : null;
  },


  async kickPlayerFromCampaign(db, campaignId, userId) {
    // 1. Remove da tabela de participantes
    const stmt = db.prepare(`
      DELETE FROM campaign_players
      WHERE campaign_id = ? AND user_id = ?
    `);
    const res = await stmt.bind(campaignId, userId).run();

    // 2. Desvincula as fichas do jogador desta campanha
    try {
      await db.prepare(`
        UPDATE characters SET campaign_id = NULL
        WHERE campaign_id = ? AND user_id = ?
      `).bind(campaignId, userId).run();
    } catch (_) {}

    return res;
  },

  async deleteCampaign(db, campaignId) {
    try { await db.prepare('DELETE FROM scenes WHERE campaign_id = ?').bind(campaignId).run(); } catch (_) {}
    try { await db.prepare('DELETE FROM campaign_requests WHERE campaign_id = ?').bind(campaignId).run(); } catch (_) {}
    try { await db.prepare('DELETE FROM campaign_players WHERE campaign_id = ?').bind(campaignId).run(); } catch (_) {}
    try { await db.prepare('UPDATE characters SET campaign_id = NULL WHERE campaign_id = ?').bind(campaignId).run(); } catch (_) {}
    const stmt = db.prepare('DELETE FROM campaigns WHERE id = ?');
    return await stmt.bind(campaignId).run();
  },

  // ==========================================
  // BANIMENTO DE JOGADORES POR MESTRE (TODAS AS MESAS DO MESTRE)
  // ==========================================
  async banPlayerFromGM(db, gmId, playerId, reason = 'Banido pelo Mestre') {
    // 1. Registra na tabela de banimento do Mestre
    const stmtBan = db.prepare(`
      INSERT OR REPLACE INTO gm_banned_players (gm_id, player_id, reason, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    await stmtBan.bind(gmId, playerId, reason).run();

    // 2. Remove o jogador banido de TODAS as campanhas criadas por este mestre
    const stmtKickAll = db.prepare(`
      DELETE FROM campaign_players
      WHERE user_id = ? AND campaign_id IN (SELECT id FROM campaigns WHERE owner_id = ?)
    `);
    await stmtKickAll.bind(playerId, gmId).run();

    // 3. Cancela/deleta todas as solicitações pendentes desse jogador nas mesas deste mestre
    try {
      await db.prepare(`
        DELETE FROM campaign_requests
        WHERE user_id = ? AND campaign_id IN (SELECT id FROM campaigns WHERE owner_id = ?)
      `).bind(playerId, gmId).run();
    } catch (_) {}

    // 4. Desvincula personagens desse jogador de todas as campanhas deste mestre
    try {
      await db.prepare(`
        UPDATE characters SET campaign_id = NULL
        WHERE user_id = ? AND campaign_id IN (SELECT id FROM campaigns WHERE owner_id = ?)
      `).bind(playerId, gmId).run();
    } catch (_) {}

    return { sucesso: true };
  },

  async unbanPlayerFromGM(db, gmId, playerId) {
    const stmt = db.prepare(`
      DELETE FROM gm_banned_players
      WHERE gm_id = ? AND player_id = ?
    `);
    return await stmt.bind(gmId, playerId).run();
  },

  async isPlayerBannedByGM(db, gmId, playerId) {
    if (!gmId || !playerId) return false;
    const stmt = db.prepare(`
      SELECT 1 FROM gm_banned_players
      WHERE gm_id = ? AND player_id = ?
    `);
    const row = await stmt.bind(gmId, playerId).first();
    return !!row;
  },

  async listGMBannedPlayers(db, gmId) {
    const stmt = db.prepare(`
      SELECT b.gm_id, b.player_id, b.reason, b.created_at,
             u.display_name, u.email, u.avatar_url,
             p.nickname
      FROM gm_banned_players b
      JOIN users u ON b.player_id = u.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE b.gm_id = ?
      ORDER BY b.created_at DESC
    `);
    const res = await stmt.bind(gmId).all();
    return res.results || res || [];
  },

  async createCampaignRequest(db, { id, campaignId, userId }) {
    const stmt = db.prepare(`
      INSERT INTO campaign_requests (id, campaign_id, user_id)
      VALUES (?, ?, ?)
    `);
    return await stmt.bind(id, campaignId, userId).run();
  },

  async getCampaignRequests(db, campaignId) {
    const stmt = db.prepare(`
      SELECT cr.*, u.display_name, u.email, u.avatar_url, p.nickname
      FROM campaign_requests cr
      JOIN users u ON cr.user_id = u.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE cr.campaign_id = ? AND cr.status = 'pendente'
      ORDER BY cr.created_at ASC
    `);
    const res = await stmt.bind(campaignId).all();
    return res.results || res || [];
  },

  async updateCampaignRequestStatus(db, requestId, status) {
    const stmt = db.prepare(`
      UPDATE campaign_requests SET status = ?
      WHERE id = ?
    `);
    return await stmt.bind(status, requestId).run();
  },

  async getCampaignRequestById(db, requestId) {
    const stmt = db.prepare('SELECT * FROM campaign_requests WHERE id = ?');
    return await stmt.bind(requestId).first();
  },

  // ==========================================
  // PERSONAGENS (RLS ESTRITO POR USUÁRIO)
  // ==========================================
  async getCharactersByUser(db, userId) {
    const stmt = db.prepare('SELECT * FROM characters WHERE user_id = ? ORDER BY created_at DESC');
    const res = await stmt.bind(userId).all();
    return res.results || res;
  },

  async getCharacterById(db, id) {
    const stmt = db.prepare('SELECT * FROM characters WHERE id = ?');
    return await stmt.bind(id).first();
  },

  async getCharacterByUserAndCampaign(db, userId, campaignId) {
    const stmt = db.prepare('SELECT * FROM characters WHERE user_id = ? AND campaign_id = ?');
    return await stmt.bind(userId, campaignId).first();
  },

  async getCharactersByUserHierarchical(db, userId) {
    const stmt = db.prepare(`
      SELECT c.*, 
             cmp.name as campaign_name, 
             cmp.simple_id as campaign_simple_id, 
             cmp.system_id as campaign_system_id, 
             cmp.image_url as campaign_image_url, 
             cmp.banner_url as campaign_banner_url
      FROM characters c
      LEFT JOIN campaigns cmp ON c.campaign_id = cmp.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `);
    const res = await stmt.bind(userId).all();
    return res.results || res;
  },

  async getCampaignPartyCharacters(db, campaignId) {
    const stmt = db.prepare(`
      SELECT c.*, 
             u.display_name as player_name, 
             u.avatar_url as player_avatar,
             p.nickname as player_nickname
      FROM characters c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE c.campaign_id = ?
      ORDER BY c.name ASC
    `);
    const res = await stmt.bind(campaignId).all();
    return res.results || res;
  },

  async updateCharacterSheet(db, id, sheetData) {
    const stmt = db.prepare('UPDATE characters SET sheet_data = ? WHERE id = ?');
    return await stmt.bind(typeof sheetData === 'string' ? sheetData : JSON.stringify(sheetData), id).run();
  },

  async createCharacter(db, { id, userId, campaignId = null, name, sheetData = '{}' }) {
    const stmt = db.prepare(`
      INSERT INTO characters (id, user_id, campaign_id, name, sheet_data)
      VALUES (?, ?, ?, ?, ?)
    `);
    return await stmt.bind(id, userId, campaignId, name.trim(), typeof sheetData === 'string' ? sheetData : JSON.stringify(sheetData)).run();
  },

  async deleteCharacter(db, id) {
    const stmt = db.prepare('DELETE FROM characters WHERE id = ?');
    return await stmt.bind(id).run();
  },

  async getCharactersByCampaign(db, campaignId) {
    const stmt = db.prepare('SELECT * FROM characters WHERE campaign_id = ? ORDER BY name ASC');
    const res = await stmt.bind(campaignId).all();
    return res.results || res;
  },

  // ==========================================
  // CENAS DA CAMPANHA (MODULARES & INTERATIVAS)
  // ==========================================
  async ensureScenesTable(db) {
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS scenes (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          image_url TEXT DEFAULT '',
          model TEXT DEFAULT 'grid',
          model_data TEXT DEFAULT '{}',
          rules_data TEXT DEFAULT '[]',
          style_data TEXT DEFAULT '{}',
          state_data TEXT DEFAULT '{}',
          max_players INTEGER DEFAULT 10,
          xp_triggers TEXT DEFAULT '[]',
          is_active INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )
      `);

      // Migração suave de colunas se tabela já existia sem as novas propriedades
      const cols = ['model', 'model_data', 'rules_data', 'style_data', 'state_data', 'max_players'];
      for (const col of cols) {
        try {
          await db.exec(`ALTER TABLE scenes ADD COLUMN ${col} TEXT DEFAULT ''`);
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Erro em ensureScenesTable:', e);
    }
  },

  async createScene(db, {
    id,
    campaignId,
    name,
    description = '',
    imageUrl = '',
    model = 'grid',
    modelData = '{}',
    rulesData = '[]',
    styleData = '{}',
    stateData = '{}',
    maxPlayers = 10,
    xpTriggers = '[]',
    isActive = 0
  }) {
    await this.ensureScenesTable(db);
    const stmt = db.prepare(`
      INSERT INTO scenes (
        id, campaign_id, name, description, image_url,
        model, model_data, rules_data, style_data, state_data,
        max_players, xp_triggers, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return await stmt.bind(
      id,
      campaignId,
      name.trim(),
      description.trim(),
      imageUrl.trim(),
      model.trim(),
      typeof modelData === 'string' ? modelData : JSON.stringify(modelData),
      typeof rulesData === 'string' ? rulesData : JSON.stringify(rulesData),
      typeof styleData === 'string' ? styleData : JSON.stringify(styleData),
      typeof stateData === 'string' ? stateData : JSON.stringify(stateData),
      Number(maxPlayers) || 10,
      typeof xpTriggers === 'string' ? xpTriggers : JSON.stringify(xpTriggers),
      isActive ? 1 : 0
    ).run();
  },

  async getScenesByCampaign(db, campaignId) {
    await this.ensureScenesTable(db);
    const stmt = db.prepare('SELECT * FROM scenes WHERE campaign_id = ? ORDER BY created_at ASC');
    const res = await stmt.bind(campaignId).all();
    return res.results || res || [];
  },

  async getSceneById(db, id) {
    await this.ensureScenesTable(db);
    const stmt = db.prepare('SELECT * FROM scenes WHERE id = ?');
    return await stmt.bind(id).first();
  },

  async updateScene(db, id, {
    name,
    description,
    imageUrl,
    model,
    modelData,
    rulesData,
    styleData,
    stateData,
    maxPlayers,
    xpTriggers,
    isActive
  }) {
    await this.ensureScenesTable(db);
    const stmt = db.prepare(`
      UPDATE scenes
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          image_url = COALESCE(?, image_url),
          model = COALESCE(?, model),
          model_data = COALESCE(?, model_data),
          rules_data = COALESCE(?, rules_data),
          style_data = COALESCE(?, style_data),
          state_data = COALESCE(?, state_data),
          max_players = COALESCE(?, max_players),
          xp_triggers = COALESCE(?, xp_triggers),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `);
    return await stmt.bind(
      name !== undefined ? name.trim() : null,
      description !== undefined ? description.trim() : null,
      imageUrl !== undefined ? imageUrl.trim() : null,
      model !== undefined ? model.trim() : null,
      modelData !== undefined ? (typeof modelData === 'string' ? modelData : JSON.stringify(modelData)) : null,
      rulesData !== undefined ? (typeof rulesData === 'string' ? rulesData : JSON.stringify(rulesData)) : null,
      styleData !== undefined ? (typeof styleData === 'string' ? styleData : JSON.stringify(styleData)) : null,
      stateData !== undefined ? (typeof stateData === 'string' ? stateData : JSON.stringify(stateData)) : null,
      maxPlayers !== undefined ? Number(maxPlayers) : null,
      xpTriggers !== undefined ? (typeof xpTriggers === 'string' ? xpTriggers : JSON.stringify(xpTriggers)) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      id
    ).run();
  },

  async setActiveScene(db, campaignId, sceneId) {
    await this.ensureScenesTable(db);
    // 1. Desativa todas as cenas da campanha
    await db.prepare('UPDATE scenes SET is_active = 0 WHERE campaign_id = ?').bind(campaignId).run();
    // 2. Ativa a cena selecionada
    if (sceneId) {
      await db.prepare('UPDATE scenes SET is_active = 1 WHERE id = ? AND campaign_id = ?').bind(sceneId, campaignId).run();
    }
    return { sucesso: true };
  },

  async updateSceneState(db, sceneId, stateData) {
    await this.ensureScenesTable(db);
    const stateStr = typeof stateData === 'string' ? stateData : JSON.stringify(stateData);
    return await db.prepare('UPDATE scenes SET state_data = ? WHERE id = ?').bind(stateStr, sceneId).run();
  },

  async deleteScene(db, id) {
    await this.ensureScenesTable(db);
    const stmt = db.prepare('DELETE FROM scenes WHERE id = ?');
    return await stmt.bind(id).run();
  },

  // ==========================================
  // ECOSSISTEMA E SISTEMAS DE RPG
  // ==========================================
  async getCharactersBySystem(db, systemId = 'alphad6') {
    const stmt = db.prepare(`
      SELECT c.*, 
             cmp.name as campaign_name, 
             cmp.simple_id as campaign_simple_id, 
             cmp.system_id as campaign_system_id,
             u.display_name as creator_name,
             u.avatar_url as creator_avatar
      FROM characters c
      LEFT JOIN campaigns cmp ON c.campaign_id = cmp.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE cmp.system_id = ? OR c.sheet_data LIKE ?
      ORDER BY c.created_at DESC
    `);
    const pattern = `%"sistema":"${systemId}"%`;
    const res = await stmt.bind(systemId, pattern).all();
    return res.results || res;
  },

  async getCampaignsBySystem(db, systemId = 'alphad6') {
    const stmt = db.prepare(`
      SELECT cmp.*, u.display_name as owner_name
      FROM campaigns cmp
      LEFT JOIN users u ON cmp.owner_id = u.id
      WHERE cmp.system_id = ?
      ORDER BY cmp.created_at DESC
    `);
    const res = await stmt.bind(systemId).all();
    return res.results || res;
  },

  // ==========================================
  // GOVERNANÇA & PAINEL ADMINISTRATIVO (ADMIN / SUPERADMIN)
  // ==========================================
  async getAdminPlatformStats(db) {
    const totalUsersRow = await db.prepare('SELECT COUNT(*) as total FROM users').first();
    const totalCampaignsRow = await db.prepare('SELECT COUNT(*) as total FROM campaigns').first();
    const totalCharactersRow = await db.prepare('SELECT COUNT(*) as total FROM characters').first();
    const totalBlockedDevicesRow = await db.prepare("SELECT COUNT(*) as total FROM device_security WHERE status = 'BLOCKED_PERMANENT'").first();

    const rolesQuery = await db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all();
    const rolesRows = rolesQuery.results || rolesQuery || [];
    const rolesMap = { jogador: 0, mestre: 0, admin: 0, superadmin: 0 };
    for (const r of rolesRows) {
      const k = String(r.role || '').toLowerCase();
      if (rolesMap[k] !== undefined) {
        rolesMap[k] = r.count;
      }
    }

    return {
      totalUsers: totalUsersRow?.total || 0,
      totalCampaigns: totalCampaignsRow?.total || 0,
      totalCharacters: totalCharactersRow?.total || 0,
      totalBlockedDevices: totalBlockedDevicesRow?.total || 0,
      roles: rolesMap
    };
  },

  async listUsersAdmin(db, { search = '', role = null, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT u.id, u.email, u.display_name, u.role, u.email_verified, u.profile_completed, 
             COALESCE(u.is_blocked, 0) as is_blocked,
             u.auth_provider, u.created_at,
             u.password_hash, u.salt, u.google_id,
             p.name as profile_name, p.nickname, p.age_group, p.avatar_url, p.banner_url, p.bio, p.contacts,
             (SELECT COUNT(*) FROM campaigns WHERE owner_id = u.id) as campaigns_count,
             (SELECT COUNT(*) FROM characters WHERE user_id = u.id) as characters_count
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const cleanSearch = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(u.display_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(COALESCE(p.nickname, '')) LIKE ?)`;
      params.push(cleanSearch, cleanSearch, cleanSearch);
    }

    if (role && role !== 'todos') {
      sql += ` AND LOWER(u.role) = ?`;
      params.push(role.toLowerCase().trim());
    }

    sql += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Math.max(1, Math.min(200, limit)), Math.max(0, offset));

    const stmt = db.prepare(sql);
    const res = await stmt.bind(...params).all();
    return res.results || res || [];
  },

  async blockUser(db, userId, isBlocked = 1) {
    const stmt = db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?');
    return await stmt.bind(isBlocked, userId).run();
  },

  async deleteUser(db, userId) {
    try { await db.prepare('DELETE FROM user_profiles WHERE user_id = ?').bind(userId).run(); } catch (_) {}
    try { await db.prepare('DELETE FROM characters WHERE user_id = ?').bind(userId).run(); } catch (_) {}
    try { await db.prepare('DELETE FROM campaign_players WHERE user_id = ?').bind(userId).run(); } catch (_) {}
    try { await db.prepare('DELETE FROM campaigns WHERE owner_id = ?').bind(userId).run(); } catch (_) {}
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return await stmt.bind(userId).run();
  },


  async listAllCampaignsAdmin(db, { search = '', limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT c.*, 
             u.display_name as owner_name, 
             u.email as owner_email,
             (SELECT COUNT(*) FROM campaign_players cp WHERE cp.campaign_id = c.id) as current_players,
             (SELECT COUNT(*) FROM characters ch WHERE ch.campaign_id = c.id) as total_characters
      FROM campaigns c
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const cleanSearch = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(c.name) LIKE ? OR LOWER(c.simple_id) LIKE ? OR LOWER(u.display_name) LIKE ?)`;
      params.push(cleanSearch, cleanSearch, cleanSearch);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Math.max(1, Math.min(200, limit)), Math.max(0, offset));

    const stmt = db.prepare(sql);
    const res = await stmt.bind(...params).all();
    return res.results || res || [];
  },

  async logAdminAudit(db, { id, adminId, adminName, action, targetType, targetId, details = {} }) {
    const auditId = id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const stmt = db.prepare(`
      INSERT INTO admin_audit_logs (id, admin_id, admin_name, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    return await stmt.bind(
      auditId,
      adminId,
      adminName || 'Admin',
      action,
      targetType,
      targetId,
      typeof details === 'string' ? details : JSON.stringify(details)
    ).run();
  },

  async listAdminAuditLogs(db, { limit = 50 } = {}) {
    const stmt = db.prepare(`
      SELECT * FROM admin_audit_logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    const res = await stmt.bind(Math.max(1, Math.min(100, limit))).all();
    return res.results || res || [];
  },

  // ==========================================
  // MENSAGENS & CHAT DA CAMPANHA (COM AUTO-CRIAÇÃO RESILIENTE)
  // ==========================================
  async ensureCampaignMessagesTable(db) {
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS campaign_messages (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          character_id TEXT,
          author_name TEXT NOT NULL,
          author_avatar TEXT DEFAULT '',
          author_role TEXT DEFAULT 'jogador',
          msg_type TEXT NOT NULL DEFAULT 'ic',
          content TEXT NOT NULL,
          metadata TEXT NOT NULL DEFAULT '{}',
          whisper_target_id TEXT DEFAULT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `).run();
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_campaign ON campaign_messages(campaign_id, created_at)`).run().catch(() => {});
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_user ON campaign_messages(user_id)`).run().catch(() => {});
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_whisper ON campaign_messages(whisper_target_id)`).run().catch(() => {});
    } catch (_) {}
  },

  async saveCampaignMessage(db, {
    id,
    campaignId,
    userId,
    characterId = null,
    authorName,
    authorAvatar = '',
    authorRole = 'jogador',
    msgType = 'ic',
    content,
    metadata = {},
    whisperTargetId = null
  }) {
    const msgId = id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

    const executeInsert = async () => {
      const stmt = db.prepare(`
        INSERT INTO campaign_messages (
          id, campaign_id, user_id, character_id,
          author_name, author_avatar, author_role,
          msg_type, content, metadata, whisper_target_id,
          is_deleted, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
      `);

      return await stmt.bind(
        msgId,
        campaignId,
        userId,
        characterId,
        authorName.trim(),
        authorAvatar || '',
        authorRole,
        msgType,
        content.trim(),
        metadataStr,
        whisperTargetId || null
      ).run();
    };

    try {
      await executeInsert();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureCampaignMessagesTable(db);
        await executeInsert();
      } else {
        throw err;
      }
    }

    return await this.getCampaignMessageById(db, msgId);
  },

  async getCampaignMessageById(db, messageId) {
    try {
      const stmt = db.prepare('SELECT * FROM campaign_messages WHERE id = ?');
      const msg = await stmt.bind(messageId).first();
      if (msg && typeof msg.metadata === 'string') {
        try {
          msg.metadata = JSON.parse(msg.metadata);
        } catch (_) {
          msg.metadata = {};
        }
      }
      return msg;
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureCampaignMessagesTable(db);
        return null;
      }
      throw err;
    }
  },

  async getCampaignMessages(db, campaignId, { limit = 50, beforeTimestamp = null, userId = null, isGm = false } = {}) {
    const safeLimit = Math.max(1, Math.min(100, limit));
    let sql = `
      SELECT * FROM campaign_messages
      WHERE campaign_id = ? AND is_deleted = 0
    `;
    const params = [campaignId];

    if (!isGm && userId) {
      sql += ` AND (whisper_target_id IS NULL OR user_id = ? OR whisper_target_id = ? OR whisper_target_id = 'all')`;
      params.push(userId, userId);
    }

    if (beforeTimestamp) {
      sql += ` AND created_at < ?`;
      params.push(beforeTimestamp);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(safeLimit);

    let rows = [];
    try {
      const stmt = db.prepare(sql);
      const res = await stmt.bind(...params).all();
      rows = res.results || res || [];
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureCampaignMessagesTable(db);
        return [];
      }
      throw err;
    }

    // Parse metadata e reverte para ordem cronológica (mais antiga -> mais nova)
    const formatted = rows.map(r => {
      let meta = {};
      if (typeof r.metadata === 'string') {
        try {
          meta = JSON.parse(r.metadata);
        } catch (_) {}
      } else if (r.metadata && typeof r.metadata === 'object') {
        meta = r.metadata;
      }
      return {
        ...r,
        metadata: meta
      };
    }).reverse();

    return formatted;
  },

  async updateCampaignMessageContent(db, messageId, campaignId, newContent) {
    try {
      const stmt = db.prepare(`
        UPDATE campaign_messages 
        SET content = ? 
        WHERE id = ? AND campaign_id = ?
      `);
      return await stmt.bind(newContent, messageId, campaignId).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureCampaignMessagesTable(db);
        return;
      }
      throw err;
    }
  },

  async deleteCampaignMessage(db, messageId, campaignId) {
    try {
      const stmt = db.prepare(`
        UPDATE campaign_messages 
        SET is_deleted = 1 
        WHERE id = ? AND campaign_id = ?
      `);
      return await stmt.bind(messageId, campaignId).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureCampaignMessagesTable(db);
        return;
      }
      throw err;
    }
  },

  async clearAllCampaignMessages(db, campaignId) {
    try {
      const stmt = db.prepare(`
        UPDATE campaign_messages 
        SET is_deleted = 1 
        WHERE campaign_id = ?
      `);
      return await stmt.bind(campaignId).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureCampaignMessagesTable(db);
        return;
      }
      throw err;
    }
  },

  async updateCampaignMessageMetadata(db, messageId, metadataObj) {
    const metaStr = typeof metadataObj === 'string' ? metadataObj : JSON.stringify(metadataObj);
    try {
      const stmt = db.prepare(`
        UPDATE campaign_messages 
        SET metadata = ? 
        WHERE id = ?
      `);
      return await stmt.bind(metaStr, messageId).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureCampaignMessagesTable(db);
        return;
      }
    }
  },

  // ==========================================
  // PRESENÇA E SINALIZAÇÃO P2P (WEBRTC)
  // ==========================================

  async ensurePresenceTable(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS campaign_presence (
        campaign_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        is_leader INTEGER DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (campaign_id, user_id)
      )
    `);
  },

  async updatePresence(db, campaignId, userId, isLeader = 0) {
    try {
      const stmt = db.prepare(`
        INSERT INTO campaign_presence (campaign_id, user_id, is_leader, last_seen)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(campaign_id, user_id) DO UPDATE SET
          is_leader = excluded.is_leader,
          last_seen = datetime('now')
      `);
      return await stmt.bind(campaignId, userId, isLeader).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensurePresenceTable(db);
        return await this.updatePresence(db, campaignId, userId, isLeader);
      }
      throw err;
    }
  },

  async getActivePresence(db, campaignId, timeoutSeconds = 15) {
    try {
      const stmt = db.prepare(`
        SELECT user_id, is_leader, last_seen 
        FROM campaign_presence 
        WHERE campaign_id = ? 
          AND (strftime('%s', 'now') - strftime('%s', last_seen)) <= ?
        ORDER BY user_id ASC
      `);
      const res = await stmt.bind(campaignId, timeoutSeconds).all();
      return res.results || res || [];
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensurePresenceTable(db);
        return [];
      }
      throw err;
    }
  },

  async ensureSignalsTable(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS webrtc_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },

  async insertSignal(db, campaignId, senderId, targetId, type, payload) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    try {
      const stmt = db.prepare(`
        INSERT INTO webrtc_signals (campaign_id, sender_id, target_id, type, payload)
        VALUES (?, ?, ?, ?, ?)
      `);
      return await stmt.bind(campaignId, senderId, targetId, type, payloadStr).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureSignalsTable(db);
        return await this.insertSignal(db, campaignId, senderId, targetId, type, payload);
      }
      throw err;
    }
  },

  async consumeSignals(db, campaignId, targetId) {
    try {
      const stmtSelect = db.prepare(`
        SELECT id, sender_id, type, payload, created_at 
        FROM webrtc_signals 
        WHERE campaign_id = ? AND target_id = ?
        ORDER BY created_at ASC
      `);
      const res = await stmtSelect.bind(campaignId, targetId).all();
      const signals = res.results || res || [];

      if (signals.length > 0) {
        const idsToDelete = signals.map(s => s.id);
        const placeholders = idsToDelete.map(() => '?').join(',');
        const stmtDelete = db.prepare(`
          DELETE FROM webrtc_signals WHERE id IN (${placeholders})
        `);
        await stmtDelete.bind(...idsToDelete).run();
      }

      return signals.map(s => {
        let parsedPayload = s.payload;
        try { parsedPayload = JSON.parse(s.payload); } catch(e){}
        return { ...s, payload: parsedPayload };
      });
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureSignalsTable(db);
        return [];
      }
      throw err;
    }
  },

  // ==========================================
  // CENAS DA CAMPANHA (MODULARES & INTERATIVAS)
  // ==========================================

  async ensureScenesTable(db) {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        image_url TEXT DEFAULT '',
        model TEXT DEFAULT 'tactical_grid',
        model_data TEXT DEFAULT '{}',
        rules_data TEXT DEFAULT '[]',
        style_data TEXT DEFAULT '{}',
        state_data TEXT DEFAULT '{}',
        max_players INTEGER DEFAULT 12,
        xp_triggers TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Migrações dinâmicas para colunas adicionais
    try { await db.prepare("ALTER TABLE scenes ADD COLUMN model TEXT DEFAULT 'tactical_grid'").run(); } catch (_) {}
    try { await db.prepare("ALTER TABLE scenes ADD COLUMN model_data TEXT DEFAULT '{}'").run(); } catch (_) {}
    try { await db.prepare("ALTER TABLE scenes ADD COLUMN rules_data TEXT DEFAULT '[]'").run(); } catch (_) {}
    try { await db.prepare("ALTER TABLE scenes ADD COLUMN style_data TEXT DEFAULT '{}'").run(); } catch (_) {}
    try { await db.prepare("ALTER TABLE scenes ADD COLUMN state_data TEXT DEFAULT '{}'").run(); } catch (_) {}
    try { await db.prepare("ALTER TABLE scenes ADD COLUMN max_players INTEGER DEFAULT 12").run(); } catch (_) {}
    try { await db.prepare("ALTER TABLE scenes ADD COLUMN is_active INTEGER DEFAULT 0").run(); } catch (_) {}
    try { await db.prepare("ALTER TABLE scenes ADD COLUMN xp_triggers TEXT DEFAULT '[]'").run(); } catch (_) {}
  },

  async createScene(db, { id, campaignId, name, description = '', imageUrl = '', model = 'tactical_grid', modelData = {}, rulesData = [], styleData = {}, stateData = {}, maxPlayers = 12, xpTriggers = [], isActive = 0 }) {
    try {
      const stmt = db.prepare(`
        INSERT INTO scenes (id, campaign_id, name, description, image_url, model, model_data, rules_data, style_data, state_data, max_players, xp_triggers, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      return await stmt.bind(
        id,
        campaignId,
        name,
        description || '',
        imageUrl || '',
        model || 'tactical_grid',
        typeof modelData === 'string' ? modelData : JSON.stringify(modelData || {}),
        typeof rulesData === 'string' ? rulesData : JSON.stringify(rulesData || []),
        typeof styleData === 'string' ? styleData : JSON.stringify(styleData || {}),
        typeof stateData === 'string' ? stateData : JSON.stringify(stateData || {}),
        maxPlayers || 12,
        typeof xpTriggers === 'string' ? xpTriggers : JSON.stringify(xpTriggers || []),
        isActive ? 1 : 0
      ).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureScenesTable(db);
        return await this.createScene(db, { id, campaignId, name, description, imageUrl, model, modelData, rulesData, styleData, stateData, maxPlayers, xpTriggers, isActive });
      }
      throw err;
    }
  },

  async getScenesByCampaign(db, campaignId) {
    try {
      const stmt = db.prepare(`
        SELECT * FROM scenes 
        WHERE campaign_id = ? 
        ORDER BY created_at ASC
      `);
      const res = await stmt.bind(campaignId).all();
      return res.results || res || [];
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureScenesTable(db);
        return [];
      }
      throw err;
    }
  },

  async getSceneById(db, sceneId) {
    try {
      const stmt = db.prepare('SELECT * FROM scenes WHERE id = ?');
      return await stmt.bind(sceneId).first();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureScenesTable(db);
        return null;
      }
      throw err;
    }
  },

  async updateScene(db, sceneId, { name, description, imageUrl, model, modelData, rulesData, styleData, stateData, maxPlayers, xpTriggers, isActive }) {
    try {
      const existing = await this.getSceneById(db, sceneId);
      if (!existing) return null;

      const finalName = name !== undefined ? name : existing.name;
      const finalDesc = description !== undefined ? description : existing.description;
      const finalImg = imageUrl !== undefined ? imageUrl : existing.image_url;
      const finalModel = model !== undefined ? model : existing.model;
      const finalModelData = modelData !== undefined ? (typeof modelData === 'string' ? modelData : JSON.stringify(modelData)) : existing.model_data;
      const finalRulesData = rulesData !== undefined ? (typeof rulesData === 'string' ? rulesData : JSON.stringify(rulesData)) : existing.rules_data;
      const finalStyleData = styleData !== undefined ? (typeof styleData === 'string' ? styleData : JSON.stringify(styleData)) : existing.style_data;
      const finalStateData = stateData !== undefined ? (typeof stateData === 'string' ? stateData : JSON.stringify(stateData)) : existing.state_data;
      const finalMaxPlayers = maxPlayers !== undefined ? maxPlayers : existing.max_players;
      const finalXp = xpTriggers !== undefined ? (typeof xpTriggers === 'string' ? xpTriggers : JSON.stringify(xpTriggers)) : existing.xp_triggers;
      const finalActive = isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active;

      const stmt = db.prepare(`
        UPDATE scenes 
        SET name = ?, description = ?, image_url = ?, model = ?, model_data = ?, rules_data = ?, style_data = ?, state_data = ?, max_players = ?, xp_triggers = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      return await stmt.bind(
        finalName, finalDesc, finalImg, finalModel, finalModelData, finalRulesData, finalStyleData, finalStateData, finalMaxPlayers, finalXp, finalActive, sceneId
      ).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureScenesTable(db);
        return await this.updateScene(db, sceneId, { name, description, imageUrl, model, modelData, rulesData, styleData, stateData, maxPlayers, xpTriggers, isActive });
      }
      throw err;
    }
  },

  async setActiveScene(db, campaignId, sceneId) {
    try {
      await db.prepare('UPDATE scenes SET is_active = 0 WHERE campaign_id = ?').bind(campaignId).run();
      const stmt = db.prepare('UPDATE scenes SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND campaign_id = ?');
      return await stmt.bind(sceneId, campaignId).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureScenesTable(db);
        return await this.setActiveScene(db, campaignId, sceneId);
      }
      throw err;
    }
  },

  async updateSceneState(db, sceneId, stateData) {
    try {
      const stmt = db.prepare('UPDATE scenes SET state_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      return await stmt.bind(typeof stateData === 'string' ? stateData : JSON.stringify(stateData), sceneId).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureScenesTable(db);
        return null;
      }
      throw err;
    }
  },

  async deleteScene(db, sceneId) {
    try {
      const stmt = db.prepare('DELETE FROM scenes WHERE id = ?');
      return await stmt.bind(sceneId).run();
    } catch (err) {
      if (err.message && err.message.includes('no such table')) {
        await this.ensureScenesTable(db);
        return null;
      }
      throw err;
    }
  }
};



