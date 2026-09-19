# Plano de Implementação: Aba de Configurações da Campanha & Governança de Jogadores

Este plano detalha a reformulação e implementação completa da **Aba de Configurações da Campanha** (`campanha.html`), permitindo que o Mestre controle todos os aspectos da mesa: gestão avançada de participantes (aceitar/negar solicitações, expulsar, promover a Assistente de Mestre e banir jogadores de todas as suas mesas), regras de automação de ações (descansos automáticos vs moderação manual), permissões de acesso a cenas ativas (livre vs sob aprovação), integração com Discord e preferências de áudio.

---

## 🎯 Requisitos Solicitados

1. **Gestão de Jogadores & Solicitações**:
   - **Aceitar ou Negar Solicitações**: Painel interativo para analisar e responder a pedidos de entrada pendentes.
   - **Banimento em Nível de Mestre**: O Mestre pode banir um jogador infrator; o banimento é aplicado a **todas as mesas atuais e futuras daquele Mestre**. O jogador banido é expulso de todas as campanhas do mestre e fica permanentemente impedido de se candidatar ou entrar em qualquer campanha criada por ele.
   - **Desbanir Jogador**: Lista de banidos pelo Mestre com opção de revogar o banimento.
   - **Remover / Expulsar da Mesa**: Remover o jogador apenas da campanha atual (liberando a vaga).
   - **Assistente de Mestre**: Promover ou rebaixar jogadores daquela mesa ao cargo de *Assistente de Mestre* (cargo exclusivo da campanha para moderar cenas e descansos).

2. **Regras da Campanha & Automação**:
   - **Aceite Automático de Ações (`auto_approve_actions`)**:
     - *Automático*: Jogadores descansam e recuperam Anima sem travas.
     - *Manual*: Descansos e curas geram solicitação pendente no chat para aprovação do Mestre / Assistente.
   - **Modo de Acesso a Cenas Ativas (`scene_access_mode`)**:
     - *Livre (`free`)*: Qualquer jogador pode entrar e visualizar qualquer cena ativa a qualquer momento.
     - *Sob Permissão (`approval_required`)*: Jogadores só podem entrar na cena após autorização/convocação do Mestre.
   - **Multiplicador de Ritmo de XP ($M$)**: Rápido ($0.75\times$), Normal ($1.0\times$), Gritty ($1.5\times$).

3. **Geral, Discord & Preferências**:
   - Edição de Nome, Lore, Sistema, Tema Narrativo, Visibilidade (Pública/Privada), Vagas (1 a 12) e Código de Convite.
   - **Integração Discord**: Link de canal de voz com botão "Entrar na Chamada" e URL opcional de Webhook para notificações.
   - **Preferências de Som**: Slider de volume para SFX de rolagem de dados e alertas visuais.
   - **Zona de Perigo**: Exclusão da campanha com dupla confirmação.

---

## 📐 Proposta de Alterações

### 1. Banco de Dados (D1 / SQLite)
#### [NEW] [0006_gm_banned_players.sql](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Banco/migrations/0006_gm_banned_players.sql)
- Criação da tabela `gm_banned_players`:
  ```sql
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
  ```
#### [MODIFY] [schema.sql](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Banco/schema.sql)
- Inclusão da tabela `gm_banned_players` e índices.

---

### 2. Backend Gateway (`queries.js` e `syncService.js`)
#### [MODIFY] [queries.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/db/queries.js)
- `banPlayerFromGM(db, gmId, playerId, reason)`: Registra na tabela `gm_banned_players`, remove o jogador de todas as mesas criadas pelo `gmId` e cancela todas as solicitações pendentes nas mesas dele.
- `unbanPlayerFromGM(db, gmId, playerId)`: Remove da tabela `gm_banned_players`.
- `listGMBannedPlayers(db, gmId)`: Retorna a lista de jogadores banidos pelo mestre com nome, email, data e motivo.
- `isPlayerBannedByGM(db, gmId, playerId)`: Verifica se o jogador está banido pelo mestre.
- `kickPlayerFromCampaign(db, campaignId, playerId)`: Remove o jogador da mesa e dissocia seus personagens da campanha.
- `updateCampaignPlayerRole(db, campaignId, playerId, role)`: Atualiza role para `'assistente de mestre'` ou `'jogador'`.

