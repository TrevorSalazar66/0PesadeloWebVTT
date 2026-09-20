# Plano de Implementação: Sistema de Cenas Interativas e Oficina do Mestre

Este documento detalha o plano técnico para implementar o **Sistema Modular de Cenas** e a **Oficina de Criação do Mestre** no Arcana VTT, com base nas definições de design e regras estabelecidas.

---

## 1. Visão Geral da Arquitetura

O sistema de cenas é estruturado como um **motor modular de gameplay e exploração**, permitindo múltiplos modelos de cenas (síncronas e assíncronas), com suporte a camadas (layers), assets vetoriais customizáveis por CSS e um **sistema no-code de regras e gatilhos (Triggers & Actions)** validado de forma autoritativa pelo backend.

```
                  ┌──────────────────────────────────────────────────┐
                  │                 OFICINA DO MESTRE                │
                  │   - Gerenciador de Cenas & Compêndio             │
                  │   - Ferramenta de Pintura de Grid (3 Camadas)    │
                  │   - Configurador de Puzzles (Senha, Mahjong...)  │
                  │   - Editor No-Code de Gatilhos [QUANDO -> ENTÃO] │
                  └─────────────────────────┬────────────────────────┘
                                            │ Salva Configurações & Regras
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │            BACKEND (/api/sync & SQLite)          │
                  │   - Validação de Regras e Efeitos Autoritative   │
                  │   - Persistência de Estado e Cenas               │
                  │   - Registro de Conquistas no Diário da Mesa     │
                  └─────────────────────────┬────────────────────────┘
                                            │ Sincronização
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │                 TELA DE CENAS                    │
                  │   - Modelo 1: Grid Tático (Síncrono / WASD / P2P)│
                  │   - Modelo 2: Mahjong / Memória (Assíncrono)     │
                  │   - Modelo 3: Senha / Cofre (Assíncrono)         │
                  │   - Modelo 4: Árvore de Diálogos (Assíncrono)    │
                  │   - Modelo 5: Combate RPG por Turnos             │
                  └──────────────────────────────────────────────────┘
```

---

## 2. Modelos de Cenas Planejados

### 🔹 Modelo 1: Grid (Mapa Tático / Exploração)
- **Natureza**: Síncrona (multijogador em tempo real com broadcast P2P e fallback de polling).
- **Dimensões**: Matriz 2D configurável até $500 \times 500$ células.
- **Sistema de 3 Camadas (Layers)**:
  - `Layer 1 (Chão)`: Terreno pisável (chão de pedra, grama, piso de madeira).
  - `Layer 2 (Obstáculo / Colisão)`: Paredes, portas fechadas, árvores, estantes (bloqueia movimentação e colide com tokens).
  - `Layer 3 (Teto / Cobertura)`: Telhados, copas de árvores (jogadores passam por baixo).
- **Estética & Assets**:
  - Fundo escuro com demarcação de bordas (preto, dourado, etc.).
  - Ícones vetoriais SVG transparentes com cores e dimensões customizáveis no CSS da cena.
- **Movimentação**:
  - Teclas `WASD` / Setas do teclado no PC.
  - Gamepad virtual / Analógico e toque em células no Mobile.

### 🔹 Modelo 2: Mahjong (Campo Minado & Jogo da Memória)
- **Natureza**: Assíncrona (1 jogador ativo por sessão).
- **Mecânica**:
  - Tabuleiro inicia visível; ao formar o primeiro par, todas as peças viram `?`.
  - Associação de figuras a números ocultos gerados por sessão.
  - **Bombas**: Peças vermelhas com fundo lilás que causam dano à Anima do personagem ao serem ativadas.
  - **Pares e Rodadas**: Ao formar par, as peças somem e o jogador ganha pontos. Ao limpar o tabuleiro sem bombas, inicia nova rodada acumulando pontos e mantendo a vida.
  - Saída/Derrota: Gatilhos de recompensa configuráveis e log automático no Diário.

### 🔹 Modelo 3: Senha (Puzzle / Cofre / Mastermind)
- **Natureza**: Assíncrona (1 jogador ativo por sessão).
- **Mecânica**:
  - $N$ slots configuráveis com números (intervalo), letras ou ícones.
  - Combinação fixa ou aleatória por acesso.
  - Tentativas erradas causam dano configurável.
  - **Sistema de Dicas Escalonado**:
    - Dica textual livre.
    - Multiplicação matemática geral (bordas vermelhas se acima do valor, azuis se abaixo).
    - Dica por slot (Vermelho = acima, Verde = exato, Azul = abaixo).
  - Acerto: Gatilho de efeito (item no inventário, XP, destrancar passagem/teleporte).

### 🔹 Modelo 4: Conversa (Árvore de Diálogos / Visual Novel)
- **Natureza**: Assíncrona (1 jogador ativo).
- **Mecânica**: Falas de NPCs com avatares, opções de resposta com ramificações e execução de gatilhos.

### 🔹 Modelo 5: Combate por Turnos
- **Natureza**: Combate clássico estilo Pokémon / Final Fantasy com base nos dados do Compêndio e Ficha.

---

## 3. Motor No-Code de Gatilhos & Efeitos

Estrutura modular `[QUANDO -> ENTÃO]`:

