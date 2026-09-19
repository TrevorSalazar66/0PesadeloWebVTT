# Plano de Implementação: Aba de Chat da Campanha com Persistência, Formatações RPG e Comandos Avançados

## 1. Visão Geral e Diagnóstico do Estado Atual

Atualmente, a aba de chat em `campanha.html` possui apenas uma renderização local e volátil de mensagens (sem persistência no banco SQLite/Cloudflare D1). Quando a página é recarregada ou outro jogador entra na mesa, nenhuma mensagem anterior é carregada. Além disso:
1. **Persistência & Governança**: Não há tabela de mensagens, histórico com limites nem opção para o Mestre apagar mensagens ou limpar o chat.
2. **Formatação & Imersão RPG**: Falta distinção clara e elegante entre falas de personagem (In-Character / IC), conversas fora do personagem (Out-Of-Character / OOC), narrações solenes do Mestre, falas de NPCs, ações narrativas (`/me`), sussurros privados (`/w`) e cards interativos de aprovação de descanso/cura.
3. **Lógica de Testes e Comandos**: O parser de comandos não possui todas as opções planejadas (ex: sussurros `/w`, rolagens ocultas do mestre `/gmroll`, atalhos de atributos AlphaD6, emotes narrativos, resposta a mensagens anteriores).
4. **Estética Visual**: A interface do chat é muito simples e precisa de design Dark Fantasy nobre, avatares emoldurados, timestamps, barra rápida de "Falar como..." e ferramentas de rolagem ágil.

---

## 2. Mudanças Propostas

### 🔹 Banco de Dados (Cloudflare D1 / SQLite)

