# 29. Detalhamento do Modelo de Cena 4: Conversa (Árvore de Diálogos & Visual Novel)

Este documento estabelece a especificação técnica e o planejamento funcional completo do **Modelo 4: Conversa (Árvore de Diálogos, Interações com NPCs e Narrativa Estilo Visual Novel)** para o Arcana VTT.

---

## 💬 1. Visão Geral do Modelo

O Modelo 4 é uma cena **Assíncrona (1 jogador ativo por sessão)** no formato Visual Novel/Chat de RPG, onde o jogador conversa com um ou mais interlocutores, visualizando avatares, imagens explicativas e navegando por ramificações de escolha.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 HISTÓRICO ROLÁVEL DA CONVERSA (Estilo Chat)                 │
│   [Avatar] Interlocutor A: "Quem ousa se aproximar dos portões?"            │
│   └─ You: "Buscamos audiência com o Governador."                            │
│   [Avatar] Interlocutor B (Capataz): "Apenas nobres ou portadores de passe!"│
├─────────────────────────────────────────────────────────────────────────────┤
│                 PAINEL DE ESCOLHAS & OPÇÕES DE RESPOSTA                     │
│   [Opção 1] "Mostrar o Passe de Bronze" (Requer: Item Passe de Bronze)      │
│   [Opção 2] "Subornar o Capataz" (Requer: 20 Pratas)                        │
│   [Opção 3] "Tentar Persuadir" (Requer: Atributo Mente >= 3)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📝 2. Construtor na Oficina: Sistema de "Notas de Fala" (Nós)

Na Oficina do Mestre, o diálogo é construído através de um sistema modular de **Notas de Fala Interconectadas**:

### 2.1. Anatomia de uma Nota de Fala (Node):
1. **Identificador do Nó (`node_id`)**: Código único do bloco (ex: `node_inicio`, `node_suborno_sucesso`).
2. **Interlocutor**: Nome do personagem que está falando no nó atual.
3. **Mídias Visuais**:
   * *Ícone SVG Base*: Ícone vetorial do NPC.
   * *Avatar/Banner Resteado (Link Externo/Drive)*: URL da ilustração detalhada do personagem ou cenário.
4. **Texto da Fala**: Mensagem rica com formatação descritiva.
5. **Lista de Opções de Resposta**: Botões de escolha colocados à disposição do jogador.

---

## 🔀 3. Ramificações, Opções Condicionais & Consequências

Cada opção de resposta dentro de uma Nota de Fala possui 4 parâmetros configuráveis:

### 3.1. Parâmetros da Opção de Resposta:
1. **Texto do Botão**: A frase dita pelo jogador.
2. **Condição de Exibição (`[SE]`)**:
   * A opção só fica visível/clicável se o personagem cumprir a exigência (ex: `has_item: pass_bronze`, `min_stat: mente_3`, `min_wealth: 20_pratas` ou `min_reputation: guarda_50`).
3. **Nó de Destino (`goto_node_id`)**: Direciona o fluxo para a próxima Nota de Fala.
4. **Lista de Consequências e Efeitos (`[ENTÃO]`)**:
   * `award_item` / `remove_item`: entrega ou cobra itens/pratas.
   * `award_xp`: concede experiência na ficha.
   * `apply_damage` / `heal_anima`: altera a Anima.
   * `mod_reputation`: altera a barra de afinidade com uma facção no Gerenciamento de Mundo.
   * `transfer_scene`: encerra o diálogo e teleporta para um Grid Tático ou outra cena.

---

## 📜 4. Histórico Rolável & Log de Auditoria no Diário do Mestre

### 4.1. Interface de Chat Rolável no Cliente
* Durante a sessão, o balão principal exibe a fala atual enquanto a área superior permite ao jogador **rolar para cima** para rever todas as falas anteriores e as escolhas que ele fez naquela sessão, funcionando como um histórico fluido de chat.

### 4.2. Log Automático no Diário do Mestre (Auditoria Silenciosa)
* **Envio Autoritativo no Encerramento**: Ao sair da cena de diálogo ou concluir o nó final, o backend grava automaticamente uma cópia completa da transcrição das escolhas no **Diário do Mestre** (seção privada do mestre no Gerenciamento de Mundo).
* **Objetivo**: Garantir que o mestre acompanhe exatamente quais caminhos, subornos ou promessas cada jogador realizou durante seus diálogos solo.
