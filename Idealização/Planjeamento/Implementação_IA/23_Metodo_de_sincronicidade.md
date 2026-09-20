# Sistema de Sincronização com Eleição de Líder e WebRTC P2P

Este documento detalha o plano técnico para alterar a forma como o VTT realiza o _polling_ e sincroniza o estado da mesa (chat, tokens, fichas), introduzindo uma arquitetura de **Eleição de Líder (Leader Election)** com comunicação **P2P via WebRTC** e fallback para polling individual.

## User Review Required

> [!IMPORTANT]
> **Limitações do Cloudflare Workers sem Durable Objects**
> O backend atual utiliza Cloudflare Workers padrão e D1. Workers padrão **não conseguem fazer broadcast** nativo de WebSockets entre diferentes clientes, pois rodam isolados na borda. 
> Para que os clientes descubram quem é o líder e troquem informações de conexão WebRTC (Signaling), precisaremos usar o banco de dados **D1** como "Signaling Server".
> O plano prevê _polling_ muito leve apenas para presença/signaling. Uma vez conectada a malha WebRTC, a comunicação síncrona ocorre direto entre os navegadores (Custo Zero).
> 
> **Aprova esta abordagem utilizando o D1 para o Signaling inicial do WebRTC?**

## Open Questions

> [!WARNING]
> 1. Para determinar o "menor ID", usaremos o `user_id` (UUID ou Integer). Prefere usar a **Ordem de Conexão** (quem entrou primeiro na sala vira líder) ou estritamente a ordem alfabética/numérica do `user_id`?
> 2. Se o WebRTC falhar (firewalls corporativos, etc.), o fallback proposto é que o cliente desconectado simplesmente volte a fazer o _polling_ normal a cada 3.5s, de forma autônoma. De acordo?

---

## Proposed Changes

O desenvolvimento será separado em 3 camadas principais: Backend (Sinalização e Presença), Frontend (Lógica de Eleição) e Frontend (Rede P2P WebRTC).

### 1. Banco de Dados & Backend (Sinalização)

Para permitir a descoberta do Líder e a conexão P2P.

#### [MODIFY] `Codigo/Backend/src/db/queries.js`
- Adicionar tabela e query para gerenciar `campaign_presence` (user_id, campaign_id, last_seen, is_leader).
- Adicionar tabela e query para `webrtc_signals` (sender_id, target_id, type, sdp/ice_candidate).

#### [MODIFY] `Codigo/Backend/src/services/syncService.js`
- Adicionar endpoint `sync.presence` para atualizar o "Heartbeat" (a cada 10s) e retornar a lista de jogadores ativos na mesa e determinar o Líder.
- Adicionar endpoint `sync.signal` para enviar e receber mensagens de oferta, resposta e ICE Candidates do WebRTC.

---

### 2. Frontend: Rede e WebRTC

#### [NEW] `Codigo/FrontEnd/js/sync_p2p.js`
- Criará a classe `P2PNetworkManager`.
- Gerenciará `RTCPeerConnection` para cada jogador na mesa usando topologia Estrela (Todos conectados ao Líder) ou Mesh (Todos conectados a todos). Para facilidade do VTT, **Topologia Estrela (Líder no Centro)** é a mais eficiente.
- Configuração de servidores STUN públicos e gratuitos do Google (`stun:stun.l.google.com:19302`) para atravessar roteadores domésticos.

---

### 3. Frontend: Eleição de Líder e Interceptador de APIs

#### [NEW] `Codigo/FrontEnd/js/sync_leader.js`
- Criará o `LeaderElectionManager`.
- Faz o _heartbeat_ a cada 10 segundos. Se o líder cair, o próximo assume imediatamente.
- Se for eleito Líder: Inicia o `setInterval` de 3.5s para `chat.getHistory` (e outros módulos) no servidor Cloudflare real.
- Se for Seguidor: **Desativa** os `setInterval` locais e aguarda os pacotes JSON chegarem pelo DataChannel do WebRTC.

#### [MODIFY] `Codigo/FrontEnd/js/campanha.js`
- Modificar o `iniciarChatPolling()` para verificar: `se (eu_sou_lider || fallback_ativo) { faz_polling(); } senao { aguarda_p2p(); }`
- Adicionar listeners para quando dados chegarem via P2P (ex: invocar `renderizarListaMensagensChat` com os dados P2P).

---

## Verification Plan

### Manual Verification
1. Entrar na campanha com 3 abas diferentes (simulando 3 usuários).
2. Verificar no painel de Network/Console que **apenas 1 aba** (o Líder) está fazendo as requisições constantes de `chat.getHistory`.
3. Enviar uma mensagem pelo Líder -> Verificar se as 2 abas recebem a mensagem quase instantaneamente via WebRTC DataChannel (latência de milissegundos).
4. Enviar mensagem de um Seguidor -> Verificar se vai pro servidor e o Líder distribui de volta.
5. Fechar a aba do Líder -> Verificar no log que a "Eleição de Líder" detectou a queda, elegeu a Aba 2 como Líder e retomou o polling sem interromper o chat.
