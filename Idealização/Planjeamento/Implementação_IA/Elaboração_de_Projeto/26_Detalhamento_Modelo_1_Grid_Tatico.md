# 26. Detalhamento do Modelo de Cena 1: Grid Tático & Exploração

Este documento estabelece o planejamento técnico e funcional completo do **Modelo 1: Grid Tático (Mapa de Exploração e Combate Posicional)** para o Arcana VTT.

---

## 🗺️ 1. Visão Geral do Modelo Grid Tático

O Grid Tático é o ambiente síncrono (multijogador em tempo real) onde os jogadores exploram masmorras, cidades e cenários táticos, movimentando seus tokens em uma matriz 2D de células de até $500 \times 500$ tiles.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 4: NÉVOA DE GUERRA (Fog of War)                │
│    Cobre o mapa inteiro. Revelada dinamicamente pela Visão/Raycasting.     │
├─────────────────────────────────────────────────────────────────────────────┤
│                       LAYER 3: COBERTURA & TETO (Roof/Canopy)               │
│    Telhados, copas de árvores. Entidades passam POR BAIXO.                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                       LAYER 2: OBSTÁCULOS & ENTIDADES (Collision)           │
│    Paredes, portas, baús, NPCs e Tokens. Bloqueiam Movimento e Visão.      │
├─────────────────────────────────────────────────────────────────────────────┤
│                       LAYER 1: PISO & TERRENO (Floor/Base)                  │
│    Pedra, grama, terra, água. Entidades passam POR CIMA.                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚫 2. Regra Global de Não-Sobreposição de Tokens e Colisão

* **Regra Global de Camada**: Duas entidades (jogadores, NPCs, monstros) que estejam no **mesmo layer** (Layer 2) **JAMAIS se sobrepõem**.
* **Bloqueio de Movimento**:
  * Se um jogador tentar se mover para uma célula que já contém um token na Layer 2 ou um objeto sólido (ex: parede, árvore, baú fechado), o movimento é **instantaneamente bloqueado** no cliente.
  * Tokens só podem transitar por células da Layer 1 (chão) que estejam livres de obstáculos sólidos da Layer 2.

---

## 🕹️ 3. Modos de Interação e Controles

O sistema oferece paridade total entre Desktop e Mobile:

### 3.1. Métodos de Entrada
1. **Teclado (PC)**:
   * Movimentação: Teclas `WASD` ou `Setas Direcionais`.
   * Interação: Tecla `Espaço` ou `Enter` (interage com o objeto da Layer 2 posicionado na casa à frente do personagem).
2. **Mouse (PC)**:
   * Clique direto em qualquer célula da Layer 2 (baú, porta, alavanca) para andar até a adjacência e interagir.
3. **Gamepad Virtual & Touch (Mobile)**:
   * D-Pad virtual analógico/digital na tela + Botão de Ação `OK`.
   * Toque direto na célula desejada no mapa.

---

## 🧰 4. Catálogo de Elementos Globais Padrão (Comportamentos Nativos)

Para que o mestre não precise criar gatilhos do zero para interações cotidianas, o sistema disponibiliza uma biblioteca de **Elementos de Mapa Globais** com comportamentos padrão pré-programados:

| Elemento | Ícone Base | Comportamento Padrão Integrado | Estado Inicial |
| :--- | :--- | :--- | :--- |
| **Baú de Tesouro** | `chest_closed` | Ao interagir: alterna para `chest_open`, exibe modal de saque do inventário e entrega os itens configurados. | Sólido (Layer 2) |
| **Porta de Madeira / Ferro** | `door_closed` | Ao interagir: se destrancada, alterna para `door_open` (remove colisão e libera visão). Se trancada, exige chave. | Sólido (Layer 2) |
| **Alavanca Mecânica** | `lever_off` | Ao interagir: alterna entre `lever_off` e `lever_on`, acionando o vínculo mecânico atribuído. | Passável (Layer 2) |
| **Armadilha de Chão** | `trap_hidden` | Ao pisar (on_tile_enter): revela o gráfico da armadilha e aplica o dano de Anima configurado no personagem. | Passável (Layer 2) |
| **Portal / Escada** | `stair_down` | Ao pisar ou interagir: dispara transição de cena (`transfer_scene`) para o destino vinculado. | Passável (Layer 2) |
| **Fogueira / Altar** | `campfire` | Ao interagir: oferece opção de descanso curto ou benção. | Sólido (Layer 2) |

---

## 🌫️ 5. Névoa de Guerra (Layer 4) e Linha de Visão Dinâmica (LoS)

### 5.1. Arquitetura da Layer 4 (Fog of War)
* A Névoa de Guerra não se mistura com a estética do mapa; ela é uma **função extra posicionada no topo como Layer 4**, cobrindo todas as 3 camadas inferiores.
* A névoa é calculada em tempo real no cliente com base na posição do token do jogador.

### 5.2. Algoritmo de Linha de Visão Dinâmica (Line of Sight - LoS)
1. **Raio de Visão**: Cada personagem possui um raio de alcance de visão (ex: 8 células de raio).
2. **Bloqueio por Obstáculos (Layer 2)**:
   * Elementos sólidos da `Layer 2` (paredes, pilares, portas fechadas) atuam como **bloqueadores de raio de visão**.
   * **Regra de Ocultação por Sombra**: Mesmo que uma célula esteja dentro do raio de 8 células de alcance do personagem, se houver uma parede na Layer 2 entre o personagem e essa célula, a célula permanece **completamente oculta pela Névoa de Guerra (Layer 4)**.
3. **Revelação Persistente (Opcional por Cena)**:
   * O mestre pode definir se o terreno já visitado pelo jogador fica levemente visível (névoa cinza de mapa conhecido) ou se volta a ficar totalmente escuro ao sair do raio de visão.

---

## ⚡ 6. Sincronização P2P e Validação

1. **Movimento Local Imediato**: A movimentação do token roda no cliente a $60\text{ FPS}$ para resposta instantânea.
2. **Broadcast P2P WebRTC**: A nova coordenada $(X, Y)$ é enviada instantaneamente para os outros jogadores da mesa via evento `token_move`.
3. **Validação no Backend**: Em interações da Layer 2 (baús, armadilhas, portas trancadas), a ação passa pelo endpoint autoritativo `campaigns.scenes.triggerAction` no backend SQLite antes de aplicar alterações definitivas na ficha ou mapa.
