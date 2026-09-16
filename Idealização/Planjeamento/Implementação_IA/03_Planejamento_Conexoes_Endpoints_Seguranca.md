# 03 — Planejamento de Conexões Mínimas, Arquitetura de Endpoints e Segurança Rígida

Este documento formaliza o planejamento técnico da integração entre a interface web (**Cloudflare Pages**), o servidor serverless (**Cloudflare Workers**) e a camada de persistência (**Cloudflare D1 & KV**), priorizando a redução radical da superfície de ataque através de um número mínimo de endpoints e a aplicação de regras rigorosas de segurança em nível bancário/corporativo.

---

## 📋 Lista de Tópicos Resumidos

### Tópico 1: Arquitetura Minimalista de Endpoints (Estratégia Dual-Endpoint + WebSocket)
- **Objetivo**: Reduzir os pontos de entrada do backend ao menor número possível, eliminando dezenas de rotas REST fragmentadas e unificando o tráfego HTTP em apenas **dois endpoints** principais e **um canal de tempo real via WebSocket**.
- **Método**:
  1. `/api/auth` (HTTP POST): Roteia operações do ciclo de credenciais (`login`, `register`, `refresh`, `logout`).
  2. `/api/sync` (HTTP POST - Gateway Unificado / Command Pattern): Recebe requisições empacotadas para listagem, criação e atualização de entidades (Campanhas, Personagens, Perfil e Biblioteca) com validação de payload centralizada e despacho interno desacoplado.
  3. `/ws/room` (WebSocket Upgrade): Conexão bidirecional dedicada exclusivamente aos eventos da mesa de jogo em tempo real (rolagens, movimentação e chat), eliminando requisições HTTP repetitivas durante as partidas.
- **Resultados Esperados**: Superfície de exposição mínima para ataques externos, simplificação extrema do roteador do Worker e auditoria facilitada de tráfego.
- **Possíveis Problemas Pós-Implementação**: Necessidade de validação rigorosa de contrato/schema no payload de `/api/sync` para evitar ações maliciosas ou indefinidas.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: APIs REST tradicionais dispersam autenticação, middlewares e rate limit em dezenas de rotas (`/api/campaigns`, `/api/campaigns/:id`, `/api/characters`, etc.), multiplicando as chances de brechas e configurações incorretas de CORS/permissões. O padrão de gateway unificado centraliza a proteção em uma única guarita blindada.

---

### Tópico 2: Autenticação Criptográfica Forte e Gestão de Sessões (WebCrypto + JWT HttpOnly)
- **Objetivo**: Proteger as credenciais e o acesso aos recursos do sistema com técnicas criptográficas modernas, sem dependência de bibliotecas externas pesadas e imunes a ataques comuns (XSS, CSRF, roubo de token).
- **Método**:
  - Hashing de senhas via API nativa `crypto.subtle` (PBKDF2 com HMAC-SHA256, 100.000 iterações e salt aleatório criptograficamente seguro de 16 bytes por usuário).
  - Emissão de JSON Web Tokens (JWT) com algoritmo HMAC-SHA256, contendo payload mínimo (`sub` [ID], `role` [Jogador/Mestre/Admin], `exp` curto de 15 minutos).
  - Armazenamento do token de sessão exclusivamente em cookies com atributos `HttpOnly`, `Secure` e `SameSite=Strict`, tornando o token inacessível a qualquer script malicioso rodando no cliente (mitigação definitiva de XSS).
  - Refresh Tokens opacos armazenados em tabela dedicada no Cloudflare D1 com rotação automática a cada renovação de sessão e revogação imediata no logout.
- **Resultados Esperados**: Autenticação stateless de alta performance na borda, proteção contra vazamento de credenciais e segurança de sessão à prova de roubo de cookies.
- **Possíveis Problemas Pós-Implementação**: Em caso de expiração do token de 15 minutos durante uma partida, o cliente deve realizar a renovação silenciosa em segundo plano sem interromper a experiência do jogador.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Guardar JWT no `localStorage` do navegador é uma vulnerabilidade clássica a ataques XSS. O uso de cookies `HttpOnly; Secure; SameSite=Strict` garante isolamento pelo próprio navegador.

---

