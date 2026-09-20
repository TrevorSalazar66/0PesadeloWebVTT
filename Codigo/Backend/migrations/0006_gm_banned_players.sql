-- Migration 0006: Tabela de Jogadores Banidos por Mestre (gm_banned_players)
-- Permite que o Mestre da campanha bana um jogador infrator de todas as suas mesas (atuais e futuras).

CREATE TABLE IF NOT EXISTS gm_banned_players (
    gm_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (gm_id, player_id),
    FOREIGN KEY (gm_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gm_banned_gm ON gm_banned_players(gm_id);
CREATE INDEX IF NOT EXISTS idx_gm_banned_player ON gm_banned_players(player_id);
