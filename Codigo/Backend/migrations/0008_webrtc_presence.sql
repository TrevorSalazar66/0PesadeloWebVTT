-- Tabela para presença e eleição de líder (WebRTC)
CREATE TABLE IF NOT EXISTS campaign_presence (
    campaign_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_leader INTEGER DEFAULT 0,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (campaign_id, user_id)
);

-- Tabela para sinalização (Signaling) WebRTC
CREATE TABLE IF NOT EXISTS webrtc_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'offer', 'answer', 'ice_candidate'
    payload TEXT NOT NULL, -- JSON com SDP ou ICE Candidate
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
