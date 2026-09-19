-- ==============================================================================
-- SCHEMA OFICIAL DO CLOUDFLARE D1 (SQLITE) — RETROFORGE / ARCANA VTT
-- ==============================================================================

-- 1. Tabela de Usuários / Aventureiros (Com suporte a Google OAuth, Status de E-mail e Onboarding de Perfil)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT,
    salt TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT DEFAULT '',
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'jogador' CHECK (role IN ('jogador', 'mestre', 'admin', 'superadmin', 'Jogador', 'Mestre', 'Admin')),
    email_verified INTEGER NOT NULL DEFAULT 0,
    profile_completed INTEGER NOT NULL DEFAULT 0,
    is_blocked INTEGER NOT NULL DEFAULT 0,
    auth_provider TEXT NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'both')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);

-- 1.1 Tabela de Perfis Públicos e Sociais dos Aventureiros (Onboarding Obrigatório)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT UNIQUE NOT NULL COLLATE NOCASE,
    age_group TEXT NOT NULL,
    bio TEXT NOT NULL,
    contacts TEXT NOT NULL DEFAULT '{}',
    avatar_url TEXT NOT NULL DEFAULT '',
    banner_url TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Tabela de Verificação de E-mails com Códigos OTP de 6 Dígitos
CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    code_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Segurança de Dispositivos (Fingerprinting & Trava Permanente Anti-Sybil)
CREATE TABLE IF NOT EXISTS device_security (
    device_hash TEXT PRIMARY KEY,
    first_ip TEXT NOT NULL,
    last_ip TEXT NOT NULL,
    accounts_created_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPICIOUS', 'BLOCKED_PERMANENT')),
    reason TEXT DEFAULT '',
    blocked_at DATETIME,
    unblocked_by TEXT,
    unblocked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Sessões e Refresh Tokens
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Tabela de Campanhas / Mesas de RPG
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    simple_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    system_id TEXT NOT NULL DEFAULT 'custom',
    theme_id TEXT NOT NULL DEFAULT 'dark-fantasy',
    lore_description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    banner_url TEXT NOT NULL DEFAULT '',
    max_players INTEGER NOT NULL DEFAULT 5 CHECK (max_players >= 1 AND max_players <= 12),
    sessions INTEGER NOT NULL DEFAULT 0,
    next_session TEXT NOT NULL DEFAULT '',
    notices TEXT NOT NULL DEFAULT '',
    clock_data TEXT NOT NULL DEFAULT '{"ano":1,"mes":1,"dia":1,"hora":8,"minuto":0,"periodo":"Manhã"}',
    settings TEXT NOT NULL DEFAULT '{"auto_approve_actions":0,"clock_triggers":{"messages_threshold":0,"minutes_per_threshold":0}}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Tabela de Participantes da Campanha
CREATE TABLE IF NOT EXISTS campaign_players (
    campaign_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'jogador' CHECK (role IN ('jogador', 'assistente de mestre', 'mestre', 'Jogador', 'Mestre')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (campaign_id, user_id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Tabela de Fichas de Personagens
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    campaign_id TEXT,
    name TEXT NOT NULL,
    sheet_data TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Índices de Alta Performance para RLS e Auditoria
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON user_profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_device_status ON device_security(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_simple_id ON campaigns(simple_id);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);

-- 8. Tabela de Solicitacoes de Entrada em Campanhas
CREATE TABLE IF NOT EXISTS campaign_requests (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_requests_campaign ON campaign_requests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_requests_user ON campaign_requests(user_id);

-- 9. Tabela de Cenas da Campanha (com Gatilhos de XP)
CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    xp_triggers TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scenes_campaign ON scenes(campaign_id);

-- 10. Tabela de Auditoria Administrativa (Admin & Superadmin)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action);


