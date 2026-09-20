# 27. Detalhamento do Modelo de Cena 2: Mahjong (Memória, Campo Minado & Relíquias)

Este documento estabelece a especificação técnica e o planejamento funcional completo do **Modelo 2: Mahjong (Fusão de Jogo da Memória, Campo Minado e Puzzles de Dedução)** para o Arcana VTT.

---

## 🃏 1. Visão Geral e Conceito do Modelo

O Modelo 2 é um puzzle **Assíncrono (1 jogador ativo por sessão)** que funde 3 mecânicas clássicas:
1. **Jogo da Memória**: Formar pares de relíquias/símbolos idênticos para limpá-los da tela e somar pontos.
2. **Campo Minado**: Cada símbolo esconde um valor numérico que indica quantas **bombas** existem nas casas adjacentes.
3. **Dedução Intuitiva de Mahjong**: O jogador aprende intuitivamente qual símbolo corresponde a qual número durante a partida.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FASE 1: REVELAÇÃO INICIAL                             │
│   Todas as peças iniciam visíveis com seus símbolos.                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                       FASE 2: OCULTAÇÃO (`?`)                               │
│   Ao fazer o PRIMEIRO par correto, todas as peças viram `?`.                │
├─────────────────────────────────────────────────────────────────────────────┤
│                       FASE 3: DEDUÇÃO & LIMPEZA                             │
│   - Símbolos equivalem a Números (Bombas Adjacentes).                      │
│   - Formar Par ➔ Limpa peças da tela e ganha +1 Ponto.                      │
│   - Clicar em Bomba (Lilás/Vermelha) ➔ Aplica Dano de Anima no Personagem.   │
├─────────────────────────────────────────────────────────────────────────────┤
│                       FASE 4: NOVAL RODADA & ESCALONAMENTO                  │
│   Ao remover todas as peças que não são bombas, o tabuleiro reinicia       │
│   acumulando pontos e HP da rodada anterior.                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📐 2. Configuração do Tabuleiro e Modos de Escalonamento

O mestre possui flexibilidade total para ajustar a dificuldade e a progressão da cena:

### 2.1. Tamanho do Tabuleiro
* **Modo Fixo**: O mestre define um tamanho fixo de linhas e colunas (ex: $4 \times 4$, $6 \times 6$, até o máximo de $100 \times 100$).
* **Modo Progressivo (Escalonamento por Rodadas)**: O mestre ativa a regra de crescimento automático. A cada rodada concluída, a dimensão do tabuleiro aumenta gradualmente.

### 2.2. Quantidade de Bombas
* **Modo Fixo**: Quantidade exata de bombas por tabuleiro (ex: 3 bombas).
* **Modo Porcentagem (`%`)**: Percentual fixo de peças convertidas em bombas (ex: 15% do tabuleiro).
* **Modo Progressivo**: O número/porcentagem de bombas aumenta a cada nova rodada concluída.

---

## 🔢 3. Lógica Numérico-Simbólica & Mapeamento Oculto

1. **Sorteio Dinâmico de Sessão**:
   * No momento exato em que o jogador acessa a cena, o backend gera um mapeamento único associando cada ícone/símbolo visual a um número inteiro oculto ($0, 1, 2, 3, 4, \dots$).
2. **Integração de Campo Minado**:
   * O número oculto associado ao símbolo da peça representa exatamente a **quantidade de bombas presentes nos vizinhos adjacentes** (8 direções).
   * O jogador utiliza a posição dos símbolos revelados para deduzir em quais células estão as bombas.

---

## 🎮 4. Ciclo de Gameplay da Sessão

1. **Início da Sessão**: O tabuleiro é gerado com todas as peças visíveis.
2. **Gatilho de Ocultação**: Ao acertar o primeiro par de relíquias idênticas, todas as peças não eliminadas assumem o estado oculto de interrogação (`?`).
3. **Formação de Pares**:
   * Virar duas peças com símbolos idênticos remove o par da tela e adiciona $+1$ Ponto à sessão.
4. **Acionamento de Bomba**:
   * Clicar em uma peça de Bomba (Vermelha com fundo Lilás) revela a bomba e **aplica o dano de Anima configurado no personagem ativo** (disparando o validador autoritativo no backend).
5. **Conclusão de Rodada e Reset**:
   * Quando todas as peças normais (não-bombas) forem removidas, a tela é limpa e uma nova rodada se inicia.
   * Os **Pontos Acumulados** e a **Anima Atual** são preservados entre as rodadas.
6. **Saída e Consequências**:
   * O jogador pode encerrar a sessão a qualquer momento resgatando suas pontuações conforme as regras configuradas pelo mestre.
   * A saúde da Anima gasta durante a sessão de teste é restaurada ao sair da cena.

---

## ⚡ 5. Regras No-Code & Gatilhos Configuráveis pelo Mestre

No construtor de gatilhos da Oficina, o mestre pode vincular ações às condições do Mahjong:

* `on_score_reach` (ex: ao atingir 10 pontos) $\rightarrow$ `award_item`, `award_xp`, ou `transfer_scene`.
* `on_hp_zero` (ao zerar a Anima por dano de bomba) $\rightarrow$ `defeat_event`, `log_diary` ou `transfer_scene`.
* `on_board_clear` (ao limpar a rodada) $\rightarrow$ `show_toast` ou `heal_anima`.
