# 01 — Definindo a Stack Tecnológica e Arquitetura Base

Este documento estabelece o planejamento técnico inicial para a definição da stack tecnológica, padrões de comunicação e mapeamento da estrutura de pastas e arquivos do projeto **RetroForge VTT**, em conformidade com as diretrizes do autor.

---

## 📋 Lista de Tópicos Resumidos

### Tópico 1: Interface e Frontend (HTML5 + JavaScript Modular + Tailwind CSS)
- **Objetivo**: Fornecer uma interface web rápida, de fácil leitura e compreensão, permitindo renderização eficiente do Grid 2D e das Telas de Cena sem a complexidade de frameworks de caixa-preta.
- **Método**: Utilizar HTML5 semântico, CSS gerenciado via Tailwind CSS CLI (já presente no projeto) e JavaScript puro estruturado em módulos (ES Modules nativos do navegador).
- **Resultados Esperados**: Carregamento instantâneo, total transparência do código para o autor, controle total do DOM e separação clara entre renderização e estado.
- **Possíveis Problemas Pós-Implementação**: Necessidade de organizar manualmente a reatividade e a sincronização do estado visual caso novos painéis e telas sejam adicionados sem uma convenção prévia.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Frameworks pesados (como React, Angular ou Next.js) adicionam camadas extras de abstração, bundle e dependências que dificultam a leitura direta e o controle granular do código pretendido pelo autor. O uso de HTML + ES Modules oferece clareza máxima e longevidade.

---

### Tópico 2: Backend e Lógica Autoritária (Node.js com Cloudflare Workers)
- **Objetivo**: Criar uma camada de backend serverless autoritária para validação de turnos, controle de regras de combate e gerenciamento de sessões, operando com custo quase nulo e latência mínima.
- **Método**: Desenvolver em JavaScript/Node.js compatível através do Cloudflare Workers, configurado e executado localmente e em nuvem via ferramenta oficial `wrangler`.
- **Resultados Esperados**: APIs rápidas distribuídas na borda (Edge), processamento serverless sem custos fixos de servidor e validação centralizada das ações críticas dos jogadores.
- **Possíveis Problemas Pós-Implementação**: Limitações pontuais de compatibilidade com módulos nativos C++ de Node.js (embora a flag `nodejs_compat` da Cloudflare atenda a todas as bibliotecas e utilitários modernos em JS puro).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Descartam-se servidores dedicados caros (como EC2/VPS) e BaaS como Firebase (que geram custos crescentes e dependência de vendor lock-in). O Cloudflare Workers oferece integração nativa com o resto da infraestrutura do projeto, respeitando a diretriz de hospedar tudo na Cloudflare.

---

### Tópico 3: Multiplayer e Tempo Real (WebSockets na Cloudflare)
- **Objetivo**: Prover comunicação bidirecional contínua entre mestre e jogadores para atualização em tempo real de posições no mapa, eventos de dados, turnos e mensagens.
- **Método**: Implementar manipuladores de WebSocket via Cloudflare Workers (utilizando a API de WebSockets da Cloudflare com modelo de hibernação ou Durable Objects para gerenciamento de salas/partidas).
- **Resultados Esperados**: Latência imperceptível, conexões estáveis, sincronização imediata de eventos e descarte de requisições repetitivas de pooling.
- **Possíveis Problemas Pós-Implementação**: Necessidade de tratamento rigoroso para reconexão automática em caso de instabilidade na rede do jogador e controle de concorrência na mesma sala.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O polling HTTP tradicional (`fetch` a cada segundo) gera alto consumo, atrasos visíveis e sobrecarga inútil. WebSockets mantêm um canal aberto e eficiente, permitindo trafegar somente deltas de dados essenciais ("só persistir e transmitir o que importa").

---

### Tópico 4: Persistência de Dados e Banco (Cloudflare D1 + Cloudflare KV)
- **Objetivo**: Armazenar dados relacionais (usuários, campanhas, histórico crítico) e dados estáticos/compêndio (fichas de monstros, tabelas de itens e regras) com alta performance.
- **Método**: Empregar o Cloudflare D1 (banco de dados relacional baseado no SQLite nativo) para estruturas relacionais e Cloudflare KV (chave-valor) para armazenamento e cache de compêndios JSON.
- **Resultados Esperados**: Consultas SQL simples, familiares e legíveis; respostas ultra-rápidas para consulta de compêndio e custo zero para o volume inicial de dados.
- **Possíveis Problemas Pós-Implementação**: O D1 opera com um modelo SQLite serverless que requer consultas bem estruturadas para evitar concorrência desnecessária em escritas simultâneas.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O SQLite é o formato de banco mais compreensível, portátil e testado do mundo. A integração com o D1 mantém tudo dentro da Cloudflare sem necessidade de gerenciar instâncias de PostgreSQL/MySQL nem pagar planos caros de bancos gerenciados.

---

## 🔍 Detalhamento dos Tópicos

### Detalhamento do Tópico 1 — Frontend (HTML5, JS Modular e Tailwind CSS)
O frontend será centralizado em uma estrutura transparente. A interface visual será composta por páginas HTML limpas e modulares, aproveitando utilitários do Tailwind CSS para manter o design responsivo, moderno e esteticamente agradável sem a proliferação desordenada de regras CSS manuais. No JavaScript, adotaremos módulos ES6 puros (arquivos `.js` importados nativamente pelo navegador através de `<script type="module">`). Essa abordagem divide a aplicação em submódulos claros (como motor de renderização do grid, gerenciador de estado da cena e cliente de rede), garantindo que qualquer desenvolvedor ou o próprio autor consiga abrir qualquer arquivo e compreender o fluxo lógico imediatamente, sem etapas intermediárias de compilação opaca.

