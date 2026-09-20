# 32. Consolidação Geral do Projeto & Guia Técnico de Implementação (Arcana VTT)

Este documento consolida toda a especificação técnica, arquitetura de rede, design de banco de dados, motor no-code de regras e os 6 modelos de cena planejados para o **Arcana VTT**, integrando os princípios de `23_Metodo_de_sincronicidade.md`, `24_Cenas_e_oficina.md`, `25_Refinamento_Oficina_Cenas_Compendio_Mundo.md` e os arquivos de detalhamento de `26` a `31`.

---

## 🏗️ 1. Filosofia de Arquitetura & Visão de Custo Zero

O Arcana VTT é projetado para operar com **desempenho máximo, baixíssima latência e custo operacional próximo a zero** (hospedado na infraestrutura Serverless do Cloudflare Workers + D1/SQLite).

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                   FRONTEND (Navegador do Usuário)                      │
   │ - Renderização Vetorial (SVG + CSS Dinâmico)                           │
   │ - WebRTC P2P (Malha de Comunicação Direta entre Jogadores / 60 FPS)   │
   │ - Lógica Leve de Interface e Animações                                 │
   └──────────────────────────────────┬─────────────────────────────────────┘
                                      │ Validação Autoritativa
                                      ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                    BACKEND (Cloudflare Workers / D1)                   │
   │ - Servidor de Sinalização P2P & Presença (Heartbeat a cada 10s)        │
   │ - Validador de Regras Críticas, Fichas & Recompensas                  │
   │ - Persistência SQLite Apenas do Estado Relevante                       │
   └────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 2. Método de Sincronicidade & Rede Híbrida (P2P WebRTC + Server Sync)

Para eliminar milhares de requisições contínuas (polling) ao servidor e garantir tempo de resposta de $0\text{ms}$ nas ações da mesa, o VTT adota o protocolo **P2P Híbrido com Eleição de Líder (Topologia Estrela)**.

### 2.1. Topologia Estrela com Eleição de Líder
1. **Líder da Mesa (Host WebRTC)**:
   - O primeiro usuário a entrar na sala ou o Mestre é eleito como o **Líder**.
   - Apenas o **Líder** executa o polling no servidor central Cloudflare para buscar atualizações globais da campanha.
   - O Líder redistribui os dados para os outros jogadores (**Seguidores**) através de `RTCDataChannel` WebRTC instantâneo.
2. **Seguidores (Followers)**:
   - Desativam requisições periódicas ao servidor e escutam pacotes JSON recebidos pelo canal de dados P2P.
3. **Servidores STUN Gratuitos**:
   - Conexões estabelecidas usando servidores STUN públicos do Google (`stun:stun.l.google.com:19302`) para travessia de roteadores e NATs.

```
                  ┌─────────────────────────────────┐
                  │    SERVIDOR CLOUDFLARE (D1)     │
                  └────────────────┬────────────────┘
                                   │ Polling Único (3.5s)
                                   ▼
                        ┌─────────────────────┐
                        │   LÍDER DA MESA     │
                        │ (WebRTC Host/Master)│
                        └──────┬───────┬──────┘
                               │       │ WebRTC DataChannel (0ms)
                        ┌──────┘       └──────┐
                        ▼                     ▼
             ┌────────────────────┐ ┌────────────────────┐
             │    SEGUIDOR A      │ │    SEGUIDOR B      │
             └────────────────────┘ └────────────────────┘
```

### 2.2. Sinalização Leve de Presença (`sync.presence` & `sync.signal`)
* **Loop de Presença (Heartbeat)**: Cada cliente faz ping no servidor a cada $10\text{s}$ para informar que está ativo. Se o Líder cair, o próximo cliente da lista assume automaticamente o papel de Líder.
* **Rede de Sinalização**: Caso o P2P de um cliente falhe devido a bloqueios estritos de rede/firewall, o sistema ativa um *Fallback Gracioso* para Polling individual no backend.

---

## 🏛️ 3. Oficina do Mestre: Arquitetura No-Code & Estrutura de Modais

