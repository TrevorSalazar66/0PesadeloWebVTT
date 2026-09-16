-- ==============================================================================
-- SCHEMA OFICIAL DO CLOUDFLARE D1 (SQLITE) — RETROFORGE / ARCANA VTT
-- ==============================================================================

-- 1. Tabela de Usuários / Aventureiros (Com suporte a Google OAuth e Status de E-mail)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT,
    salt TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT DEFAULT '',
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Jogador' CHECK (role IN ('Jogador', 'Mestre', 'Admin')),
    email_verified INTEGER NOT NULL DEFAULT 0,
    auth_provider TEXT NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'both')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    system_id TEXT NOT NULL DEFAULT 'retroforge-core',
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Tabela de Participantes da Campanha
CREATE TABLE IF NOT EXISTS campaign_players (
    campaign_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Jogador' CHECK (role IN ('Jogador', 'Mestre')),
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
CREATE INDEX IF NOT EXISTS idx_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_device_status ON device_security(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