#### [MODIFY] [syncService.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/services/syncService.js)
- Trava de banimento em `campaigns.requests.create` e `campaigns.join`: Se `isPlayerBannedByGM` for verdadeiro, bloqueia com HTTP 403 e mensagem explicativa.
- Novos cases no Gateway `/api/sync`:
  - `campaigns.requests.list`: Lista solicitações pendentes da campanha.
  - `campaigns.requests.respond`: Aceita ou recusa solicitação (Mestre ou Assistente).
  - `campaigns.players.ban`: Mestre bane jogador de todas as suas mesas.
  - `campaigns.players.unban`: Mestre desbane jogador.
  - `campaigns.players.listBanned`: Mestre lista banidos.
  - `campaigns.players.kick`: Mestre/Assistente expulsa jogador da campanha.
  - `campaigns.players.setRole`: Mestre promove/rebaixa para Assistente de Mestre.
  - `campaigns.settings.update`: Atualiza `auto_approve_actions`, `scene_access_mode`, `xp_multiplier`, `discord_voice_url`, `discord_webhook_url`, `is_public`, `max_players`.

---

### 3. Frontend (`campanha.html` e `campanha.js`)
#### [MODIFY] [campanha.html](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/campanha.html)
- Reformulação da `<section id="view-config">`:
  - **Sub-aba ou seções em cards verticais**:
    1. **Identidade & Visibilidade da Mesa**: Nome, Sistema, Tema, Visibilidade, Vagas, Código de Convite.
    2. **Automação & Regras**: Toggle de *Aprovação Automática de Ações*, Select de *Acesso a Cenas Ativas* (Livre vs Com Permissão), Select de *Multiplicador de XP*.
    3. **Gestão de Aventureiros & Solicitações**:
       - Lista de solicitações pendentes com botões `[Aceitar]`, `[Negar]` e `[Banir de Todas as Mesas]`.
       - Lista de jogadores atuais com dropdown de cargo (*Jogador / Assistente de Mestre*), botão `[Expulsar]` e botão `[Banir]`.
       - Modal/Painel de Jogadores Banidos pelo Mestre com botão `[Desbanir]`.
    4. **Comunicação & Discord**: Link do canal de voz, Webhook e botão "Entrar na Chamada de Voz".
    5. **Preferências de Áudio / Interface**: Volume de SFX de dados (slider).
    6. **Zona de Perigo**: Botão de excluir campanha.

#### [MODIFY] [campanha.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/js/campanha.js)
- Implementação de todas as funções interativas de carregamento e salvamento de configurações, gerenciamento de solicitações, promoções, expulsões, banimentos e integração Discord.

---

## 🧪 Plano de Verificação

### Testes Automatizados
- Criar e executar suíte de testes em `Codigo/Backend/test/campaignSettings.test.js`:
  1. Testar bloqueio de entrada para jogador banido pelo mestre em todas as suas mesas.
  2. Testar banimento e desbanimento de jogador pelo mestre.
  3. Testar promoção e rebaixamento de Assistente de Mestre na mesa.
  4. Testar expulsão de jogador da mesa.
  5. Testar aceitação e recusa de solicitações de entrada.
  6. Testar atualização de configurações (`auto_approve_actions`, `scene_access_mode`, etc.).
  7. Testar proteção RBAC (apenas Mestre/Assistente podem alterar configurações e moderar jogadores).

### Deploy & Publicação
1. Executar migração `0006_gm_banned_players.sql` no Cloudflare D1 remoto.
2. Executar `wrangler deploy` no Backend e Frontend.
3. Git commit e push das alterações.