### Tópico 3: Camada de Persistência Segura (Cloudflare D1 com Prepared Statements & RLS Lógico)
- **Objetivo**: Assegurar integridade relacional e blindagem absoluta contra ataques de Injeção de SQL (SQLi) e Acesso Não Autorizado a Dados de Terceiros (IDOR).
- **Método**:
  - Uso obrigatório de *Prepared Statements* parametrizados em 100% das operações no Cloudflare D1 (`db.prepare('... WHERE id = ?').bind(id)`), com proibição estrita de qualquer interpolação ou concatenação de strings em SQL.
  - Implementação de Segurança em Nível de Linha (RLS - *Row-Level Security* lógico): Toda consulta de dados privados inclui compulsoriamente a cláusula `user_id = ?`, extraída diretamente do JWT validado no backend, e nunca de parâmetros enviados livremente pelo cliente.
  - Controle de Acesso Baseado em Papéis (RBAC): Validação das permissões no mestre e jogadores antes de qualquer mutação de mesa.
- **Resultados Esperados**: Impossibilidade matemática de SQL Injection, garantia de que nenhum jogador visualize ou edite fichas/campanhas alheias sem autorização expressa e integridade do banco.
- **Possíveis Problemas Pós-Implementação**: Complexidade moderada em queries que envolvem permissões compartilhadas (ex: um jogador convidado para uma campanha gerenciada por outro mestre).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O SQLite do Cloudflare D1 é extremamente veloz e seguro quando associado a prepared statements e RLS na camada de aplicação, dispensando ORMs complexos que diminuem a visibilidade do SQL executado.

---

### Tópico 4: Diretrizes Rígidas de Segurança de Borda (Headers, Rate Limiting e CORS)
- **Objetivo**: Bloquear abusos volumétricos, negação de serviço, clickjacking e tentativas de força bruta antes que consumam recursos do banco de dados.
- **Método**:
  - **Rate Limiting na Borda**: Limite estrito de 5 requisições por minuto por IP para o endpoint `/api/auth` (bloqueando ataques de dicionário e força bruta) e 60 requisições por minuto para `/api/sync`.
  - **CORS Restritivo**: Configuração de `Access-Control-Allow-Origin` estritamente apontando para o domínio oficial da aplicação no Cloudflare Pages (e portas autorizadas de desenvolvimento local), com `Access-Control-Allow-Credentials: true` e proibição de curingas (`*`).
  - **Cabeçalhos de Segurança HTTP Obrigatórios**:
    - `Content-Security-Policy (CSP)`: Restringe a execução de scripts apenas a fontes confiáveis e ao código interno da aplicação.
    - `X-Content-Type-Options: nosniff` (impede MIME-sniffing).
    - `X-Frame-Options: DENY` (previne clickjacking em iframes).
    - `Strict-Transport-Security (HSTS)`: Força o uso exclusivo de HTTPS com `includeSubDomains`.
    - `Referrer-Policy: strict-origin-when-cross-origin`.
  - **Limitação de Payload**: Rejeição imediata de qualquer requisição com corpo superior a 64KB, prevenindo exaustão de memória no runtime V8.
- **Resultados Esperados**: Proteção contra bots maliciosos, DDoS na camada de aplicação e conformidade com as diretrizes OWASP Top 10.
- **Possíveis Problemas Pós-Implementação**: Erros de CORS durante desenvolvimento local se o frontend estiver rodando em porta diferente sem prévia declaração nas variáveis de ambiente.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: A infraestrutura global de Edge da Cloudflare é o local ideal para filtrar tráfego hostil, protegendo o backend e reduzindo custos operacionais a zero.

---

## 🔍 Detalhamento dos Tópicos

### Detalhamento do Tópico 1 — O Padrão de Gateway Unificado (2 Endpoints + WebSocket)
Em vez de expor uma teia de rotas como `/api/v1/users/me`, `/api/v1/campaigns/123/players`, `/api/v1/sheets/456`, a aplicação adotará uma arquitetura inspirada em RPC (Remote Procedure Call) unificado. O endpoint `/api/sync` aceita um objeto JSON padronizado: `{ action: "categoria.metodo", data: { ... } }`. Ao receber a requisição, o Cloudflare Worker passa por um funil único de segurança: (1) verificação do cookie de autenticação, (2) verificação do rate limit, (3) sanitização do payload e (4) roteamento interno para a função controladora correspondente (`campaigns.create`, `characters.list`, `profile.update`). Para o jogo em si, a abertura de mesa conecta o cliente ao `/ws/room?campaignId=XYZ`, estabelecendo o túnel WebSocket persistente onde ocorrem as transmissões bidirecionais efêmeras. Essa estratégia corta em mais de 80% o número de rotas necessárias, facilitando a manutenção e testes.

