-- ==============================================================================
-- MIGRAÇÃO 0007: TABELA DE MENSAGENS DE CHAT DA CAMPANHA (campaign_messages)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS campaign_messages (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    character_id TEXT,
    author_name TEXT NOT NULL,
    author_avatar TEXT DEFAULT '',
    author_role TEXT DEFAULT 'jogador', -- 'mestre', 'assistente de mestre', 'jogador', 'npc', 'sistema'
    msg_type TEXT NOT NULL DEFAULT 'ic', -- 'ic', 'ooc', 'narracao', 'acao', 'roll', 'whisper', 'action_card'
    content TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}', -- dados de rolagem (dados, sucessos, veredicto), reply_to { id, author, text }, action_data { tipo, status, etc }
    whisper_target_id TEXT DEFAULT NULL, -- ID do usuário destinatário ou 'gm'
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_campaign ON campaign_messages(campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user ON campaign_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_whisper ON campaign_messages(whisper_target_id);
