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

  async updateCampaign(db, campaignId, { name, systemId, themeId, sessions, nextSession, loreDescription, notices }) {
    const stmt = db.prepare(`
      UPDATE campaigns 
      SET name = COALESCE(?, name),
          system_id = COALESCE(?, system_id),
          theme_id = COALESCE(?, theme_id),
          sessions = COALESCE(?, sessions),
          next_session = COALESCE(?, next_session),
          lore_description = COALESCE(?, lore_description),
          notices = COALESCE(?, notices)
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

  async createCampaignRequest(db, { id, campaignId, userId }) {
    const stmt = db.prepare(`
      INSERT INTO campaign_requests (id, campaign_id, user_id)
      VALUES (?, ?, ?)
    `);
    return await stmt.bind(id, campaignId, userId).run();
  },

  async getCampaignRequests(db, campaignId) {
    const stmt = db.prepare(`
      SELECT cr.*, u.display_name, u.email
      FROM campaign_requests cr
      JOIN users u ON cr.user_id = u.id
      WHERE cr.campaign_id = ? AND cr.status = 'pendente'
      ORDER BY cr.created_at ASC
    `);
    const res = await stmt.bind(campaignId).all();
    return res.results || res;
  },

  async updateCampaignRequestStatus(db, requestId, status) {
    const stmt = db.prepare(`
      UPDATE campaign_requests SET status = ?, updated_at = CURRENT_TIMESTAMP
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

  async getCharactersByCampaign(db, campaignId) {
    const stmt = db.prepare('SELECT * FROM characters WHERE campaign_id = ? ORDER BY name ASC');
    const res = await stmt.bind(campaignId).all();
    return res.results || res;
  },

  // ==========================================
  // CENAS DA CAMPANHA (COM GATILHOS DE XP)
  // ==========================================
  async createScene(db, { id, campaignId, name, description = '', imageUrl = '', xpTriggers = '[]', isActive = 0 }) {
    const stmt = db.prepare(`
      INSERT INTO scenes (id, campaign_id, name, description, image_url, xp_triggers, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return await stmt.bind(
      id,
      campaignId,
      name.trim(),
      description.trim(),
      imageUrl.trim(),
      typeof xpTriggers === 'string' ? xpTriggers : JSON.stringify(xpTriggers),
      isActive ? 1 : 0
    ).run();
  },

  async getScenesByCampaign(db, campaignId) {
    const stmt = db.prepare('SELECT * FROM scenes WHERE campaign_id = ? ORDER BY created_at ASC');
    const res = await stmt.bind(campaignId).all();
    return res.results || res;
  },

  async getSceneById(db, id) {
    const stmt = db.prepare('SELECT * FROM scenes WHERE id = ?');
    return await stmt.bind(id).first();
  },

  async updateScene(db, id, { name, description, imageUrl, xpTriggers, isActive }) {
    const stmt = db.prepare(`
      UPDATE scenes
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          image_url = COALESCE(?, image_url),
          xp_triggers = COALESCE(?, xp_triggers),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `);
    return await stmt.bind(
      name !== undefined ? name.trim() : null,
      description !== undefined ? description.trim() : null,
      imageUrl !== undefined ? imageUrl.trim() : null,
      xpTriggers !== undefined ? (typeof xpTriggers === 'string' ? xpTriggers : JSON.stringify(xpTriggers)) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      id
    ).run();
  },

  async deleteScene(db, id) {
    const stmt = db.prepare('DELETE FROM scenes WHERE id = ?');
    return await stmt.bind(id).run();
  }
};

