# Planejamento: Sistema de Anima, Descansos, Relógio da Campanha e Moderação de Ações

## 1. Motor de Anima, Descansos e Restaurações (AlphaD6 Engine)

* **Objetivo**: Implementar as regras e cálculos matemáticos para o recurso único de "Anima" (vida/energia/vontade), execução dos 3 tipos de descanso e 3 níveis de restauração no motor do backend (`rpgEngineService.js`).
* **Método**: 
  - `calculateInitialAnima({ atributos, customRoll = null })`: Executa a fórmula $2d6 + \sum(\text{Atributos})$.
  - `calculateMaxAnima({ atributos, bonusDado })`: Permite recalcular a Anima máxima dinamicamente conforme os atributos sobem.
  - `applyRest({ tipo, currentAnima, maxAnima, customRoll = null })`:
    - Curto: Rola $3d4$, recupera a Anima e estipula avanço de +2 horas no tempo do mundo.
    - Longo: Rola $3d6$, recupera a Anima e estipula avanço de +6 horas no tempo do mundo.
    - Completo: Rola $3d8$, recupera a Anima e estipula avanço de +8 horas no tempo do mundo.
  - `applyRestoration({ tipo, currentAnima, maxAnima, itensCuraDisponiveis })`:
    - Emergência: Consome 1 item de cura, recupera 6 pontos fixos de Anima.
    - Cuidadosa: Consome 2 itens de cura, recupera 12 pontos fixos de Anima.
    - Completa: Consome 3 itens de cura, recupera 100% dos pontos de Anima e estipula avanço de +24 horas no tempo do mundo.
  - `applyAnimaDamage({ currentAnima, dano })`: Reduz a Anima; se $\le 0$, marca o estado `PASSAGEM_PARA_O_VAZIO`.
* **Resultados Esperados**: Mecânicas perfeitamente parametrizadas no backend, com tetos que impedem a Anima atual de exceder a Anima máxima ou ficar negativa.
* **Possíveis Problemas Pós Implementação**: Tentativas de cura quando a Anima já está no máximo; o motor deve informar que o personagem já está totalmente recuperado sem desperdiçar itens.
* **Argumentação**: Regras claras e puras de estado facilitam a integração tanto com comandos rápidos de chat quanto com cliques na ficha e automação de NPCs.

O motor central do AlphaD6 receberá os novos métodos que tratam a Anima como a única barra de integridade do personagem. O cálculo de descanso gerará as rolagens dedicadas ($3d4$, $3d6$, $3d8$) e limitará o resultado ao valor máximo calculado daquele aventureiro. As restaurações aplicarão os valores exatos de medicina e computarão o débito de itens consumíveis de cura, fornecendo metadados completos de tempo decorrido para serem repassados ao relógio da campanha.

## 2. Sistema de Relógio e Calendário Dinâmico da Campanha (World Clock)

* **Objetivo**: Fornecer à mesa um estado temporal dinâmico que registra data, horário e tempo total decorrido na aventura, avançando com ações dos jogadores (descansos e restaurações) ou intervenções do Mestre.
* **Método**: 
  - Adicionar na tabela `campaigns` (ou campo JSON de metadados da campanha) a estrutura de relógio:
    ```json
    {
      "ano": 1,
      "mes": 1,
      "dia": 1,
      "hora": 8,
      "minuto": 0,
      "nome_mes": "Mês da Forja",
      "estacao": "Primavera"
    }
    ```
  - Criar funções de serviço para avançar tempo (em minutos/horas/dias) e formatar o horário legível para exibição na interface (ex: `Dia 14, 16:30 - Tarde`).
* **Resultados Esperados**: Toda a mesa compartilha a mesma noção de tempo narrativo, e ações demoradas (como um descanso de 8h ou restauração de 24h) impactam o mundo de jogo de forma visual e tangível.
* **Possíveis Problemas Pós Implementação**: Fusos ou descompasso em relógio de tempo real; a abordagem recomendada é relógio narrativo por eventos/ações, avançando sob comando da mesa.
* **Argumentação**: O relógio dinâmico reforça a imersão da gestão de recursos do AlphaD6, tornando a escolha entre um descanso curto de 2h e um longo de 6h uma decisão tática e narrativa real.

