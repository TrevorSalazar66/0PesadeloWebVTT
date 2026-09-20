# 30. Detalhamento do Modelo de Cena 5: Combate por Turnos (Arena de Batalha RPG)

Este documento estabelece a especificação técnica e o planejamento funcional completo do **Modelo 5: Combate por Turnos (Arena de Batalha Tática Estilo JRPG/Pokémon)** para o Arcana VTT.

---

## ⚔️ 1. Visão Geral do Modelo

O Modelo 5 é um ambiente de combate **Síncrono (Multijogador em tempo real)** estilo arena JRPG (Final Fantasy/Pokémon), onde os heróis enfrentam hordas de inimigos puxados do Compêndio em uma fila de turnos gerenciada pelo backend.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 ARENA DE COMBATE (Lado A vs Lado B)                         │
│   [Equipe dos Heróis (Fichas Reais)]  VS  [Adversários (Do Compêndio)]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                 FILA DE INICIATIVA & RECURSO DE AÇÃO (PA)                   │
│   - Ordem de Turnos ➔ Calculada pelas Regras do Sistema da Campanha.        │
│   - Energia / Pontos de Ação (PA) ➔ Recursos gastos para Atacar/Usar Itens.  │
├─────────────────────────────────────────────────────────────────────────────┤
│                 MODOS DE VITÓRIA, DERROTA & ONDAS (Waves)                   │
│   - Proporcionalidade ➔ Número de inimigos escala por jogador ativo.         │
│   - Modo Sobrevivência ➔ Novas ondas surgem ao derrotar a horda anterior.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎲 2. Fila de Iniciativa e Sistema de Pontos de Ação (PA)

### 2.1. Fila de Iniciativa Autoritativa
* **Cálculo Automático**: A ordem de atuação na rodada é calculada automaticamente pelo backend com base no teste de Iniciativa/Atributo do sistema da campanha (ex: Mente/Agilidade no AlphaD6).
* **Fila Visual**: Exibição da barra superior com a ordem cronológica de ação de cada combatente na arena.

### 2.2. Recurso de Pontos de Ação (Pontos de Energia)
* **Economia de Turno**: Cada combatente recebe uma quantidade de **Pontos de Ação (PA)** no início do seu turno (energia de combate).
* **Custo de Ações**:
  - *Ataque Físico/Básico*: Gastos de 1 a 2 PA.
  - *Poderes / Magias Especiais*: Custo variável de PA + Anima.
  - *Usar Item do Inventário (Poção/Elixir)*: Gasto de 1 PA.
  - *Defesa Total / Esquiva*: Gasto de 1 PA (concede bônus de resistência até o próximo turno).

---

## ⚙️ 3. Resolução Autoritativa de Combate no Backend

1. **Sorteios e Matemática de Dano**:
   * Todas as rolagens de dados, testes de acerto, defesas e aplicação de dano à Anima ocorrem **100% de forma autoritativa no Backend** via `syncService.js`.
2. **Atualização Instantânea na Ficha Real**:
   * O dano sofrido ou o item consumido altera imediatamente os dados reais da ficha do personagem no banco de dados SQLite.

---

## 🏆 4. Modos de Batalha: Sobrevivência, Ondas & Escalabilidade

O mestre possui flexibilidade total ao configurar a arena de combate na Oficina:

### 4.1. Proporcionalidade em Relação aos Jogadores Ativos
* O mestre pode definir a escala de inimigos com base no tamanho da equipe presente na cena (ex: `2 Esqueletos por Jogador Ativo`).

### 4.2. Modo Batalha de Sobrevivência (Horde / Waves Mode)
* **Ondas Infinitas / Recarga de Horda**:
  - Ao derrotar todos os inimigos presentes na tela, uma **nova onda de adversários** surge instantaneamente na arena.
  - A equipe preserva sua Anima atual, pontos e recompensas acumuladas das ondas anteriores.
* **Critério de Encerramento**:
  - A batalha continua até que os jogadores decidam acionar o comando de **Fuga / Saída da Arena** (resgatando os prêmios da sessão) ou até que a Anima da equipe seja totalmente zerada.

---

## ⚡ 5. Condições de Vitória, Derrota e Gatilhos No-Code

* `on_wave_clear` (ao limpar uma onda) $\rightarrow$ `heal_anima`, `award_xp` ou `show_toast`.
* `on_survival_exit` (ao escapar da arena com sucesso) $\rightarrow$ `award_item`, `transfer_scene` e `log_diary`.
* `on_party_defeat` (ao zerar a Anima da equipe) $\rightarrow$ `defeat_event`, `transfer_scene` (cela/prisão) ou `log_diary`.
