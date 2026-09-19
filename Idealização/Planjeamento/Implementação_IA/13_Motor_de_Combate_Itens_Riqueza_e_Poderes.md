# Planejamento: Motor de Combate, Inventário, Riqueza e Poderes (AlphaD6)

## 1. Módulo de Capacidade de Carga, Riqueza e Catálogo de Armas/Defesas

* **Objetivo**: Modelar o cálculo de slots de inventário ($2d6 + \text{Corpo}$), o sistema de Nível de Riqueza abstrato ($\text{Mente} + \text{Social}$) e fornecer o catálogo canônico de armas simples, armas de fogo e defesas do AlphaD6.
* **Método**:
  - `calculateMaxInventorySlots({ corpo, customRoll = null })`: Rola $2d6 + \text{Corpo}$.
  - `getWealthTier({ mente, social })`: Soma $\text{Mente} + \text{Social}$ e retorna a faixa correspondente (*Miserável, Pobre, Classe Média Baixa, Classe Média Alta, Rico, Milionário*).
  - Tabela canônica de Armas:
    - Armas Simples (Corpo para corte/impacto/haste; Mente para arco, arremessador, chicote, arremesso) com seus dados de dano ($1d4$ a $1d10$) e traços.
    - Armas de Fogo (todas com atributo Mente, dano de $2d4$ até $2d12+8$, traços de Recarregável, Especializada e Munição).
  - Tabela canônica de Defesas (+1, +2, +4 com requisitos de riqueza mínima e limite estrito de até 3 itens).
* **Resultados Esperados**: Mecânicas econômicas e de inventário calculadas de forma determinística, transparente e integrada ao motor de regras.
* **Possíveis Problemas Pós Implementação**: Armazenamento de armas customizadas criadas pelo mestre; o motor permitirá estender o catálogo nativo com itens criados na Oficina da campanha.
* **Argumentação**: O sistema de riqueza abstrato do AlphaD6 é ágil e favorece o roleplay; tê-lo parametrizado no backend simplifica a verificação de acesso a armas e defesas sem necessidade de contabilidade de moedas individuais.

O módulo de inventário e economia fornecerá as tabelas de referência do AlphaD6 no backend. A capacidade de carga definirá o limite de itens que ocupam espaço (ignorando itens leves/pequenos). O cálculo de riqueza classificará instantaneamente o poder aquisitivo do personagem conforme a evolução de seus atributos Mente e Social, determinando a elegibilidade para portar armas avançadas e itens de proteção.

## 2. Motor de Iniciativa e Ordenação Tática de Combate

* **Objetivo**: Criar o algoritmo de iniciativa de combate que rola testes de `Corpo` para todos os participantes e monta a lista ordenada da rodada.
* **Método**:
  - `calculateCombatInitiative(participants)`: Cada personagem realiza uma rolagem D6 Pool com seu atributo `Corpo`.
  - Critério de Ordenação em 3 níveis:
    1. Quantidade de sucessos ($\ge 4$).
    2. Maior somatória dos dados que foram sucesso.
    3. Maior valor do atributo de `Corpo` base.
  - Estrutura do Estado de Combate: Lista ordenada de turnos com `{ characterId, nome, ordem, acoesRestantes: 4, reacoesDisponiveis: 0, status: 'ativo' | 'morrendo' | 'morto' }`.
* **Resultados Esperados**: Geração instantânea da ordem de ação do combate sem empates não resolvidos, pronta para ser consumida pela cena e pelo chat da campanha.
* **Possíveis Problemas Pós Implementação**: Entrada de novos personagens no meio de um combate em andamento; a função suportará inserção dinâmica recalculando a ordem.
* **Argumentação**: O algoritmo em 3 níveis de desempate garante consistência matemática às regras oficiais do AlphaD6, mantendo o combate fluido e sem interrupções para decisões manuais de desempate.