O relógio da campanha atuará como o cronômetro oficial do mundo. Quando o mestre ou os jogadores acionarem ações temporais, o serviço recalculará a passagem de minutos e horas, virando o dia e atualizando o calendário da campanha. O mestre terá controles rápidos para avançar blocos de tempo (ex: `+1h`, `+6h`, `+1 dia`, `Amanhecer`, `Anoitecer`), permitindo controle total da ambientação.

## 3. Moderação de Ações de Jogadores e Toggle de Aceite Automático

* **Objetivo**: Permitir que jogadores invoquem livremente comandos de descanso e cura, mas garantir que o Mestre (ou Auxiliar de Mestre) tenha o poder de aprovar/recusar o efeito antes que ele altere a ficha do personagem, com opção de ligar/desligar o aceite automático.
* **Método**: 
  - Adicionar configuração na campanha: `auto_approve_actions: 0 | 1` (0 = Requer aprovação manual; 1 = Aceite automático instantâneo).
  - Quando um jogador digitar `/rest` ou `/heal`:
    - Se `auto_approve_actions === 1`: O backend aplica a cura e o avanço de tempo imediatamente, enviando a mensagem final no chat.
    - Se `auto_approve_actions === 0`: O backend registra uma solicitação pendente e envia um card interativo no chat com botões **[Aceitar]** e **[Recusar]** visíveis exclusivamente para o Mestre e Auxiliar de Mestre da campanha.
  - Ação `rpg.actionApprove` / `rpg.actionReject`: Ao clicar em aceitar, o Mestre despacha a confirmação autoritária, aplicando a cura na ficha e avançando o relógio.
* **Resultados Esperados**: Autonomia total para o mestre escolher entre um jogo supervisionado (evitando abusos de descansos em masmorras perigosas) ou um jogo fluido com aprovação automática.
* **Possíveis Problemas Pós Implementação**: Notificações perdidas caso o mestre esteja em outra aba; o chat exibirá o badge de aviso com destaque visual de ação pendente.
* **Argumentação**: O Mestre é a autoridade da mesa no RPG de mesa; permitir que ele valide descansos e curas antes de efetivá-los garante consistência às regras de "local seguro e confortável" exigidas pelo AlphaD6.

A moderação de ações conectará o chat ao estado dos personagens. A interface do Mestre e Auxiliar interceptará os eventos de descanso emitidos pelos jogadores. Caso o mestre julgue que o local onde o grupo está não é seguro o suficiente para um descanso longo, ele pode recusar ou negociar com o jogador diretamente no chat antes de aplicar a mecânica.

## 4. Estrutura de Arquétipos e Contatos do Personagem

* **Objetivo**: Modelar o suporte a Arquétipo livre e aos 3 Contatos (NPCs do jogador) dentro da estrutura de dados das fichas do AlphaD6.
* **Método**: Estruturar no JSON da ficha do AlphaD6 a chave `arquetipo: ""` e a lista `contatos: [ { nome, vinculo, detalhes } ]` com capacidade máxima de 3 elementos.
* **Resultados Esperados**: Espaço reservado e organizado na estrutura do personagem para registrar as amizades, dívidas e conexões com NPCs criadas durante a campanha.
* **Possíveis Problemas Pós Implementação**: Criação de mais de 3 contatos; a validação do backend limitará a lista a no máximo 3 itens.
* **Argumentação**: Manter os contatos integrados à ficha permite que tanto o jogador quanto o mestre consultem rapidamente as dívidas e laços sociais dos personagens durante as sessões.

A modelagem de arquétipos e contatos garantirá que as informações narrativas tenham persistência oficial. Cada contato terá nome, tipo de vínculo (amizade, dívida, favor, antigo aliado) e uma breve descrição narrativa, podendo ser preenchido a qualquer momento durante o desenvolvimento da história.

## 5. Testes Automatizados

* **Objetivo**: Validar toda a integridade das fórmulas de Anima, rolagens de descanso, cura de restaurações, avanço de tempo no relógio e fluxo de aprovação com toggle ON/OFF.
* **Método**: Escrever testes automatizados em `Codigo/Backend/test/rpgEngine.test.js` e `Codigo/Backend/test/test_rpg_sync.js` cobrindo todos os cenários matemáticos e de autorização.
* **Resultados Esperados**: 100% de confiabilidade e cobertura para o motor AlphaD6.
* **Argumentação**: Manter testes para cada funcionalidade nova previne regressões em todo o ecossistema.
