# Planejamento: Estruturação da Tela Interna da Campanha

## 1. Roteamento e Estrutura Base (campanha.html / SPA)

* **Objetivo**: Permitir o acesso à tela da campanha através de uma rota interna sem uso de subdomínios, mantendo uma navegação contínua.
* **Método**: Implementar um arquivo `campanha.html` dedicado ou uma nova rota no SPA existente no arquivo `index.html`. A estrutura conterá um menu de navegação (com as opções 1 a 7 descritas) e uma área de conteúdo principal dinâmica que injeta HTML/Componentes via JavaScript baseando-se na aba selecionada.
* **Resultados Esperados**: Navegação rápida entre as seções da campanha sem recarregar a página, mantendo conexões como o chat e os WebSockets ativas em segundo plano.
* **Possíveis Problemas Pós Implementação**: A sincronização do histórico do navegador (botão de voltar) pode ser confusa se a History API do JavaScript não for manipulada adequadamente.
* **Argumentação**: Usar carregamento dinâmico de abas em vez de múltiplas páginas evita quedas de conexão WebSocket (necessária para VTT e chat em tempo real) e proporciona uma sensação fluida de aplicativo (premium/moderno).

A estrutura base atuará como um "shell" (casca) para a campanha. O menu lateral ou barra superior exibirá os ícones das funções principais (Geral, Chat, Cenas, Oficina, Diário, Configurações, Sair). Quando o usuário clicar em uma opção, o JavaScript limpará a área de conteúdo central e renderizará a seção correspondente. Isso garante que a estética já desenvolvida para o projeto seja reaproveitada de forma modular, carregando apenas CSS e JS necessários para aquela view em particular.

## 2. Aba "Geral"

* **Objetivo**: Exibir o resumo da campanha, lista de jogadores, sessões ocorridas, sistema de regras e funções de permissão (mestre x jogador).
* **Método**: Criar um layout de dashboard. Exibiremos cartões (cards) para cada jogador com um botão para acionar um modal contendo a ficha simplificada/completa do personagem vinculado. Apenas usuários com a flag de `mestre/dono` verão botões de edição nessas áreas, os quais farão requisições seguras no backend.
* **Resultados Esperados**: Uma interface rica visualmente (com estética premium e microanimações) onde todos podem ler os dados gerais, mas apenas o mestre pode alterá-los.
* **Possíveis Problemas Pós Implementação**: O modal da ficha pode ficar pesado se carregar todos os dados do banco de uma vez, precisando de requisições sob-demanda (lazy loading).
* **Argumentação**: Separar visualização (read-only) de edição num mesmo layout, usando controle de permissão por cargo e backend, mantém o código limpo e evita duplicidade de componentes UI.

A seção "Geral" servirá como o saguão de entrada da campanha. Utilizaremos o sistema de cores e estética já construídos (como glassmorphism ou tema escuro moderno) para apresentar o título, resumo épico da história, e estatísticas (ex: "Número de Sessões: 12"). A lista de participantes exibirá o avatar do usuário e o avatar do seu personagem. Ao clicar no personagem, um modal suave se sobreporá à tela exibindo os dados da ficha através de requisições assíncronas ao banco de dados.

## 3. Aba "Chat"

* **Objetivo**: Fornecer um chat de texto em tempo real voltado para interpretação de RPG de mesa, rolagem de dados e gatilhos de cena.
* **Método**: Integrar com WebSockets no backend. Desenvolver interpretadores de comandos (ex: `/roll 1d20`) que devolvam o resultado renderizado no chat para todos. Adicionar suporte a links especiais gerados pelo mestre (ex: `<a class="scene-invoke" data-scene-id="xyz">Mover para a Cena</a>`).
* **Resultados Esperados**: Um chat rápido, leve e responsivo, focado apenas em texto e interações mecânicas do sistema, sem a necessidade de processar upload de imagens neste componente.
* **Possíveis Problemas Pós Implementação**: Falhas de reconexão de WebSockets podem fazer usuários perderem mensagens se o backend cair; será necessário carregar o histórico salvo no banco.
* **Argumentação**: O WebSocket é a tecnologia mais adequada para o tempo real que o RPG exige. Limitar imagens no chat mantém a aba performática e focada na narrativa textual.

Esta aba não será um simples bloco de texto. Ela incluirá formatações ricas (cores, negritos) para diferenciar falas em "off" (fora de personagem), falas do personagem e descrições do mestre. O sistema de rolagem de dados exibirá componentes em formato de caixas com os resultados e bônus explícitos. A funcionalidade de "invocar cena" será um link ou botão que, ao ser clicado pelos jogadores, emitirá um evento pedindo a troca para a aba "Cenas", carregando diretamente o cenário invocado pelo mestre.

## 4. Aba "Cenas"

* **Objetivo**: Renderizar cenários, mapas (grids VTT) ou imagens imersivas que os jogadores estão vivenciando.
* **Método**: Utilizar um container de visualização central que carrega recursos estáticos e posiciona elementos. O mestre enviará eventos via WebSocket determinando a "Cena Ativa", e o frontend dos jogadores buscará os dados dessa nova cena na API para renderizar na tela.
* **Resultados Esperados**: Visualização compartilhada e perfeitamente sincronizada dos grids virtuais ou painéis imersivos.
* **Possíveis Problemas Pós Implementação**: A renderização pesada do Canvas ou sincronização contínua de movimentação de tokens pelo mapa pode exigir bastante otimização no frontend para não travar computadores mais fracos.
* **Argumentação**: Isolar as cenas ativas em uma aba separada permite maximizar a tela para o momento mais focado da sessão, sem poluição de componentes como diários ou configurações na frente.