A Oficina do Mestre é dividida em **3 Modais em Tela Cheia (Fullscreen Overlays)** organizados em gaveta lateral (*Split View*):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            OFICINA DO MESTRE                                │
│                                                                             │
│   ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐ │
│   │ 🎬 Gerenciamento de  │ │ 📚 Gerenciamento de  │ │ 🌍 Gerenciamento de│ │
│   │        Cenas         │ │      Compêndio       │ │       Mundo        │ │
│   └──────────┬───────────┘ └──────────┬───────────┘ └─────────┬──────────┘ │
└──────────────┴────────────────────────┴────────────────────────┴────────────┘
```

### 3.1. Regras de Negócio e Limites Rígidos

| Módulo | Limite Máximo | Objetivo de Performance |
| :--- | :--- | :--- |
| **Gerenciamento de Cenas** | **18 Cenas por Campanha** (ativas + inativas) | Forçar a reciclagem de cenas velhas, mantendo o banco SQLite leve. |
| **Gerenciamento de Compêndio** | **100 Homebrews por Tipo** (itens, NPCs, poderes) | Prevenir inchaço de dados; compartilhados na **Comunidade do Sistema**. |
| **Gerenciamento de Mundo** | **25 Mapas Globais por Campanha** | Manter mapas continentais e hexagonais organizados. |

---

### 3.2. Motor No-Code de Automações (`[QUANDO] ➔ [SE] ➔ [ENTÃO]`)

Toda a interatividade das cenas e do mapa é baseada em blocos visuais de reação:

$$\text{Regra: } \underbrace{\text{[QUANDO]}}_{\text{Evento Disparador}} \;\longrightarrow\; \underbrace{\text{[SE]}}_{\text{Filtro / Condição Opcional}} \;\longrightarrow\; \underbrace{\text{[ENTÃO]}}_{\text{Lista de Ações e Efeitos}}$$

#### A. Separação de IDs: `asset_id` vs `entity_id`
* **`asset_id` (Frontend)**: Utilizado estritamente para renderização visual em SVG vetorial e estilização CSS.
* **`entity_id` / `rule_id` (Backend)**: Identifica a entidade lógica e suas regras autoritativas no servidor SQLite. Isso impede trapaças via inspecionar do navegador.

#### B. Catálogo de Ações `[ENTÃO]` Suportadas:
* 🔄 `change_tile`: Altera o visual/entidade do tile (ex: baú fechado $\rightarrow$ aberto).
* 🗑️ `delete_tile`: Remove a colisão da Layer 2 (ex: abre porta ou destrói parede).
* 📦 `create_tile`: Faz um novo elemento/tile surgir no mapa (ex: portal ou bau caindo do teto).
* 🎒 `award_item` / `remove_item`: Altera o inventário da ficha do personagem.
* ✨ `award_xp`: Soma experiência na ficha.
* 💥 `apply_damage` / `heal_anima`: Altera o HP de Anima do personagem ativo.
* 🚪 `transfer_scene`: Teleporta o jogador para outra cena da campanha.
* 📜 `log_diary`: Registra entrada narrativa automática no Diário de Bordo.
* 💬 `show_toast`: Exibe mensagem flutuante na tela do jogador.

---

## 🎮 4. Guia Técnico dos 6 Modelos de Cena

### 4.1. Modelo 1: Grid Tático (Mapa de Exploração & Combate Posicional)
* **Síncrono (Multijogador)**: Posição de tokens atualizada em tempo real via WebRTC P2P.
* **Matriz 2D**: Até $500 \times 500$ células em SVGs vetoriais customizáveis por CSS.
* **Estrutura de 4 Camadas**:
  - `Layer 1 (Piso)`: Terreno pisável. Entidades passam por cima.
  - `Layer 2 (Obstáculos/Entidades)`: Sólido por padrão (paredes, portas, baús, tokens).
  - `Layer 3 (Cobertura/Teto)`: Telhados e copas de árvores. Entidades passam por baixo.
  - `Layer 4 (Névoa de Guerra)`: Função extra no topo. Revelada por **Linha de Visão Dinâmica (Raycasting)** bloqueada pelos obstáculos da Layer 2.
* **Regra Global de Não-Sobreposição**: Duas entidades no mesmo layer **nunca se sobrepõem**.
* **Elementos Globais Nativos**: Baú, Porta, Alavanca, Armadilha e Portal possuem comportamentos pré-programados sem necessidade de criar gatilhos do zero.

### 4.2. Modelo 2: Mahjong (Jogo da Memória + Campo Minado)
* **Assíncrono (Solo)**: Puzzle solo de dedução e memória. Tabuleiro fixo ou progressivo até $100 \times 100$.
* **Mecânica das Peças**:
  - Todas as peças iniciam visíveis; ao acertar o primeiro par, todas viram `?`.
  - Cada símbolo corresponde a um **número oculto** sorteado no acesso à cena.
  - O número do símbolo indica a quantidade de **bombas nas peças vizinhas (8 direções)**, exatamente como no Campo Minado.
  - Formar pares limpa as peças e dá $+1$ ponto. Clicar em bombas (Vermelhas com fundo Lilás) causa dano de Anima.
  - Limpar o tabuleiro inicia nova rodada acumulando pontos e HP.

### 4.3. Modelo 3: Senha (Cofres Rúnicos & Mastermind)
* **Assíncrono (Solo)**: Puzzles de 1 a 50 slots contendo Números, Letras ou Ícones/Runas.
* **Chave Fixa ou Aleatória**: Sequência definida manualmente pelo mestre ou sorteada no backend.
* **Sistema Triplo de Dicas Escalonado**:
  - *Dica 1*: Texto/enigma descritivo.
  - *Dica 2 (Multiplicação Global)*: Produto dos valores da esquerda para a direita (Bordas **Vermelhas** se resultado $>$ alvo, **Azuis** se $<$ alvo).
  - *Dica 3 (Posicional RGB por Slot)*: Slot individual fica 🔴 **Vermelho** (se $>$ alvo), 🟢 **Verde** (se exato) ou 🔵 **Azul** (se $<$ alvo).

### 4.4. Modelo 4: Conversa (Árvore de Diálogos & Visual Novel)
* **Assíncrono (Solo)**: Interface estilo Visual Novel construída por **Notas de Fala (Nós)**.
* **Recursos do Diálogo**:
  - Múltiplos interlocutores com avatares/banners via link externo (Google Drive Pattern).
  - Botões de resposta com condições (`[SE]` exige item, pratas, atributo ou reputação).
  - Chat rolável para rever falas anteriores.
  - **Auditoria Silenciosa**: Gravação automática do histórico de escolhas no Diário do Mestre.

### 4.5. Modelo 5: Combate por Turnos (Arena JRPG)
* **Síncrono (Multijogador)**: Arena de combate usando fichas reais e criaturas do Compêndio.
* **Recursos do Combate**:
  - Fila de iniciativa automática baseada nas regras do sistema da campanha.
  - **Economia de Pontos de Ação (PA / Energia)**: Gastos por turno para atacar, usar magias ou itens.
  - Resolução e sorteios de dano 100% autoritativos no backend.
  - Proporcionalidade de inimigos por jogador ativo e **Modo Sobrevivência por Ondas Infinitas**.

### 4.6. Modelo 6: Terminal (Hacking & Linha de Comando)
* **Assíncrono (Solo)**: Console retro fictício e seguro com cursor piscante e temas visuais (Matrix Verde, Rúnico).
* **Navegação por Histórico**: Setas `▲` e `▼` percorrem os comandos anteriores.
* **Lógica `If-Then` do Mestre**: Palavras-chave cadastradas disparam respostas de texto impressas no console e ações no-code.
* Controle manual de limite de erros e travamento pelo mestre.

---

## 🏛️ 5. Gerenciamento de Compêndio & Mundo

### 5.1. Compêndio (Herança Delta & Limites)
* **Arquitetura Delta (Semi-Dependente)**: Itens criados pelo mestre estendem um item base (`parent_id`) e salvam apenas as alterações (*delta*), reduzindo a carga do banco.
* **Limite**: 100 Homebrews por Tipo (itens, equipamentos, criaturas, poderes).
* **Integração com a Comunidade**: Elementos criados sobem para a **Aba Comunidade do Sistema**, com opção de chave On/Off de *Privacidade (Público vs Privado)*.
* **Assets de Tipo Base & Revelação de Variáveis**: Ícones vetoriais genéricos por tipo base (ex: SVG de Adaga, Espada, Poção) com modal de inspecionar interativo. Variáveis de propriedades possuem visibilidade individual (`is_visible`), podendo ser reveladas progressivamente por gatilhos.

### 5.2. Gerenciamento de Mundo
* **Diário Hierárquico**: Organização por pastas/notas para anotações do mestre, diário dos jogadores, roteiros e controle de visibilidade.
* **Calendário Procedural do Zero**: Mestre define regras de horas, dias, meses, estações e ciclo de luz/escuridão. Meses gerados dinamicamente com suporte a eventos/feriados. **O relógio narrativo só avança com ações explícitas na campanha**.
* **Overworld Hexagonal**: Até 25 Mapas Globais modulares em hexágonos vetoriais. Clicar no hexágono abre a nota de lore vinculada com **hiperlinks internos** para outras notas/compêndio.
* **Facções & Reputação**: Medidor de afinidade (-100 a +100) utilizável em gatilhos no-code.

---

## 💻 6. Estrutura dos Arquivos de Código

```
Codigo/
├── Backend/
│   └── src/
│       ├── db/
│       │   └── queries.js            # Consultas SQLite para Cenas, Fichas e Presença
│       └── services/
│           └── syncService.js        # Endpoints autoritativos (scenes, triggers, sync.presence)
└── FrontEnd/
    ├── campanha.html                 # Estrutura HTML da Oficina, Cenas e Modais Fullscreen
    └── js/
        ├── api/
        │   └── client.js             # Chamadas HTTP/WebSocket para o Backend
        ├── security/
        ├── sync_p2p.js               # Classe P2PNetworkManager (WebRTC DataChannel)
        ├── sync_leader.js            # LeaderElectionManager (Heartbeat & Eleição)
        └── campanha.js               # Renderizadores de Cenas, Oficina e Gatilhos
```

Este documento serve como o **guia mestre definitivo** para orientar o desenvolvimento e a implementação de todas as fases do Arcana VTT.
