# Planejamento: Motor de Regras D6 e Sistema de Rolagem de Dados

## 1. Módulo Core do Motor de Dados (rpgEngineService.js / diceService.js)

* **Objetivo**: Criar uma engine de regras autoritária no backend capaz de processar rolagens de dados com precisão estatística, aplicando as regras de Dice Pool D6 do sistema e permitindo também rolagens matemáticas livres (ex: 2d6+3, 1d20).
* **Método**: Implementar funções puras no backend utilizando geradores criptográficos (`crypto.getRandomValues`). Para o sistema D6 da mesa, a função receberá a quantidade total de D6 (calculada pela soma de Atributo + Especialização + Vantagens + Ajudas), sorteará os dados, identificará quais foram sucessos (valores 4, 5 e 6), calculará a soma dos dados de sucesso para critérios de desempate e determinará a classificação do resultado caso uma dificuldade seja informada.
* **Resultados Esperados**: Resoluções instantâneas, justas, transparentes e imunes a manipulações de clientes, retornando metadados completos de cada jogada.
* **Possíveis Problemas Pós Implementação**: Erros de parsing em rolagens livres com strings malformadas do usuário (ex: `/roll 2d+` ou `/roll d`); será necessário um parser com validações e limites rígidos de segurança (ex: máximo de 100 dados por rolagem para evitar travamento de CPU).
* **Argumentação**: Centralizar a lógica matemática e estatística no backend garante integridade para o VTT, consistência em logs de auditoria e reaproveitamento tanto no chat textual quanto em cliques diretos na futura ficha de personagem.

O módulo core será o coração mecânico do sistema no backend. Ele conterá o método `rollD6Pool({ dadosCount, dificuldade })`, que gerará a lista de resultados dos dados, filtrará os sucessos (dados $\ge 4$) e calculará a soma total dos dados que geraram sucesso. Além disso, aplicará a tabela de dificuldades oficial: Sucesso Total (sucessos $\ge$ dificuldade), Sucesso Parcial (sucessos $\ge \lceil \text{dificuldade}/2 \rceil$) e Falha Total (sucessos $<$ metade). Para a rolagem genérica, um parser regex interpretará fórmulas clássicas do tipo `XdY(+/-Z)` e entregará o somatório e a lista dos dados lançados.

## 2. Mecânica e Comparador de Testes Resistidos

* **Objetivo**: Fornecer uma função de resolução para disputas entre dois personagens (Jogador vs Jogador ou Jogador vs NPC).
* **Método**: Criar a função `resolveOpposedRoll(rollA, rollB)` que compara primariamente a quantidade de sucessos de cada lado. Em caso de empate no número de sucessos, utiliza a somatória dos dados que foram sucesso para definir o vencedor. Persistindo o empate, classifica o resultado como empate / sucesso parcial mútuo.
* **Resultados Esperados**: Resolução automática e desempate simplificado em milissegundos, sem ambiguidades na interpretação das regras.
* **Possíveis Problemas Pós Implementação**: Diferenciação de quem é o polo ativo (atacante) e polo passivo (defensor) quando o mestre precisar determinar consequências específicas de empate.
* **Argumentação**: A simplificação do desempate pela soma dos dados de sucesso mantém a fidelidade à proposta ágil do sistema, sendo computacionalmente limpa e intuitiva para os jogadores acompanharem no log de rolagem.

O comparador de testes resistidos automatizará disputas táticas e sociais dentro da campanha. A função receberá os dois objetos de rolagem de D6 Pool gerados pelo motor central. O algoritmo verificará primeiro se `rollA.sucessos > rollB.sucessos` (vitória do A) ou vice-versa. Se `rollA.sucessos === rollB.sucessos`, ele avaliará `rollA.somaSucessos` versus `rollB.somaSucessos`. Caso os valores sejam idênticos, o sistema registrará status de empate, retornando uma estrutura de dados clara para apresentação na interface.

## 3. Endpoints e Ações de API no Backend (syncService / rotas)