#### [NEW] [0007_campaign_messages.sql](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Banco/migrations/0007_campaign_messages.sql)
#### [MODIFY] [schema.sql](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Banco/schema.sql)
- Criação da tabela `campaign_messages` com os campos:
  - `id` (TEXT PRIMARY KEY)
  - `campaign_id` (TEXT NOT NULL, FK campaigns)
  - `user_id` (TEXT NOT NULL, FK users)
  - `character_id` (TEXT, FK characters, opcional)
  - `author_name` (TEXT NOT NULL)
  - `author_avatar` (TEXT DEFAULT '')
  - `author_role` (TEXT DEFAULT 'jogador') — `'mestre'`, `'assistente'`, `'jogador'`, `'npc'`, `'sistema'`
  - `msg_type` (TEXT NOT NULL) — `'ic'`, `'ooc'`, `'narracao'`, `'acao'`, `'roll'`, `'whisper'`, `'action_card'`
  - `content` (TEXT NOT NULL)
  - `metadata` (TEXT NOT NULL DEFAULT '{}') — JSON para dados de dados rolados (sucessos, veredito), alvos de whisper, citações/respostas (`reply_to`), e status de cards interativos (`aprovacao`)
  - `whisper_target_id` (TEXT DEFAULT NULL) — ID do usuário alvo ou `'gm'`
  - `is_deleted` (INTEGER NOT NULL DEFAULT 0)
  - `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)
- Índices otimizados: `idx_messages_campaign` (`campaign_id`, `created_at`) e `idx_messages_user` (`user_id`).

---

### 🔹 Backend & APIs

#### [MODIFY] [queries.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/db/queries.js)
- Adicionar métodos de banco:
  - `saveCampaignMessage(db, messageData)`
  - `getCampaignMessages(db, campaignId, { limit = 50, beforeTimestamp = null, userId = null, isGm = false })` com filtragem segura de whispers e mensagens excluídas.
  - `deleteCampaignMessage(db, messageId, campaignId)`
  - `clearAllCampaignMessages(db, campaignId)`
  - `getCampaignMessageById(db, messageId)`
  - `updateCampaignMessageMetadata(db, messageId, metadataObj)`

#### [MODIFY] [syncService.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/services/syncService.js)
- Implementar as seguintes ações no switch de sincronização:
  - `chat.getHistory`: Retorna o histórico paginado com limite seguro (50 por padrão, máx 100).
  - `chat.send`: Processa e persiste novas mensagens, tratando comandos (`/roll`, `/r`, `/w`, `/whisper`, `/me`, `/ooc`, `/gm`, `/nar`, `/npc`, `/descanso`, `/iniciativa`, `/gmroll`).
  - `chat.deleteMessage`: Valida se o solicitante é o autor da mensagem ou Mestre/Assistente da mesa e executa a exclusão.
  - `chat.clearHistory`: Ação exclusiva do Mestre para limpar todo o chat da mesa.
  - `chat.respondActionCard`: Permite ao Mestre ou Assistente aprovar ou rejeitar uma solicitação de descanso/cura gerada pelo jogador, aplicando os efeitos mecânicos e atualizando o card.

#### [MODIFY] [rpgEngineService.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/services/rpgEngineService.js)
- Aprimorar o interpretador de comandos para reconhecer:
  - `/gmroll` ou `/gr` (rolagens ocultas do mestre).
  - Comandos de atributo com especialização, vantagem e dificuldade integrados.
  - Detecção de sussurros (`/w [jogador] [texto]`) e narrações (`/gm [texto]`, `/me [texto]`).

---

### 🔹 Frontend & Interface do Usuário

#### [MODIFY] [campanha.html](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/campanha.html)
- **Design Nobre e Dark Fantasy para a Aba de Chat**:
  - Molduras heráldicas com estilo glassmorphism e iluminação em dourado/âmbar.
  - **Barra Superior do Chat**: Indicador da sessão, contagem de mensagens, botão do Mestre para limpar chat 🗑️, e botão retrátil de Dados Rápidos 🎲.
  - **Barra de Dados Rápidos (Dice Toolbar)**: Botões rápidos para rolar 1d6, 1d20, Corpo, Mente, Social, Espírito, Iniciativa e Descanso com 1 clique.
  - **Seletor "Falar Como" (Persona Selector)**: Dropdown elegante com miniatura de avatar permitindo alternar entre:
    - 🛡️ Meu Personagem Ativo (Falar IC)
    - 💬 Jogador (Fora do Jogo / OOC)
    - 👑 Narrador / Mestre (se for mestre)
    - 🎭 NPC Personalizado (se for mestre, abre mini-modal para escolher nome/avatar)
  - **Cards de Mensagem Estilizados**:
    - **In-Character (IC)**: Avatar do personagem, balão com destaque sutil, fala entre aspas iluminadas.
    - **Out-Of-Character (OOC)**: Tag `[OOC]`, fundo suave neutro, visual discreto.
    - **Mestre / Narrador**: Borda dourada ornamentada, tipografia solene Cinzel, fundo com gradiente sutil.
    - **Ações Narrativas (`/me`)**: Borda mística púrpura, texto em itálico iluminado.
    - **Sussurros (`/w`)**: Visual de sombras/violeta com ícone de cadeado 🔒 e aviso de sigilo.
    - **Rolagens de Dados**: Visual de dados D6 com contagem de sucessos ($\ge 4$), total, veredito e bônus.
    - **Card de Solicitação / Ação**: Botões `[Aceitar]` e `[Recusar]` interativos para o Mestre.
    - **Ações de Mensagem no Hover**: Responder (Quote) e Apagar (Lixeira).

#### [MODIFY] [campanha.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/js/campanha.js)
- Carregamento inicial do histórico persistente ao abrir a campanha.
- Polling inteligente e periódico para sincronização de novas mensagens em tempo real.
- Suporte completo a resposta de mensagens (`reply_to`), autocompletes inteligentes e atalhos de teclado.
- Modais e menus contextuais para NPCs e limpeza de mensagens.

---

## 3. Plano de Verificação

### Testes Automatizados
- Criar `Codigo/Backend/test/chatService.test.js` cobrindo:
  1. Envio de mensagem In-Character (IC), OOC, Narração e Emote `/me`.
  2. Execução e formatação de `/roll`, `/descanso`, `/iniciativa` e `/w` (whisper).
  3. Filtragem de whispers (garantir que jogadores alheios não recebam sussurros privados).
  4. Exclusão de mensagens individuais e validação de permissões (jogador comum vs mestre).
  5. Limpeza de histórico da campanha exclusiva para o Mestre.
  6. Aprovação de cards de ação (descanso) no chat.

### Verificação Manual e Deploy
- Execução da migração no Cloudflare D1 local e remoto.
- Validação no navegador via interface com testes de múltiplos tipos de fala, rolagens e moderação.
- Commit no Git e Deploy em produção (Workers e Pages).