A iniciativa será gerada em bloco para todos os combatentes da cena (jogadores e NPCs). O backend processará todas as jogadas de Corpo simultaneamente, aplicando as regras de desempate por sucessos, somatória e atributo base, entregando um array ordenado pronto com os turnos ativos e a contagem de ações de cada participante.

## 3. Gestão de Turnos, 4 Ações Fixas, Reações e Defesas Ativas

* **Objetivo**: Implementar o controle de economia de ações por turno (4 ações fixas), conversão de ações não gastas em Reações e ativação de itens de defesa.
* **Método**:
  - Cada combatente inicia seu turno com `acoesRestantes: 4`.
  - Gastos de Ação: `spendAction(combatState, characterId, actionType, count = 1)`.
  - Encerramento do Turno: `endTurn(combatState, characterId)` $\rightarrow$ `reacoesDisponiveis = acoesRestantes` e `acoesRestantes = 0`.
  - Uso de Reação: `spendReaction(combatState, characterId, reactionType)` $\rightarrow$ Para contra-ataques, cobrir aliado ou ativar item de defesa.
  - Defesa Total: `calculateTotalDefense({ baseAttributeValue, activeDefenseItems = [] })`. A base é `Corpo` (para físico) ou `Espírito` (para mágico), somada aos itens de defesa ativados com Reação.
* **Resultados Esperados**: Economia tática precisa durante toda a rodada, incentivando os jogadores a balancear entre gastar 4 ações em ataque/movimento ou guardar ações para reações e defesas.
* **Possíveis Problemas Pós Implementação**: Jogador esquecer de encerrar o turno; o mestre terá o poder de avançar o turno manualmente.
* **Argumentação**: A conversão de ações não gastas em reações é uma das mecânicas táticas mais ricas do AlphaD6; centralizar seu controle no backend evita erros de contagem na mesa.

O motor manterá o estado volátil da cena de combate. Cada ação gasta para se mover (3 metros por ação), sacar item, usar poder ou atacar será debitada da cota de 4 ações. Ao finalizar a vez, as sobras serão automaticamente transformadas em reações disponíveis para serem acionadas fora do turno para defesa ou contra-ataque.

## 4. Resolução de Ataques, Dano de Armas e Contra-Ataques

* **Objetivo**: Executar testes de ataque físico (Corpo) ou à distância/fogo (Mente) contra a Defesa do alvo, calculando acertos, dano das armas e habilitando janelas de contra-ataque em caso de erro.
* **Método**:
  - `resolveAttack({ attacker, target, weapon, customRoll = null, isMagic = false })`:
    - Atributo de ataque: `Corpo` (armas brancas) ou `Mente` (armas à distância / armas de fogo).
    - Defesa do alvo: `Corpo` (ataque físico) ou `Espírito` (ataque mágico) $+$ bônus de defesas ativadas com reação.
    - Se `sucessos > targetDefense`: **Acerto**. Rola a expressão de dano da arma (ex: `1d8+3`, `2d6+3`) e aplica na Anima do alvo.
    - Se `sucessos <= targetDefense`: **Erro**. O alvo tem direito a um contra-ataque se possuir Reação disponível e arma com alcance apropriado.
* **Resultados Esperados**: Resoluções completas de combate com veredito claro de acerto, dano e avisos de contra-ataque no chat.
* **Possíveis Problemas Pós Implementação**: Alcance insuficiente para contra-ataques; a regra verificará a propriedade de alcance da arma.
* **Argumentação**: Regras autoritárias de ataque e dano garantem velocidade e imparcialidade aos combates, integrando perfeitamente a dedução de Anima implementada na fase anterior.

O processo de ataque receberá os dados do atacante, alvo e arma selecionada. O backend executará o pool de dados, comparará os sucessos com a Defesa calculada do alvo e, em caso de acerto, resolverá o dano da arma, descontando diretamente da Anima do defensor. Em caso de erro, o retorno informará explicitamente se o defensor pode contra-atacar.