### Detalhamento do Tópico 2 — Backend Autoritário (Cloudflare Workers / Node.js)
O backend funcionará como o árbitro absoluto da partida. Seguindo o princípio da idealização onde "o cliente faz o máximo possível e o backend decide o que é importante", o servidor não processará cada pixel percorrido por um token, mas sim validará se o movimento para a célula destino é legal, se o personagem possui pontos de ação suficientes e se o dano infligido é legítimo. A infraestrutura do Cloudflare Workers utiliza o runtime V8 com compatibilidade oficial para APIs do Node.js, viabilizando o uso de sintaxes padrão como `crypto`, `buffer` e `events`. O gerenciamento de rotas e lógica será organizado em controladores pequenos e modulares, garantindo desacoplamento e facilidade de depuração.

### Detalhamento do Tópico 3 — Comunicação Multiplayer em Tempo Real
O multiplayer eficiente exige uma arquitetura de salas (Rooms). Cada campanha ou sessão de jogo terá um identificador único de sala. Quando um jogador se conecta via WebSocket, o Cloudflare Worker o associa à sala correspondente. Sempre que o mestre alterar a cena, um jogador rolar um dado ou o turno passar, o backend valida o evento e propaga o pacote de dados apenas para os participantes daquela sessão. Para garantir robustez ("sem erros"), será implementado um protocolo de mensagens com tipagem clara (ex: `action: "MOVE_TOKEN"`, `action: "NEXT_TURN"`), confirmação de recebimento (ACK) e reconexão silenciosa caso o jogador perca temporariamente o sinal de internet.

### Detalhamento do Tópico 4 — Banco de Dados e Compêndio
A persistência dividirá os dados em duas naturezas: frios (estáticos) e quentes (dinâmicos). O compêndio base (monstros padrão, tabelas de armas, magias e regras no-code) residirá em arquivos JSON pré-estruturados e cacheados via Cloudflare KV, permitindo leitura praticamente instantânea. Por outro lado, o progresso real dos jogadores, fichas modificadas, mapas salvos e permissões de usuários serão persistidos em tabelas relacionais no Cloudflare D1 através de comandos SQL legíveis e convencionais (`SELECT`, `INSERT`, `UPDATE`). Essa divisão garante que o banco de dados não sofra sobrecarga de leitura com informações que raramente mudam.

---

## 🗂️ Mapeamento Detalhado de Pastas e Arquivos Previstos

Abaixo está o mapeamento dos arquivos e pastas que serão estruturados ao longo do projeto, detalhando a função específica de cada item:

```text
Código/
├── FrontEnd/
│   ├── index.html                    # Ponto de entrada visual e estrutura das telas de jogo
│   ├── css/
│   │   ├── input.css                 # Arquivo base com diretivas do Tailwind CSS
│   │   └── style.css                 # CSS final compilado e pronto para consumo pelo HTML
│   └── js/
│       ├── main.js                   # Script principal de inicialização da interface
│       ├── state.js                  # Gerenciamento do estado local da sessão no cliente
│       ├── grid/
│       │   ├── gridRenderer.js       # Responsável por desenhar as células do mapa e tokens
│       │   └── gridController.js     # Captura cliques, toques e movimentações do jogador no grid
│       ├── scenes/
│       │   └── sceneController.js    # Gerencia a exibição e eventos das telas narrativas (cenas)
│       └── network/
│           └── socketClient.js       # Conexão WebSocket, envio de ações e recebimento de atualizações
│
├── Backend/
│   ├── wrangler.toml                 # Configuração oficial do Cloudflare Workers, rotas e bindings
│   ├── package.json                  # Dependências e scripts do serviço backend
│   └── src/
│       ├── index.js                  # Ponto de entrada do Worker (roteador HTTP e upgrade de WebSocket)
│       ├── config/
│       │   └── constants.js          # Constantes globais (limites de mapa, turnos, papéis de usuário)
│       ├── rooms/
│       │   └── roomManager.js        # Gerenciamento de conexões ativas por sala de jogo
│       ├── rules/
│       │   ├── turnController.js     # Máquina de estados para turnos e iniciativa
│       │   └── validator.js          # Validação de regras e autoridade de ações
│       └── handlers/
│           ├── authHandler.js        # Tratamento de autenticação e papéis de usuário
│           └── compendiumHandler.js  # Rotas de consulta e entrega de compêndios
│
└── Banco/
    ├── schema.sql                    # Estrutura das tabelas relacionais do Cloudflare D1
    └── seeds/
        ├── compendium_initial.json   # Dados padrão iniciais (itens, monstros e habilidades)
        └── seed.sql                  # Script SQL para inserção de dados iniciais de teste
```

---

## 📌 Próximos Passos
1. Aguardar a revisão e aval explícito do autor sobre este documento de planejamento.
2. Com o aval concedido, elaborar o plano `02_...` para definir a arquitetura de dados e o modelo de mensagens em tempo real (Multiplayer) ou prosseguir conforme prioridade designada pelo autor.
