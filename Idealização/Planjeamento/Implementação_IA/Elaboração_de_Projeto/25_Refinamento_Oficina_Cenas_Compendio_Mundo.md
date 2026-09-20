# 25. Refinamento da Oficina do Mestre: Cenas, Compêndio e Mundo

Este documento organiza, refina e documenta o planejamento estrutural da **Oficina do Mestre**, cobrindo o gerenciamento de Cenas, Compêndio e Mundo.

---

## 🏛️ 1. Arquitetura Geral da Oficina do Mestre

A aba **Oficina do Mestre** atua como um *Hub Central de Criação*, composto por 3 grandes módulos de acesso direto:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            OFICINA DO MESTRE                                │
│                                                                             │
│   ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐ │
│   │ 🎬 Gerenciamento de  │ │ 📚 Gerenciamento de  │ │ 🌍 Gerenciamento de│ │
│   │        Cenas         │ │      Compêndio       │ │       Mundo        │ │
│   └──────────┬───────────┘ └──────────┬───────────┘ └─────────┬──────────┘ │
└──────────────┼────────────────────────┼────────────────────────┼────────────┘
               │                        │                        │
               ▼                        ▼                        ▼
     ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
     │  Modal Fullscreen │    │  Modal Fullscreen │    │  Modal Fullscreen │
     │  (Gavetas / Split)│    │  (Gavetas / Split)│    │  (Gavetas / Split)│
     └───────────────────┘    └───────────────────┘    └───────────────────┘
