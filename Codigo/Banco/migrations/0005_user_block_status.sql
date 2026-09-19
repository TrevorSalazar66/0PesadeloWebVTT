-- ==============================================================================
-- MIGRATION 0005: STATUS DE BLOQUEIO DE CONTAS DE USUÁRIOS NO CLOUDFLARE D1
-- ==============================================================================

ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);
