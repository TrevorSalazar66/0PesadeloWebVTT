# Planejamento: Modularidade de Sistemas de RPG e Integração do AlphaD6

## 1. Registro Oficial do Sistema AlphaD6 no Catálogo do Backend

* **Objetivo**: Tornar o sistema "AlphaD6" um sistema oficial de primeira classe no catálogo de sistemas da plataforma, com metadados próprios (id: `alphad6`, nome: `AlphaD6 RPG`, badge: `AlphaD6`, ícone, descrição das regras de Dice Pool D6).
* **Método**: Atualizar a constante `OFFICIAL_SYSTEMS` no `campaignService.js` para incluir o `alphad6` com destaque inicial como o sistema nativo da plataforma. Atualizar as validações do backend para reconhecer `alphad6` como um identificador válido de sistema de campanha.
* **Resultados Esperados**: O endpoint `/api/sync` (`campaigns.options`) passará a retornar o `alphad6` com todas as suas informações para preenchimento dinâmico dos seletores no frontend.
* **Possíveis Problemas Pós Implementação**: Campanhas antigas salvas com `system_id = 'custom'` ou outro valor precisarão continuar funcionando com fallback gracioso.
* **Argumentação**: Ter um catálogo centralizado no backend garante que novos sistemas possam ser adicionados futuramente sem quebrar a consistência das regras nem das campanhas existentes.

O catálogo de sistemas no backend atuará como a fonte única da verdade para os motores disponíveis. Ao registrar o `AlphaD6` no topo da lista com ID `alphad6`, nome `AlphaD6 RPG` e badge `AlphaD6`, o ecossistema passa a associar diretamente essa chave às regras de atributos quádruplos (Corpo, Mente, Social, Espírito), cálculo de especializações baseadas em Mente, mecânica de sucessos $\ge 4$, testes resistidos com desempate por soma e rolagem livre.

## 2. Seleção e Edição do Sistema na Criação e no Painel da Campanha

* **Objetivo**: Permitir que o Mestre escolha o sistema AlphaD6 (ou outros sistemas disponíveis) tanto no momento da criação da campanha quanto na edição posterior dos dados da mesa.
* **Método**: 
  - No frontend (`index.html`): Atualizar o seletor `#camp-select-system` e o dicionário `CAMPAIGN_POOLS.systemsMap` para incluir a opção "AlphaD6 RPG" com seu badge estilizado.
  - No backend (`dbQueries.updateCampaign` e `syncService.js` `campaigns.update`): Adicionar suporte para atualizar o campo `system_id` da campanha quando o mestre enviar alterações.
  - Na tela da campanha (`campanha.html` e `campanha.js`): Adicionar o campo select de "Sistema de RPG" dentro do modal `#editModal` e refletir visualmente o nome/badge correto no card de Estatísticas da Aba Geral.
* **Resultados Esperados**: O mestre tem controle total para definir e alterar o sistema da sua mesa, com persistência no banco SQLite/D1.
* **Possíveis Problemas Pós Implementação**: Trocar de sistema no meio de uma campanha em andamento pode gerar inconsistência nas fichas criadas; no futuro, poderemos exibir um alerta confirmatório se já houverem fichas vinculadas.
* **Argumentação**: Flexibilidade de configuração é um requisito essencial para Mestres de RPG, permitindo tanto a escolha rápida na criação quanto ajustes posteriores.

O fluxo de interface será enriquecido com a opção clara do AlphaD6. Na criação de campanhas no saguão inicial (`index.html`), o AlphaD6 estará disponível com pré-visualização imediata do seu card temático. Dentro da campanha (`campanha.html`), o botão de edição rápida permitirá alterar não apenas o nome, sessões e avisos, mas também selecionar o sistema da mesa em um menu dropdown moderno, salvando instantaneamente no backend.

## 3. Isolamento Modular de Regras, Scripts e Compêndios por Sistema

* **Objetivo**: Garantir que a campanha carregue e execute estritamente os scripts, regras, fichas de personagem e compêndios vinculados ao `system_id` selecionado (ex: apenas regras e compêndio do AlphaD6 quando `system_id === 'alphad6'`).
* **Método**: Implementar uma arquitetura de carregamento modular (Registry/Factory) no frontend e backend. Quando uma campanha com `system_id === 'alphad6'` for aberta, a aplicação ativará os manipuladores do motor AlphaD6 (interpretador de rolagens de atributos no chat, modelo de ficha de 4 atributos + especializações e compêndio específico), isolando-o de outros sistemas.
* **Resultados Esperados**: Separação clara de responsabilidades, onde cada sistema de RPG possui seu próprio ecossistema isolado sem poluição cruzada de dados.
* **Possíveis Problemas Pós Implementação**: Tentativa de carregar um sistema não implementado pode gerar tela em branco; trataremos com fallback para "Sistema Livre / Custom".
* **Argumentação**: A arquitetura modular desacoplada é o pilar fundamental do RetroForge VTT, permitindo que a plataforma cresça para dezenas de sistemas de RPG diferentes mantendo o código limpo, performático e sem misturar regras conflitantes.

A casca da campanha passará a ler a propriedade `camp.system_id`. Baseado nesse identificador, os componentes internos (chat de rolagem rápida, aba Diário para fichas e aba Oficina para compêndio) instanciarão o adaptador correspondente. Para o AlphaD6, os atalhos de rolagem rápida oferecerão os botões dos atributos Corpo, Mente, Social e Espírito, além de invocar o `rpgEngineService` implementado no backend para processar as jogadas daquela mesa.