```

### 1.1. Diretrizes de Interface e Mídias (UI/UX)

* **Modais em Tela Cheia (Fullscreen Overlay)**: Cada módulo abre um modal que ocupa 100% da tela para maximizar o espaço útil de trabalho.
* **Menu de Gaveta Lateral (Split Drawer View)**: Utilizado mesmo em telas de computador por conta da alta densidade de informações e ferramentas.
* **Design Escuro e Dourado (Arcana Premium)**: Visual imersivo dark fantasy com destaques em bordas douradas para elementos selecionados.
* **Padronização de SVGs & Estilização por CSS**: Todos os ícones e elementos gráficos de UI são estritamente vetoriais (SVG), customizáveis por regras CSS.
* **Hospedagem Externa de Imagens Pesadas (Google Drive Pattern)**: Para ilustrações complexas (artes de fundo, retratos detalhados de NPCs), o mestre insere links de referência externos (ex: imagens hospedadas no Google Drive com permissão pública de leitura), zerando o custo de armazenamento do servidor e garantindo alta qualidade.

---

## 🎬 2. Módulo: Gerenciamento de Cenas

### 2.1. Regra de Negócio e Limite de Cenas

* **Limite Máximo Rígido**: **18 Cenas por Campanha** (soma de cenas ativas e inativas).
* **Objetivo**: Forçar o mestre a reciclar ou excluir cenas antigas que já foram concluídas, garantindo alta performance no banco de dados SQLite/Cloudflare D1 e carregamento rápido para os jogadores.
* **Indicador de Capacidade**: Exibição de um contador no topo da gaveta de cenas (ex: `12 / 18 Cenas Utilizadas`).

---

### 2.2. Gaveta Esquerda: Lista de Cenas Criadas

A gaveta lateral exibe todas as cenas da campanha organizadas em **cards compactos** (uma versão minimizada e otimizada dos cards de campanha da home):

#### Anatomia do Card de Cena Compacto

1. **Identificação**: Ícone descritivo do modelo + Nome da Cena.
2. **Moldura Dourada de Seleção**: A cena atualmente aberta para edição na área principal é destacada com uma moldura dourada vibrante.
3. **Chave On/Off de Visibilidade (Ativa)**:
   * **ON (Ativa/Visível)**: Torna a cena acessível para os jogadores no palco.
   * **OFF (Oculta/Rascunho)**: Mantém a cena em preparação na Oficina sem visibilidade para os jogadores.
4. **Ações Rápidas**:
   * **Editar**: Carrega a cena no painel principal do modal.
   * **Excluir**: Remove a cena da campanha com modal de confirmação (liberando slot no limite de 18).

---

### 2.3. Área Principal Direita: Editor e Construtor de Cena

#### Estado A: Nenhuma Cena Selecionada / Fluxo de Criação

* Exibe uma tela limpa de boas-vindas com um botão central de destaque: **"+ Criar Nova Cena"**.
* **Ao Clicar no Botão**:
  1. Abre formulário modal rápido solicitando:
     * **Nome da Cena**.
     * **Modelo da Cena** (Grid Tático, Mahjong, Senha, Conversa, Combate por Turnos, Terminal).
  2. Ao confirmar, a nova cena é instantaneamente registrada no backend, adicionada na gaveta da esquerda com a moldura dourada e aberta no editor.

#### Estado B: Cena Carregada no Editor (Estrutura de Sub-abas)

Quando uma cena está selecionada, a área principal disponibiliza 3 sub-abas superiores:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [📋 1. Geral]        [🎨 2. Visualizar / Editor]        [⚡ 3. Gatilhos]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 1. Sub-aba "Geral" (Configurações & Documentação do Modelo)

* **Dados Básicos**: Nome da Cena, Descrição Narrativa e Limite Máximo de Jogadores Simultâneos.
* **Manual de Regras do Modelo**: Um painel educativo e dinâmico que explica:
  * Como aquele modelo específico funciona no jogo.
  * Como o mestre deve configurá-lo.
  * Dicas de uso narrativo e mecânico.

#### 2. Sub-aba "Visualizar / Editor" (Ambiente de Construção e Testes)

Possui um **Seletor de Modo no Topo**:

* **Modo Editor**: Permite ao mestre montar visualmente a cena (pintar o grid com 3 camadas, posicionar slots de senha, montar nós de diálogo, etc.).
* **Modo Visualizador**: Permite ao mestre simular e testar a cena em tempo real exatamente como o jogador irá vivenciá-la, testando interações, mecânicas e colisões antes de disponibilizar para a mesa.

#### 3. Sub-aba "Gatilhos & Automação" (Motor No-Code de Automações)

Esta sub-aba implementa o **Construtor Visual por Blocos de Reação**. Cada regra no-code é estruturada em 3 partes encadeadas:

$$\text{Regra \#N: } \underbrace{\text{[QUANDO]}}_{\text{Gatilho / Evento}} \;\longrightarrow\; \underbrace{\text{[SE]}}_{\text{Condição (Opcional)}} \;\longrightarrow\; \underbrace{\text{[ENTÃO]}}_{\text{Lista de Ações e Efeitos}}$$

##### A. Interface do Construtor Visual (UI/UX no Frontend)

1. **Bloco `[QUANDO]` (Evento Disparador)**:
   * Menu suspenso categorizado com ícones:
     * *No Grid*: `Ao Clicar no Tile` | `Ao Pisar no Tile`
     * *Na Senha*: `Ao Acertar Combinação` | `Ao Errar Combinação`
     * *No Mahjong*: `Ao Formar Par` | `Ao Clicar na Bomba` | `Ao Atingir Pontuação`
     * *Na Conversa*: `Ao Escolher a Resposta X`
     * *No Terminal*: `Ao Enviar o Comando X`
     * *Geral*: `Ao Zerar Anima / HP`
   * **Seletor Visual de Alvo (`🎯 Capturar Alvo`)**: Botão que permite ao mestre clicar diretamente na célula $(X, Y)$ do mapa no editor para preencher o alvo sem precisar digitar coordenadas.

2. **Bloco `[SE]` (Condições e Validações Opcionais)**:
   * Permite criar filtros antes de liberar os efeitos:
     * `Possui o Item X na Ficha` (ex: Chave de Bronze)
     * `Atributo / Estatística >= N` (ex: Vigor >= 3 ou XP >= 100)
     * `Sem Condição` (dispara sempre).

3. **Bloco `[ENTÃO]` (Ações Encadeadas)**:
   * O mestre pode adicionar **uma ou mais ações consecutivas** para uma única regra:
     * 🔄 `Mudar Tile Visual`: altera a imagem/entidade do tile (ex: baú fechado $\rightarrow$ baú aberto).
     * 🗑️ `Remover Tile`: limpa o obstáculo da camada 2 (ex: remove a porta/parede).
     * 📦 `Criar Tile`: faz um novo elemento surgir no mapa.
     * 🎒 `Conceder / Remover Item`: adiciona item do compêndio diretamente ao inventário do personagem.
     * ✨ `Conceder XP`: adiciona experiência na ficha.
     * 💥 `Causar / Curar Anima`: altera a saúde/HP do personagem ativo.
     * 🚪 `Teleportar para Cena`: transporta o jogador para outra cena da campanha (`transfer_scene`).
     * 📜 `Escrever no Diário`: grava entrada narrativa automática no histórico da mesa.
     * 💬 `Exibir Mensagem / Toast`: exibe alerta flutuante na tela do jogador.

---

### 2.4. Arquitetura Técnica em Nível de Código (Backend & Data Schema)

#### 1. Estrutura do JSON Armazenado no Banco (`scenes.rules_data`)

```json
[
  {
    "rule_id": "rule_01h8x9",
    "name": "Destrancar Baú Ancestral",
    "trigger": {
      "type": "on_tile_click",
      "target": { "x": 5, "y": 8, "layer": 2, "entity_id": "chest_closed_01" }
    },
    "conditions": [
      { "type": "has_item", "item_id": "key_bronze", "qty": 1 }
    ],
    "effects": [
      {
        "type": "change_tile",
        "params": { "layer": 2, "x": 5, "y": 8, "new_entity_id": "chest_open_01", "new_asset_id": "asset_chest_open_svg" }
      },
      {
        "type": "award_item",
        "params": { "item_id": "ancient_amulet", "qty": 1 }
      },
      {
        "type": "award_xp",
        "params": { "amount": 25 }
      },
      {
        "type": "log_diary",
        "params": { "text": "abriu o Baú Ancestral na Cripta e encontrou o Amuleto Antigo (+25 XP)." }
      }
    ],
    "fallback_effects": [
      {
        "type": "show_toast",
        "params": { "message": "O baú está trancado. Você precisa de uma Chave de Bronze!", "color": "warning" }
      }
    ]
  }
]
```

#### 2. Fluxo Autoritativo de Execução no Backend (`syncService.js`)

1. **Envio da Requisição pelo Cliente**:
   Quando o jogador clica em um tile ou aciona um evento, o frontend dispara uma requisição semântica:
   `apiClient.sync('campaigns.scenes.triggerAction', { sceneId, characterId, triggerType, triggerParams })`.

2. **Processamento Autoritativo no Servidor**:
   * O backend carrega a cena do banco de dados SQLite e parseia o array `rules_data`.
   * Encontra as regras correspondentes ao `triggerType` e alvo.
   * **Valida as Condições na Ficha Real**: Busca a ficha do personagem no banco SQLite e verifica se os itens ou atributos realmente satisfazem as condições do bloco `[SE]`. Isso garante **100% de segurança contra trapaça no client**.
   * **Execução das Ações**:
     * Se as condições forem atendidas: executa a lista `effects` em uma transação do banco (atualiza a matriz da cena, o inventário da ficha e grava no diário).
     * Se as condições falharem: executa a lista `fallback_effects` (ex: alerta de porta trancada).

3. **Sincronização & Broadcast**:
   * O backend responde com os novos dados autoritativos da ficha e da cena.
   * Em cenas síncronas (Grid), o frontend envia um broadcast WebRTC P2P (`scene_state_update`) para atualizar o mapa dos outros jogadores em tempo real.

---

## 📚 3. Módulo: Gerenciamento de Compêndio (Homebrew & Herança)

### 3.1. Arquitetura de Herança / Delta ("Semi-Dependente")

Para eliminar duplicatas de dados e economizar armazenamento no banco de dados, a criação de elementos pelo mestre é **semi-dependente** (baseada em extensão do item original):

* **Registro Base (Parent)**: Aponta para o item/criatura oficial do sistema via `parent_id`.
* **Registro Delta (Modificações do Mestre)**: Armazena estritamente as propriedades alteradas pelo mestre (ex: novo nome, alteração no valor em pratas, novo efeito ou imagem customizada).
* **Vantagem Técnica**: O backend mescla o objeto pai com as alterações do mestre no momento de entregar o dado (`finalObject = { ...parentData, ...masterDelta }`), reduzindo drasticamente a carga do banco.

---

### 3.2. Regra de Limites e Escopo Global / Comunidade

* **Limite por Tipo**: Limite rígido de **100 elementos Homebrew por Tipo** (até 100 Itens, 100 Equipamentos, 100 Criaturas/NPCs, 100 Poderes, 100 Pistas).
* **Integração com a Aba Comunidade do Sistema**:
  * Os elementos Homebrew criados pelo mestre não ficam limitados a uma única campanha. Eles são vinculados à conta do mestre e disponibilizados na **Aba Comunidade do Sistema**, podendo ser reaproveitados em qualquer outra campanha dele ou da comunidade.
* **Chave On/Off de Privacidade**:
  * **Público (Comunidade)**: Visível na aba Comunidade do sistema para todos os usuários.
  * **Privado (Oculto)**: Visível exclusivamente para o mestre criador, Admin e SuperAdmin (invisível para jogadores ou outros mestres).

---

### 3.3. Padronização de Assets de Tipo & Modal de Inspecionar Interativo

* **Assets Fixos por Tipo Base**:
  * Para economizar armazenamento e manter a consistência gráfica, os elementos usam ícones vetoriais por **Tipo de Elemento Base** (ex: SVG fixo para *Poção Pequena*, *Poção Grande*, *Adaga*, *Espada*, *Machado*, *Escudo*, *Anel*, etc.), e não um SVG exclusivo para cada variação de item.
* **Modal de Detalhes / Inspecionar**:
  * Ao clicar em um asset no mapa ou inventário, abre-se um modal interativo exibindo todas as especificações do elemento (Nome, Tipo, Efeito, Modo de Uso, Peso, Custo em Pratas, Categoria, etc.).
* **Controle Granular de Visibilidade de Variáveis**:
  * Cada propriedade do elemento possui uma variável de visibilidade isolada (`is_visible: boolean`).
  * O mestre pode configurar quais variáveis aparecem para o jogador de início (ex: o jogador vê o nome "Adaga Antiga", mas as variáveis de *efeito mágico* e *valor exato* iniciam ocultas).
* **Gatilhos de Revelação Progressiva**:
  * O mestre pode criar regras no-code para revelar variáveis separadamente (ex: ao passar num teste de Conhecimento ou usar uma lupa, um gatilho altera `is_visible: true` daquela variável específica).

---

## 🌍 4. Módulo: Gerenciamento de Mundo (Cronologia, Overworld & Lore)

O módulo de **Gerenciamento de Mundo** centraliza o controle temporal, a geografia global em hexágonos, a enciclopédia da campanha e as facções.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GERENCIAMENTO DE MUNDO                                │
│                                                                             │
│ [📜 Diário]  [⏳ Relógio/Calendário]  [🗺️ Overworld Hex]  [🏛️ Facções]  [⚙️ Leis] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.1. 📜 Diário & Crônicas da Mesa (Bloco de Notas Categorizado)

* **Sistema Hierárquico de Notas**: Organização por categorias e subcategorias no formato de árvore de pastas/notas.
* **Sub-abas Especializadas**:
  1. *Anotações do Mestre*: Notas de bastidores, segredos e rascunhos (privadas).
  2. *Diário dos Jogadores*: Visualização e moderação das anotações feitas pela equipe de heróis.
  3. *Gestão de Visibilidade*: Controle individual da chave On/Off de visibilidade de cada nota para os jogadores.
  4. *Criação de Roteiros*: Planejamento encadeado de arcos narrativos e encontros futuros.

---

### 4.2. ⏳ Relógio do Mundo & Calendário Procedural

* **Criação de Calendários Personalizados do Zero**:
  * O mestre define as regras fundamentais do universo:
    * Dias e semanas por mês.
    * Número de meses por ano.
    * Horas de um dia e proporção de Luz / Escuridão (ciclo Sol/Lua).
    * Estações do ano e sua duração em meses.
* **Geração Procedural de Meses**:
  * Com as regras base definidas, o mestre gera os meses do ano dinamicamente via botão **"+ Adicionar Mês"**.
* **Eventos & Feriados**:
  * Cadastro de eventos fixos ou recorrentes no calendário (feriados, eclipses, solstícios).
* **Relógio Narrativo & Gatilhos Temporais**:
  * O tempo do calendário avança com ações no jogo ou intervenção do mestre, podendo disparar gatilhos no-code (ex: ao chegar no dia do Eclipse, alterar iluminação das cenas ou regenerar Anima). Porém nunca avança indefinidamente, sempre sendo necessário uma ação na campanha para que o relogio avance.
* **Linha do Tempo (Cronologia)**:
  * Painel para o mestre registrar a história do **Passado** (lore antiga) e o planejamento do **Futuro** da campanha.

---

### 4.3. 🗺️ Mapa Global / Overworld (Grids Hexagonais & Enciclopédia de Lore)

* **Atlas do Mundo (Pastas & Notas)**:
  * Criação de descrições ricas sobre continentes, reinos, cidades, fauna, flora e eventos históricos.
* **Hiperlinks Internos / Interconectividade**:
  * Mecânica de inserir botões dentro de uma nota que abrem diretamente **outras notas específicas** ou exibem **cards do Compêndio**.
* **Mapas Modulares Hexagonais (Overworld Hex Grid)**:
  * Matriz visual baseada em **Hexágonos** (com assets de terreno vetorial SVG).
  * Cada hexágono pode estar vazio ou conter um asset vinculado (ex: montanha, vila, ruínas).
  * Ao clicar no hexágono, o jogador abre a **Nota de Lore** vinculada a ele.
* **Névoa de Guerra & Visibilidade On/Off**:
  * Chave On/Off global para o mapa e individual para cada hexágono/nota. Os jogadores só enxergam a nota do hexágono se o mestre liberar.
* **Limite Máximo Rígido**: **25 Mapas Globais por Campanha**.

---

### 4.4. 🏛️ Facções, Reputação & Influência

* **Cadastro de Organizações**: Registro detalhado de reinos, ordens de cavalaria, guildas e cultos.
* **Barra de Reputação Manual**: Medidor de relacionamento dos jogadores com cada facção (-100 Hostil $\rightarrow$ 0 Neutro $\rightarrow$ +100 Aliado).
* **Uso em Gatilhos**: Variável acessível no construtor no-code `[SE reputacao_guilda >= 50]`.

---

### 4.5. ⚙️ Parâmetros Globais & Leis da Campanha

* **Regras Globais do AlphaD6**: Multiplicadores de dano, velocidade de recuperação de Anima, mecânica de derrota/morte.
* **Visibilidade Padrão de Fichas**: Permissões de inspeção mútua entre jogadores.

---

## 🎯 5. Resumo Consolidado do Sistema de Oficina e Cenas (Arcana VTT)

1. **Hub Central de Criação (3 Modais Fullscreen)**:
   * Gerenciamento de Cenas (até 18 cenas, 6 modelos, cards compactos com moldura dourada e chave On/Off).
   * Gerenciamento de Compêndio (até 100 homebrews por tipo, herança Delta semi-dependente, integração com a Comunidade, assets fixos por tipo base, modal de inspecionar com revelação de variáveis por gatilho).
   * Gerenciamento de Mundo (até 25 mapas hexagonais com notas hiperlinkadas, diário categorizado, calendário procedural customizável do zero e facções com reputação).
2. **Sistema de Gatilhos Universal No-Code (`[QUANDO] ➔ [SE] ➔ [ENTÃO]`)**:
   * A "cola" que amarra cenas, fichas, tempo, mapa global e diário com validação autoritativa no backend SQLite e sincronização P2P WebRTC.
3. **Gestão Limpa de Recursos**:
   * SVGs vetoriais customizáveis via CSS para UI e assets de grid.
   * Google Drive Integration Pattern para imagens e mídias pesadas via link externo.