## 5. Estado de Morrendo e Morte Instantânea

* **Objetivo**: Implementar o estado crítico de `Morrendo` quando a Anima chega a 0, com testes escalonados de sobrevivência a cada turno e regras de morte instantânea por falha ou ataque direto.
* **Método**:
  - Quando a Anima atinge 0, o personagem entra em `status: 'morrendo'`.
  - A cada turno em Morrendo, o personagem executa `resolveDyingCheck({ characterId, atributoChoice: 'corpo'|'espirito', tentativaNumero })`:
    - Dificuldade = $4 + (\text{tentativaNumero} - 1) \times 2$ (ex: 4 na 1ª, 6 na 2ª, 8 na 3ª...).
    - Se passar: Permanece vivo e estabilizado naquela rodada.
    - Se falhar: Morte instantânea (**Passagem para o Vazio**).
  - Morte por Ataque: `killInstantlyIfAttackedInDying(targetId)` $\rightarrow$ Qualquer ataque bem-sucedido contra um personagem já em estado de Morrendo resulta em morte instantânea.
* **Resultados Esperados**: Tensão dramática e mecânica precisa para momentos de quase-morte, com escalonamento de dificuldade e consequências fatais.
* **Possíveis Problemas Pós Implementação**: Jogadores confusos com o aumento da dificuldade; o sistema exibirá no log a dificuldade atual exata daquele teste.
* **Argumentação**: O estado de morrendo escalonado evita mortes triviais na primeira queda, mas cria uma corrida contra o tempo para curar o aliado antes que a dificuldade fique inalcançável.

O ciclo de morrendo controlará o contador de tentativas da cena. A cada turno do personagem abatido, ele rolará seu atributo de Corpo ou Espírito. O backend validará a meta progressiva ($4, 6, 8, \dots$), atualizando o status do combatente para `estabilizado_rodada` ou `morto`. Se um inimigo direcionar qualquer ataque a ele, a morte será decretada imediatamente.

## 6. Sistema de Poderes (Passivos e Ativos)

* **Objetivo**: Estruturar a modelagem de poderes sobrenaturais/mágicos vinculados a sacrifícios, diferenciando efeitos passivos (custo contínuo zero) e efeitos ativos (custo fixo de Anima).
* **Método**:
  - Modelo de Poder: `{ id, nome, tipo: 'passivo' | 'ativo', custoAnima: number, sacrificio: string, descricao: string }`.
  - `usePower({ character, powerId })`: Verifica se o personagem possui Anima suficiente para o custo ativo, deduz a Anima necessária e retorna a execução do poder.
* **Resultados Esperados**: Suporte a magias e dons místicos perfeitamente amarrados à gestão da barra única de Anima.
* **Possíveis Problemas Pós Implementação**: Tentativa de usar poder com Anima menor que o custo; o backend impedirá o uso ou avisará sobre o risco de entrar em Morrendo.
* **Argumentação**: A ligação direta entre poderes e Anima reforça a identidade do AlphaD6, onde a própria energia vital é gasta para manifestar efeitos sobrenaturais.

Os poderes serão registrados na ficha do personagem ou vinculados a itens e grimórios. Poderes passivos concedem benefícios narrativos permanentes após o sacrifício inicial. Poderes ativos consumirão pontos de Anima a cada conjuração, aplicando os mesmos fluxos de controle e integridade do motor de regras.

## 7. Testes Automatizados

* **Objetivo**: Cobrir 100% dos novos cálculos de combate, iniciativa em 3 níveis, catálogo de armas/defesas, testes de morrendo escalonados e uso de poderes.
* **Método**: Adicionar suites de testes unitários em `rpgEngine.test.js` e testes de integração em `test_rpg_sync.js`.
* **Resultados Esperados**: Zero regressões e validação matemática de todos os cenários de combate.
* **Argumentação**: A estabilidade do motor de combate é crítica para o VTT funcionar perfeitamente em tempo real.
