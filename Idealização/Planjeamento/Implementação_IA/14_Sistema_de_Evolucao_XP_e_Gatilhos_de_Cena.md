# Planejamento: Sistema de Evolução de Personagem, XP e Gatilhos de Cena (AlphaD6)

## 1. Visão Geral e Objetivos

Este documento especifica a mecânica canônica de **Evolução de Personagem (Level Up)**, **Progressão de XP**, **Multiplicadores de Dificuldade da Campanha** e **Gatilhos de Ganho de XP vinculados a Cenas** criadas pelo Mestre no sistema **AlphaD6**.

---

## 2. Regras Canônicas de Progressão e XP

### 2.1. Requisito de XP para Avançar de Nível
Para que um personagem passe do nível atual para o próximo nível ($N = \text{nível\_atual} + 1$), ele deve acumular uma quantidade de XP proporcional ao novo nível:

$$\text{XP\_Necessário} = \lceil N \times M \rceil$$

Onde:
- $N$ é o próximo nível almejado (ex: nível 2 exige base de 2 XP, nível 3 exige base de 3 XP, etc.).
- $M$ é o **Multiplicador de XP da Campanha** definido pelo Mestre nas configurações da campanha:
  - **Padrão ($1.0\text{x}$)**: Nível 2 $\rightarrow$ 2 XP, Nível 3 $\rightarrow$ 3 XP, Nível 4 $\rightarrow$ 4 XP, etc.
  - **Desafiador ($1.5\text{x}$)**: Nível 2 $\rightarrow$ 3 XP, Nível 3 $\rightarrow$ 5 XP, Nível 4 $\rightarrow$ 6 XP, etc.
  - **Épico / Lento ($2.0\text{x}$)**: Nível 2 $\rightarrow$ 4 XP, Nível 3 $\rightarrow$ 6 XP, Nível 4 $\rightarrow$ 8 XP, etc.

### 2.2. Zeramento de XP após Evolução
- Assim que o personagem atinge ou supera o montante de $\text{XP\_Necessário}$ e a evolução é confirmada:
  - O nível do personagem sobe: $\text{nivel} \leftarrow \text{nivel} + 1$.
  - O XP atual do personagem é **zerado**: $\text{xp\_atual} \leftarrow 0$.

---

## 3. Benefícios Concedidos por Subida de Nível

A cada novo nível conquistado, o personagem recebe imediatamente:
1. **$+2$ Pontos de Atributo Livres** (`pontos_atributo_disponiveis += 2`) para investir entre *Corpo*, *Mente*, *Social* ou *Espírito*.
2. **$+3$ Pontos de Anima Máxima e Atual** (`max_anima += 3`, `anima += 3`).

### 3.1. Repercussão Dinâmica da Distribuição de Atributos na Ficha
Quando o jogador aloca os pontos de atributos recebidos:
- **Aumento de Mente**: Cada $+1$ em Mente concede **$+1$ nova Especialização** para o jogador escolher e registrar.
- **Aumento de Mente + Social**: Recalcula automaticamente o patamar de **Riqueza Abstrata** (`getWealthTier`).
- **Aumento de Corpo**: A capacidade máxima de slots do inventário ($2d6 + \text{Corpo}$) é recalculada e expandida dinamicamente.
- **Aumento de Atributos no geral**: Como a Anima máxima base considera a soma dos atributos, cada ponto de atributo investido amplia a Anima máxima em $+1$ adicional.
- **Poderes Ocultos**: Ganchos preparados na ficha para aquisição/desbloqueio de novos poderes conforme as diretrizes futuras do sistema.

---

## 4. Gatilhos de Ganho de XP em Cenas (Scene XP Triggers)

O Mestre pode estruturar cenas na campanha com gatilhos de recompensa de XP configuráveis:

### 4.1. Estrutura dos Gatilhos de Cena
Cada cena pode conter uma lista de `xp_triggers`:
```json
[
  {
    "id": "trg_cena_01_boss",
    "titulo": "Derrotar o Guardião do Portão",
    "xp": 1,
    "tipo": "objetivo",
    "status": "pendente"
  },
  {
    "id": "trg_cena_01_exploracao",
    "titulo": "Exploração Inicial do Templo",
    "xp": 1,
    "tipo": "entrada",
    "status": "pendente"
  }
]
```

### 4.2. Tipos de Gatilhos:
- **Entrada (`entrada`)**: Concede XP a todos os personagens presentes quando o Mestre ativa ou inicia a cena.
- **Objetivo / Conquista (`objetivo`)**: Concede XP quando o Mestre marca um objetivo específico da cena como concluído no painel.
- **Concessão Manual (`manual`)**: O Mestre pode conceder quantias pontuais de XP para um ou todos os personagens da cena a qualquer momento.

---

## 5. Arquitetura Backend & Endpoints

### 5.1. Funções no `rpgEngineService.js`
- `calculateRequiredXP(nextLevel, multiplier = 1.0)`: Calcula o total de XP necessário com arredondamento seguro.
- `canLevelUp(characterSheet, xpMultiplier = 1.0)`: Verifica se o personagem atingiu os requisitos de XP.
- `applyLevelUp(characterSheet, xpMultiplier = 1.0)`: Processa a subida de nível, zera o XP, concede $+2$ atributos e $+3$ anima.
- `distributeAttributePoints(characterSheet, distribution = {})`: Valida saldo de pontos, aplica incrementos, concede especializações extras se Mente subir e recalcula derivados (Riqueza, Capacidade de Carga, Anima Máxima).

### 5.2. Handlers no `syncService.js`
- `rpg.character.levelUp`: Executa a evolução do personagem (autorizado para o dono do personagem ou Mestre).
- `rpg.character.distributeAttributes`: Aloca pontos pendentes de evolução e recalcula a ficha.
- `campaigns.scenes.awardXP`: O Mestre concede XP para personagens da campanha via gatilho de cena ou concessão direta.
- `campaigns.scenes.create` e `campaigns.scenes.list`: Gerenciamento de cenas com gatilhos de XP.

---

## 6. Plano de Verificação e Testes

1. **Testes Unitários em `rpgEngine.test.js`**:
   - Validação da fórmula de XP com multiplicadores $1.0\text{x}, 1.5\text{x}, 2.0\text{x}$.
   - Validação da subida de nível, zeramento de XP e concessão de $+2$ atributos e $+3$ Anima.
   - Validação da distribuição de atributos e efeitos dinâmicos (especializações de Mente, Riqueza, Slots de inventário).
2. **Testes de Integração em `test_rpg_sync.js`**:
   - Concessão de XP pelo Mestre via gatilho de cena.
   - Execução de `rpg.character.levelUp` e persistência no banco D1.
   - Distribuição de atributos via `rpg.character.distributeAttributes` com validação de saldo e integridade.
