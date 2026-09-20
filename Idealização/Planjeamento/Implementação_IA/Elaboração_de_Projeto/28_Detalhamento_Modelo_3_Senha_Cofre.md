# 28. Detalhamento do Modelo de Cena 3: Senha (Cofre Rúnico, Mastermind & Puzzles)

Este documento estabelece a especificação técnica e o planejamento funcional completo do **Modelo 3: Senha (Puzzles de Código, Cofres Rúnicos e Puzzles de Combinação)** para o Arcana VTT.

---

## 🔢 1. Visão Geral do Modelo

O Modelo 3 é um puzzle **Assíncrono (1 jogador ativo por sessão)** focado em decifrar sequências rúnicas, combinações de cofres ou senhas simbólicas/numéricas.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SLOTS DA SENHA (Até 50 Slots)                          │
│   [ Slot 1 ]   [ Slot 2 ]   [ Slot 3 ]   ...   [ Slot N ]                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                      TIPOS DE CONTEÚDO PERMITIDOS                           │
│   - Números (em intervalo definido) | Letras | Ícones / Runas / Assets      │
├─────────────────────────────────────────────────────────────────────────────┤
│                      SISTEMA DE DICAS ESCALONADO                            │
│   - Dica 1 (Texto Livre Enigmático)                                         │
│   - Dica 2 (Multiplicação Global da Sequência ➔ Bordas Vermelhas / Azuis)   │
│   - Dica 3 (Comparação Posicional ➔ Slots Vermelhos / Verdes / Azuis)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📐 2. Estrutura de Slots e Modos de Combinação

### 2.1. Capacidade dos Slots
* **Limite Rígido**: Suporte de **1 a 50 Slots** por puzzle de senha.
* **Tipos de Conteúdo**: O mestre define a biblioteca de itens disponíveis para os slots:
  - *Números*: dentro de um intervalo permitido (ex: 0 a 9, ou 1 a 100).
  - *Letras*: alfabeto padrão ou runas antigas.
  - *Ícones / Assets*: biblioteca de símbolos vetoriais SVG (runas, elementos, relíquias).

### 2.2. Modos de Definição da Chave
* **Modo Fixa**: O mestre define manualmente a ordem exata dos IDs dos ícones/letras/números. A sequência é salva de forma persistente.
* **Modo Aleatória**: A combinação correta é gerada dinamicamente pelo backend a cada novo acesso do jogador à cena.

---

## 🧮 3. Mapeamento Matemático Dinâmico & Lógica de Valores

1. **Atribuição Autoritativa no Backend**:
   * Quando o jogador entra na cena, o backend atribui dinamicamente um valor numérico a cada elemento/ícone disponível na paleta de opções.
   * Nas senhas de ordem **Fixa**, os IDs dos ícones permanecem na sequência definida pelo mestre, e a lógica matemática é aplicada por cima dessas atribuições numéricas sem alterar a ordem das respostas.

---

## 💡 4. Sistema Triplo de Dicas Escalonado

O puzzle oferece 3 níveis progressivos de pistas que podem ser ativados gradualmente pelas regras de automação da cena (ex: via gatilho `on_password_fail` com condição de tentativas `attempts >= N`):

### 4.1. Level 1: Dica de Texto Livre
* Exibe um enigma descritivo ou texto de pistas escrito pelo mestre no cabeçalho do puzzle.

### 4.2. Level 2: Dica da Multiplicação Global (Feedback de Borda)
* Calcula a multiplicação dos valores numéricos dos itens colocados pelo jogador nos slots da esquerda para a direita e compara com o produto da senha correta:
  * $\text{Resultado Inserido} > \text{Valor Alvo} \longrightarrow$ As bordas de todos os tiles ficam **Vermelhas**.
  * $\text{Resultado Inserido} < \text{Valor Alvo} \longrightarrow$ As bordas de todos os tiles ficam **Azuis**.

### 4.3. Level 3: Dica Posicional por Slot (Feedback RGB)
* Cada slot individual altera sua cor em tempo real para indicar a relação com o valor correto daquele slot específico:
  * 🔴 **Vermelho**: O valor posicionado no slot é **Maior** que o valor alvo daquele slot.
  * 🟢 **Verde**: O valor posicionado no slot é **Exato** (correto para aquele slot).
  * 🔵 **Azul**: O valor posicionado no slot é **Menor** que o valor alvo daquele slot.

---

## ⚡ 5. Regras No-Code & Penalidades na Oficina

* **Tentativas Incorretas (`on_password_fail`)**:
  - Aplica dano configurável à Anima do personagem ativo.
  - Incrementa o contador de erros da sessão.
  - Desbloqueia níveis de dicas (`show_hint_1`, `show_hint_2`, `show_hint_3`).
* **Sucesso na Combinação (`on_password_correct`)**:
  - `award_item`: entrega itens ou relíquias no inventário.
  - `award_xp`: concede experiência na ficha.
  - `transfer_scene`: abre a porta do cofre e teleporta o jogador para a nova cena.
  - `log_diary`: registra o feito histórico no Diário de Bordo da mesa.