* **Objetivo**: Expor as operações de rolagem e testes como ações da API seguras para serem consumidas tanto pelo chat quanto por eventos de cena e futuras fichas.
* **Método**: Adicionar manipuladores de ações no backend (ex: `rpg.rollPool`, `rpg.rollFree`, `rpg.opposedRoll`), validando autenticação da sessão do usuário e permissão na campanha.
* **Resultados Esperados**: Comunicação estruturada com respostas padronizadas em JSON contendo o autor, detalhes da rolagem, dados individuais, sucessos e veredito.
* **Possíveis Problemas Pós Implementação**: Flood de requisições de rolagem sobrecarregando a API se não houver um pequeno controle de taxa (rate limiting).
* **Argumentação**: Expor as rolagens como ações padronizadas no `syncService` permite que elas sejam reutilizadas por WebSockets no chat ou por chamadas HTTP diretas com a mesma arquitetura limpa já estabelecida no projeto.

As ações do backend serão integradas ao fluxo de mensagens da campanha. Ao receber uma requisição de rolagem de um usuário autenticado pertencente à mesa, o backend processará o cálculo e estruturará a mensagem pronta com os metadados ricos (nome do personagem/usuário, atributo utilizado, especialização, modificadores, lista de dados com indicação visual de sucessos e o resultado final).

## 4. Parser e Tratamento de Comandos de Chat

* **Objetivo**: Permitir que os jogadores e mestres executem rolagens diretamente pela caixa de texto do chat através de comandos amigáveis.
* **Método**: Desenvolver um parser de comandos que identifique `/roll` tanto no formato livre (ex: `/roll 2d6+3`) quanto no formato de comando do sistema (ex: `/roll corpo`, `/roll mente esp:investigacao vant:1 dif:6`).
* **Resultados Esperados**: Flexibilidade total para jogadores digitarem comandos rapidamente ou realizarem rolagens livres sem burocracia.
* **Possíveis Problemas Pós Implementação**: Variações de sintaxe digitadas pelos usuários (espaços a mais, letras maiúsculas, parâmetros fora de ordem); a regex e o tokenizer precisam ser tolerantes a variações.
* **Argumentação**: O chat é a interface primária de ação narrativa no RPG de mesa online. Ter um parser ágil e intuitivo eleva o padrão de experiência do usuário sem depender exclusivamente de cliques em botões.

O interpretador de comandos analisará as strings iniciadas por `/roll` ou `/r`. Se o padrão for uma expressão matemática com dados (ex: `3d6`, `1d20+5`, `2d6-1`), o parser roteia para a rolagem livre. Se identificar palavras-chave dos atributos (`corpo`, `mente`, `social`, `espirito`) ou modificadores (`esp:`, `vant:`, `dif:`, `ajuda:`), o comando extrairá os parâmetros e invocará a rolagem de pool de D6 do sistema, devolvendo o payload processado.

## 5. Testes Unitários e Validação Estatística do Motor

* **Objetivo**: Garantir a estabilidade, corretude das fórmulas, limites de dificuldade e confiabilidade do motor de regras.
* **Método**: Criar um arquivo de testes automatizados (em `Codigo/Backend/test/rpgEngine.test.js`) cobrindo: rolagens de pool com diferentes quantidades de dados, contagem correta de sucessos ($\ge 4$), soma dos dados de sucesso, cálculo de sucesso total/parcial/falha conforme a tabela oficial de dificuldades, desempates em testes resistidos e segurança do parser contra entradas maliciosas ou gigantescas.
* **Resultados Esperados**: 100% de cobertura das regras descritas para o sistema, garantindo zero regressões quando formos integrar as fichas e a interface gráfica.
* **Possíveis Problemas Pós Implementação**: Flutuações estatísticas em testes de aleatoriedade exigirão testes determinísticos com injeção de mocks para dados simulados.
* **Argumentação**: Testes unitários para regras de RPG são indispensáveis, pois asseguram que nenhum detalhe matemático ou regra de desempate se perca em refatorações futuras.

O conjunto de testes validará cenários controlados (por exemplo: dados simulados `[6, 4, 3, 1]` com dificuldade 2 resultando em Sucesso Total com 2 sucessos e soma 10; dados `[5, 2, 1]` com dificuldade 2 resultando em Sucesso Parcial com 1 sucesso e soma 5). Também testará as tabelas de dificuldade oficiais (de 2 a 22) e a integridade de testes resistidos com empates de sucessos e desempate por soma.