Quando um jogador estiver na aba "Cenas", o frontend renderizará ativamente a cena apontada pelo mestre. Se for uma cena de batalha com Grid, a aplicação exibirá o mapa e os tokens. Se for apenas atmosférica (ex: um quarto de estalagem escuro), a imagem ocupará a tela com alta qualidade. Toda essa exibição visual lerá os layouts e posicionamentos definidos previamente na aba de Oficina.

## 5. Aba "Oficina" (Exclusiva do Mestre)

* **Objetivo**: Gerenciar o escopo de criação: preparar as cenas, gerenciar o compêndio do sistema (itens, habilidades, monstros) e desenhar a lógica da campanha.
* **Método**: Criar um painel de administração bloqueado por verificação de cargo no backend e frontend. Implementar uma interface no-code (que faremos depois) para ligar cenas e criar um CRUD robusto para os dados do compêndio desta campanha em específico.
* **Resultados Esperados**: Ferramenta restrita, centralizada e poderosa para o mestre preparar tudo offline (ou ao vivo) sem código.
* **Possíveis Problemas Pós Implementação**: A interface de lógica no-code para as cenas será complexa de implementar de forma fluida, requerendo possivelmente bibliotecas de drag-and-drop especializadas (como jsPlumb ou React Flow caso o stack permita) ou manipuladores avançados de DOM.
* **Argumentação**: O Mestre precisa de um "bastidor" (backstage) isolado. Restringir isso numa aba dedicada evita spoilers aos jogadores e mantém as ferramentas de edição complexas fora do caminho da interface de jogador comum.

A Oficina se subdividirá em gerenciadores (Cenas e Compêndio). O mestre poderá upar as imagens dos mapas, montar os limites do Grid de Batalha e pré-posicionar os NPCs. A lógica de interligação permitirá, futuramente, determinar regras lógicas simples para as transições e progressão da aventura. O Compêndio garantirá que as regras e o balanceamento do sistema base escolhido possam ser customizados localmente apenas para esta campanha.

## 6. Aba "Diário"

* **Objetivo**: Centralizar as fichas dos personagens completas, anotações de sessão, encontros, histórico de missões e gerenciamento de participantes.
* **Método**: Construir uma estrutura de navegação em árvore (tipo wiki ou Notion) na barra lateral de conteúdo. O Mestre terá uma visão global e poderá expulsar/gerenciar os jogadores nesta mesma tela de gerenciamento de campanha, além de aprovar alterações feitas nas fichas.
* **Resultados Esperados**: Um banco de dados enciclopédico prático focado na narrativa ("lore") do jogo.
* **Possíveis Problemas Pós Implementação**: O excesso de anotações pode dificultar a localização. Um bom sistema de ordenamento de pastas e pesquisa em tempo real será fundamental.
* **Argumentação**: Sessões de RPG acumulam meses de informações soltas. Centralizar tudo isso dentro do sistema e nas fichas dos personagens aumenta imensamente a praticidade da plataforma em relação aos concorrentes.

Esta aba é o equivalente ao caderno do jogador e do mestre. Para o jogador comum, ele visualizará a sua ficha detalhada de RPG (podendo gastar atributos, editar inventário, etc.) e gerenciar as anotações do seu ponto de vista. O mestre conseguirá visualizar os diários de tudo e todos. O recurso de controle da campanha também morará aqui, permitindo convidar ou remover contas de usuários daquela "mesa".

## 7. Aba "Configurações"

* **Objetivo**: Definir preferências gerais do ambiente da campanha, como esquema de cores visual e conexões externas.
* **Método**: Formulário contendo os "settings" aplicáveis globalmente (se configurado pelo mestre) ou localmente. Incluir campos para vincular um canal ou servidor de Discord usando as APIs adequadas ou simples Webhooks.
* **Resultados Esperados**: Interface personalizada e interligada facilmente aos canais de voz externos.
* **Possíveis Problemas Pós Implementação**: A integração com o Discord por OAuth exigirá que o dono do projeto crie e mantenha um App de desenvolvedor na plataforma Discord, lidando com chaves de API secretas no backend.
* **Argumentação**: Reinventar sistemas de voz do zero consome muito tempo e dinheiro de servidor. Integrar-se com o Discord tira essa dor de cabeça e abraça o costume da maioria das comunidades de RPG online.

O Mestre poderá estipular um "tema de cores" que será injetado no CSS em formato de variáveis para alterar sutilmente as cores principais das barras e menus de todos os participantes. O painel de Integração listará o link de invite para a call de voz escolhida, fornecendo aos usuários uma maneira unificada e imediata de começarem a falar na sessão assim que entrarem na campanha.

## 8. Sair

* **Objetivo**: Fechar a interface da campanha e retornar à tela inicial (fora do jogo).
* **Método**: Link ancorado no fundo da tela de navegação lateral ou superior que destrói a instância JS atual e redireciona (ou atualiza) para a listagem inicial do aplicativo web.
* **Resultados Esperados**: Finalização elegante da sessão para aquele usuário.
* **Possíveis Problemas Pós Implementação**: Necessário desabilitar listeners de eventos e desconectar explicitamente o Socket para evitar consumo de dados ou memória pelo navegador após sair.
* **Argumentação**: Todo fluxo de UI exige clareza nas opções de desistência.

O ato de sair da campanha enviará antes um alerta ao servidor informando que o usuário se desconectou e deverá aparecer como "Offline" na listagem de participantes da Aba Geral. Logo em seguida a tela retorna ao estado normal, pronta para o acesso à outra campanha se o usuário desejar.