### Detalhamento do Tópico 2 — Protocolo Criptográfico Nativo (WebCrypto)
A Cloudflare Workers suporta nativamente a API WebCrypto do W3C (`crypto.subtle`), o que dispensa a importação de bibliotecas externas pesadas como `bcrypt` ou `jsonwebtoken`. O processo de hashing de senhas utiliza `PBKDF2` com derivação de chave SHA-256 e salting individual de alta entropia. O JWT gerado é assinado com uma chave secreta injetada via Cloudflare Secrets (`JWT_SECRET`), garantindo que qualquer tentativa de alteração do payload pelo cliente invalide a assinatura instantaneamente. O envio e leitura via cookie com atributos `HttpOnly; Secure; SameSite=Strict` garante que extensões maliciosas de navegador ou códigos injetados não consigam ler o token nem sequestrar a sessão do usuário.

### Detalhamento do Tópico 3 — Segurança do Cloudflare D1 e RLS Lógico
O banco de dados Cloudflare D1 será desenhado com chaves estrangeiras (`FOREIGN KEY`) estritas e índices otimizados para consultas por `user_id` e `campaign_id`. A integridade dos dados repousa sobre a premissa de que o ID do usuário operante é uma verdade inviolável extraída do JWT verificado. Portanto, uma requisição do tipo `{ action: "characters.delete", data: { id: "char_123" } }` é convertida no SQL seguro: `DELETE FROM characters WHERE id = ? AND user_id = ?`. Caso o usuário não seja o proprietário daquela ficha, zero linhas são afetadas, eliminando por completo vulnerabilidades de autorização horizontal.

### Detalhamento do Tópico 4 — Blindagem de Borda e Prevenção de Abusos
Todo pacote HTTP que atinge o Worker é inspecionado antes mesmo de tocar a lógica de negócios. O cabeçalho de Content-Length é avaliado para barrar uploads desproporcionais. Tentativas repetidas de login sem sucesso ativam um temporizador progressivo que bloqueia temporariamente requisições oriundas daquele identificador. Adicionalmente, as respostas do servidor incluem todos os cabeçalhos recomendados pelas diretrizes de segurança da OWASP, impedindo que o site seja incorporado em páginas externas ou que recursos sejam carregados de fontes não autorizadas.

---

## 🗂️ Mapeamento Detalhado de Pastas e Arquivos Previstos

Para a futura fase de implementação dessas conexões e segurança, a estrutura técnica envolverá os seguintes arquivos:

```text
Código/
├── Backend/
│   ├── wrangler.toml                    # Configuração do Worker, bindings do D1/KV e variáveis de ambiente
│   ├── package.json                     # Scripts de desenvolvimento e testes do Worker
│   └── src/
│       ├── index.js                     # Ponto de entrada do Worker (roteamento das 2 rotas HTTP e do WebSocket)
│       ├── config/
│       │   ├── securityHeaders.js       # Definição e injeção de headers de segurança (CSP, HSTS, CORS)
│       │   └── limits.js                # Regras e limites de payload, rate-limiting e timeouts
│       ├── middleware/
│       │   ├── authMiddleware.js        # Validação do cookie HttpOnly JWT e injeção do usuário autenticado
│       │   ├── rateLimiter.js           # Controle de frequência de requisições na borda (Cloudflare KV/Durable)
│       │   └── validator.js             # Sanitização e validação de schema do payload de entrada
│       ├── services/
│       │   ├── cryptoService.js         # Hashing com WebCrypto (PBKDF2/HMAC-SHA256) e manipulação de JWT
│       │   ├── authService.js           # Lógica de login, cadastro, refresh token e logout
│       │   ├── syncService.js           # Despachante interno das ações de Campanhas, Personagens e Perfil
│       │   └── roomService.js           # Gerenciador do ciclo de conexões WebSocket da mesa
│       └── db/
│           └── queries.js               # Consultas seguras com prepared statements e RLS para o D1
│
├── Banco/
│   ├── schema.sql                       # DDL das tabelas relacionais do Cloudflare D1 (users, sessions, campaigns, characters)
│   └── migrations/
│       └── 0001_initial_schema.sql      # Primeira migração versionada do banco D1
│
└── FrontEnd/
    └── js/
        └── api/
            └── client.js                # Cliente HTTP unificado do frontend com tratamento transparente de sessão e erros
```

---

## 📌 Próximos Passos

1. Submeter este plano técnico ao controle de versão (Git commit e push).
2. Aguardar a leitura, considerações e o aval explícito do autor sob a etiqueta **`#> Implementação`** para iniciar a codificação da infraestrutura de backend, esquemas do banco e conexões seguras.
