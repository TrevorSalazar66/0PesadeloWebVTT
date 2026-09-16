-- Migração 0002: Google OAuth, Validação OTP de E-mail e Segurança de Dispositivos (Anti-Sybil)

-- 1. Criação das novas tabelas
CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    code_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_device_status ON device_security(status);