| Gatilho (`QUANDO`) | Parâmetros | Efeito (`ENTÃO`) | Ação Executada |
| :--- | :--- | :--- | :--- |
| `on_tile_click` | Coordenadas $(X, Y)$ | `delete_tile` / `change_tile` | Abre porta / destrói parede |
| `on_tile_enter` | Coordenadas $(X, Y)$ | `apply_damage` / `heal_anima` | Armadilha ou fonte de cura |
| `on_password_correct` | ID da cena | `award_item` / `award_xp` | Adiciona item/XP na ficha |
| `on_password_fail` | Quantidade de erros | `show_hint` / `apply_damage` | Revela dica ou pune com dano |
| `on_score_reach` | Pontuação mínima | `transfer_scene` | Teleporta jogador para nova cena |
| `on_hp_zero` | - | `defeat_event` | Encerra cena e aplica consequência |

---

## 4. Alterações Propostas

### 4.1. Backend (`Codigo/Backend/`)

#### [MODIFY] [queries.js](file:///c:/Users/Jo%C3%A3o/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/db/queries.js)
- Adicionar `ensureScenesTable(db)` garantindo suporte aos campos:
  - `model` (`grid`, `mahjong`, `password`, `dialogue`, `combat`)
  - `model_data` (JSON: matrizes de layers, dimensões, slots, etc.)
  - `rules_data` (JSON: array de gatilhos e efeitos `[QUANDO -> ENTÃO]`)
  - `style_data` (JSON: cores de grid, temas e estilos de assets)
  - `state_data` (JSON: estado persistido síncrono da cena)
  - `max_players` (INTEGER)
  - `is_active` (INTEGER)
- Métodos auxiliares de banco para listar, criar, atualizar, deletar e ativar cenas.

#### [MODIFY] [syncService.js](file:///c:/Users/Jo%C3%A3o/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/services/syncService.js)
- Handlers para os comandos de cenas:
  - `campaigns.scenes.list`: Retorna cenas da campanha.
  - `campaigns.scenes.get`: Retorna detalhes completos de uma cena.
  - `campaigns.scenes.create`: Criação com validação de permissão de Mestre.
  - `campaigns.scenes.update`: Atualização do mapa, regras e modelos.
  - `campaigns.scenes.delete`: Exclusão da cena.
  - `campaigns.scenes.setActive`: Define cena ativa global e dispara notificação P2P.
  - `campaigns.scenes.triggerAction`: Executa gatilho no backend, aplica efeitos na ficha/mapa e grava log no diário.
  - `campaigns.scenes.updateState`: Sincroniza estado de tokens/tiles no grid.

---

### 4.2. Frontend (`Codigo/FrontEnd/`)

#### [MODIFY] [client.js](file:///c:/Users/Jo%C3%A3o/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/js/api/client.js)
- Métodos semânticos para `listScenes`, `getScene`, `createScene`, `updateScene`, `deleteScene`, `setActiveScene`, `triggerSceneAction`, `updateSceneState`.

#### [MODIFY] [campanha.html](file:///c:/Users/Jo%C3%A3o/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/campanha.html)
- Estruturação completa da aba **Oficina** (`#view-oficina`):
  - Barra lateral com lista de cenas e botão "+ Nova Cena".
  - Painel de edição da cena com abas internas:
    1. *Configurações*: Nome, descrição, modelo, limites, estilo.
    2. *Pintura de Grid (Paint Tool)*: Canvas de edição, seletor de camadas (1, 2, 3), paleta de assets SVG, pincel, borracha, preenchimento.
    3. *Configurador de Puzzles*: Editor de Senhas, Mahjong e Diálogos.
    4. *Gatilhos No-Code*: Interface visual para compor blocos `[QUANDO -> ENTÃO]`.
    5. *Botão de Ativação*: "Tornar Cena Ativa da Mesa".
- Estruturação completa da aba **Cenas** (`#view-cenas`):
  - Container de renderização dinâmico adaptável aos 5 modelos.
  - Gamepad virtual e controles touch para mobile.
  - Painel de status da cena e botão de retorno para cenas assíncronas.

#### [MODIFY] [campanha.js](file:///c:/Users/Jo%C3%A3o/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/js/campanha.js)
- Motor de renderização de Grid (Canvas 2D / Tiles) com colisões na Layer 2, movimentação por `WASD`, gamepad virtual e sincronização P2P.
- Motores interativos para os minijogos (Mahjong, Senha e Diálogos).
- Lógica de interação da Oficina do Mestre (ferramenta de pintura de tiles e montagem de gatilhos).

---

## 5. Plano de Verificação

### Testes Manuais & Funcionais
1. **Criação e Pintura de Cena (Oficina)**:
   - Criar uma cena do tipo `Grid` de $20 \times 20$.
   - Pintar chão na Layer 1, paredes com colisão na Layer 2 e teto na Layer 3.
   - Configurar um gatilho: clicar no baú $(5, 5)$ abre a passagem e dá $+1$ XP.
2. **Navegação e Movimentação no Grid (Cena)**:
   - Movimentar personagem com `WASD`.
   - Verificar que o personagem **não** atravessa paredes da Layer 2.
   - Clicar no baú e verificar execução do gatilho e atualização do diário.
3. **Puzzles Assíncronos**:
   - Testar cena de **Senha**: errar 3 vezes, verificar dano recebido e revelação da dica; acertar e verificar transição.
   - Testar cena de **Mahjong**: encontrar pares, acionar bomba com dano, limpar o tabuleiro e resgatar pontuação.
4. **Sincronização & Transições**:
   - Confirmar que o mestre ao clicar em "Tornar Cena Ativa" transporta todos os jogadores conectados.
   - Confirmar que um jogador em cena assíncrona só altera a sua própria visualização sem afetar o grupo.
