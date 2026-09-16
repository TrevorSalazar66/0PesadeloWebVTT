# 06 — Planejamento da Criação de Perfil Pós-Verificação, Estrutura de Dados e Sistema Hierárquico de Permissões

Este documento formaliza o planejamento técnico e arquitetural da lógica pós-verificação de e-mail (ou pós-primeiro login via Google OAuth). Define o fluxo obrigatório de transição para a tela de **"Criação de Perfil de Aventureiro"**, a modelagem dos dados no banco Cloudflare D1 (SQLite), a validação dos campos obrigatórios e contatos opcionais, e a implementação da base do sistema de permissões fundamentado em 5 categorias de usuários (`jogador`, `assistente de mestre`, `mestre`, `admin`, `superadmin`).

---

## 📋 Lista de Tópicos Resumidos

### Tópico 1: Interceptação de Acesso e Redirecionamento Obrigatório de Onboarding

- **Objetivo**: Garantir que nenhum usuário acerte o login ou confirme o e-mail e consiga navegar na Taverna sem antes definir sua identidade de aventureiro (nome, nickname, faixa etária e bio).
- **Método**:
  - Adição do atributo de controle `profile_completed INTEGER NOT NULL DEFAULT 0` vinculado à conta do usuário.
  - Ao validar o código de 6 dígitos no endpoint `/api/auth` (ou ao processar o primeiro acesso via Google), o backend identifica `profile_completed === 0` e devolve no payload a instrução mandatória `{ requerCriacaoPerfil: true }`.
  - Os gateways de dados (`/api/sync` e `/ws/room`) aplicam uma barreira de segurança no middleware: qualquer requisição com sessão ativa onde `profile_completed === 0` recebe `HTTP 403 Forbidden` com código `PROFILE_INCOMPLETE`, liberando apenas a ação de submissão do perfil.
- **Resultados Esperados**: Fluxo blindado e sem brechas; 100% dos usuários ativos na plataforma terão apelido, dados básicos e permissões devidamente inicializadas.
- **Possíveis Problemas Pós-Implementação**: Usuário fechar a aba no meio do preenchimento (mitigado: no próximo login, a flag continuará 0 e o sistema o forçará novamente para a tela de perfil).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Deixar o perfil opcional ou para depois causa inconsistências em mesas, chat e fichas (exibindo usuários sem nome ou apelido que quebram a interface).

---

### Tópico 2: Modelagem e Persistência do Perfil no Cloudflare D1 (SQLite)

- **Objetivo**: Armazenar com integridade e eficiência as informações de perfil, separando dados cadastrais confidenciais de dados públicos do aventureiro e estruturando contatos e mídias.
- **Método**:
  - Criação da tabela relacional `user_profiles` no D1 (chave estrangeira `user_id` vinculada a `users(id)` com `ON DELETE CASCADE`):
    - `user_id TEXT PRIMARY KEY`
    - `name TEXT NOT NULL` (Nome completo ou público de exibição)
    - `nickname TEXT UNIQUE NOT NULL COLLATE NOCASE` (Apelido único no sistema para menções e convites)
    - `age_group TEXT NOT NULL` (Faixa etária declarada)
    - `bio TEXT NOT NULL` (Apresentação livre com limite estrito de caracteres)
    - `contacts TEXT NOT NULL DEFAULT '{}'` (Array/objeto JSON estruturado com contatos opcionais: `whatsapp`, `discord`, `instagram`)
    - `avatar_url TEXT NOT NULL DEFAULT ''` (Estrutura reservada para foto de perfil)
    - `banner_url TEXT NOT NULL DEFAULT ''` (Estrutura reservada para banner temático)
    - `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`
  - Índice de alta performance `idx_profiles_nickname` para pesquisas rápidas e garantia de apelidos exclusivos.
- **Resultados Esperados**: Organização limpa, campos opcionais agrupados sem poluir colunas nulas no banco e suporte nativo a buscas velozes por apelido.
- **Possíveis Problemas Pós-Implementação**: Tentativa de registrar apelidos duplicados em concorrência (tratado com restrição `UNIQUE` no banco e retorno amigável "Este nickname já está em uso").
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Criar uma tabela relacional própria (`user_profiles`) mantém a tabela `users` enxuta para autenticação rápida e isola as informações públicas e sociais do aventureiro.

---

### Tópico 3: Base do Sistema de Permissões e Categorias de Usuários (`categoriaDeUser`)

- **Objetivo**: Estabelecer a infraestrutura de permissões da Taverna, padronizando os 5 níveis hierárquicos e garantindo que toda conta criada inicie estritamente na categoria base.
- **Método**:
  - Atualização da restrição de integridade na tabela `users`:
    `CHECK (role IN ('jogador', 'assistente de mestre', 'mestre', 'admin', 'superadmin'))`
  - Regra de criação: Todo novo usuário é inserido com `role = 'jogador'`.
  - Matriz inicial de capacidades no backend:
    1. `jogador`: Visualizar mesas públicas, entrar em campanhas mediante convite, criar e editar as próprias fichas de personagens, rolar dados.
    2. `assistente de mestre`: Todas as ações de jogador + gerenciar iniciativa, mover tokens auxiliares e controlar fichas de PNJs concedidas pelo mestre.
    3. `mestre`: Todas as ações de assistente + criar e mestrar campanhas, importar mapas/sistemas, banir jogadores de sua mesa, definir assistentes.
    4. `admin`: Moderação global da plataforma, análise de denúncias, gestão de bloqueios de segurança e travas de dispositivos anti-Sybil.
    5. `superadmin`: Autoridade máxima do sistema; único nível autorizado a alterar a categoria de outros usuários (promover/rebaixar admins e mestres), acesso irrestrito às configurações e banco.
- **Resultados Esperados**: Arquitetura pronta para controle de acesso baseado em papéis (RBAC) robusto, expansível e sem riscos de privilégios indevidos na criação de contas.
- **Possíveis Problemas Pós-Implementação**: Usuário tentar manipular a requisição para enviar uma categoria superior (mitigado: a ação de salvar perfil não aceita o parâmetro de role vindo do frontend, mantendo sempre a categoria vigente).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Definir os papéis desde o nascimento do perfil evita refatorações complexas quando as funcionalidades de mestre e assistente de mestre forem implementadas no VTT.

---

### Tópico 4: Endpoint e Ação de Conclusão de Perfil (`profile.setup`) e Validação

- **Objetivo**: Processar os dados enviados pelo formulário, higienizar entradas contra ataques XSS e injetar o perfil finalizado no banco, atualizando o token de sessão.
- **Método**:
  - No gateway `/api/sync`, implementação da ação controlada `profile.setup`:
    1. Valida presença e limites de `name` (2 a 60 caracteres) e `nickname` (3 a 25 caracteres alfanuméricos).
    2. Valida o tamanho da `bio` (limite máximo de 500 caracteres).
    3. Valida a `age_group` contra valores permitidos.
    4. Sanitiza os contatos opcionais: se preenchidos, valida formatos básicos de WhatsApp (apenas dígitos com DDD), Discord (nome de usuário) e Instagram (@handle); caso vazios, grava string vazia.
    5. Grava os registros em transação atômica no D1: insere em `user_profiles` e executa `UPDATE users SET display_name = ?, profile_completed = 1 WHERE id = ?`.
    6. Emite um novo Cookie JWT com `profileCompleted: 1`, liberando imediatamente o acesso aos demais recursos da Taverna.
- **Resultados Esperados**: Sanitização completa, proteção de integridade e resposta instantânea para a interface.
- **Possíveis Problemas Pós-Implementação**: Caracteres especiais maliciosos na Bio (mitigado com escape de HTML e sanitização no backend).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Executar a ação pelo gateway seguro `/api/sync` reaproveita toda a proteção de rate limit, auditoria e autenticação já construída nas etapas anteriores.

---

### Tópico 5: Interface Temática de Criação de Perfil no FrontEnd (Onboarding)

- **Objetivo**: Oferecer uma tela de acolhimento imersiva, elegante e condizente com a estética dark fantasy da taverna para que o aventureiro preencha seus dados de forma intuitiva.
- **Método**:
  - No `index.html`, criação da view de Onboarding `#view-profile-setup`:
    - Título temático: *"Forje sua Identidade de Aventureiro"*.
    - Campos obrigatórios destacados com runas douradas: Nome, Nickname (com `@` prefixado), Seletor de Faixa Etária e Bio (com contador regressivo dinâmico `500/500`).
    - Seção expansível ou integrada de Contatos Opcionais: Ícones temáticos de WhatsApp, Discord e Instagram com placeholders exemplificativos.
    - Área de Avatar e Banner: Mostruário com molduras heráldicas vazias exibindo *"Em breve: Personalização de Estandarte e Brasão"*.
    - Botão nobre de ação: *"Concluir e Adentrar a Taverna"*.
  - Transição suave acionada assim que o modal de código de 6 dígitos confirma o sucesso.
- **Resultados Esperados**: Primeira impressão marcante, clareza no que é obrigatório versus opcional e nenhum atrito de navegação.
- **Possíveis Problemas Pós-Implementação**: Interface ficar muito longa em telas de celular (mitigado com design responsivo em grid e scroll suave).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Apresentar o formulário com o mesmo padrão visual de alta qualidade do restante da aplicação valoriza o produto e engaja o jogador desde os primeiros segundos.

---

## 🔍 Detalhamento dos Tópicos

### Detalhamento do Tópico 1 — O Mecanismo de Interceptação

O processo de autenticação é dividido em dois estágios: a *Verificação de Credenciais* e a *Conclusão de Perfil*. Quando o usuário submete os 6 dígitos válidos em `/api/auth`, o backend atualiza `email_verified = 1`, mas mantém `profile_completed = 0`. O token JWT provisório emitido contém o payload `{ sub: userId, role: 'jogador', profileCompleted: 0 }`. Ao receber esse retorno, a camada de controle do frontend remove os modais de login e abre a tela cheia de criação de perfil. Se o usuário tentar burlar a interface e fazer chamadas diretas para listar campanhas ou entrar em salas, o middleware de autenticação verifica o claim `profileCompleted`: se for zero, aborta a execução imediatamente, garantindo segurança a nível de servidor.

### Detalhamento do Tópico 2 — Estrutura e Normalização no D1

A separação dos dados entre `users` (dados de autenticação, e-mail, hash de senha, status de verificação, role) e `user_profiles` (dados públicos, apelido, faixa etária, contatos, bio, mídias) segue as melhores práticas de arquitetura limpa. O campo `contacts` é serializado como uma string JSON contendo as chaves `{ "whatsapp": "", "discord": "", "instagram": "" }`, atendendo à exigência de guardar essas informações estruturadas sem a necessidade de criar tabelas excessivas para simples links de redes sociais. A restrição `COLLATE NOCASE` no campo `nickname` assegura que `@Guerreiro` e `@guerreiro` sejam considerados o mesmo usuário, evitando clonagem de identidade.

### Detalhamento do Tópico 3 — Hierarquia e Integridade de Cargos

A categoria de usuário governa todo o ecossistema de permissões. A definição estrita das 5 categorias (`jogador`, `assistente de mestre`, `mestre`, `admin`, `superadmin`) atende ao ciclo de vida completo de uma comunidade de RPG virtual. Para assegurar que o backend seja a autoridade suprema, a rota de criação de perfil não aceita parâmetros de categoria vindos do cliente; o valor inicial é gravado de forma imutável no banco com `'jogador'`. Futuras promoções a 'mestre' ou 'assistente de mestre' serão tratadas pelo fluxo de mesas ou pelo painel do `superadmin`.

### Detalhamento do Tópico 4 — Validações de Entrada e Segurança de Dados

O endpoint aplica validações rigorosas: o apelido deve respeitar a expressão regular `/^[a-zA-Z0-9_]{3,25}$/` (impedindo espaços, símbolos que quebrem URLs e caracteres invisíveis); a Bio passa por um sanitizador que remove tags HTML (proteção contra Stored XSS) e valida o limite de 500 caracteres. Caso algum contato opcional seja preenchido, os números de telefone são filtrados para aceitar apenas formato internacional/nacional válido e os nomes de usuário do Discord/Instagram são limpos de URLs maliciosas.

### Detalhamento do Tópico 5 — Experiência do Usuário (UX) no FrontEnd

A interface de criação de perfil é montada no próprio `index.html`, mantendo a arquitetura SPA leve e ultrarrápida sem recarregamento de página. O campo de bio conta com um listener em tempo real que atualiza a quantidade de caracteres restantes, mudando de cor quando se aproxima do limite. A transição da tela de confirmação de e-mail para a de perfil ocorre de maneira natural, com feedback visual imediato de sucesso e animação de abertura da nova ficha.

---

## 🗂️ Mapeamento Detalhado de Pastas e Arquivos Previstos

Para a execução deste plano na fase de implementação, os seguintes arquivos serão modificados ou criados:

```text
Código/
├── Banco/
│   └── schema.sql                                     # [MODIFICAR] Adição da tabela user_profiles e atualização do CHECK de roles na tabela users
├── Backend/
│   └── src/
│       ├── db/
│       │   └── queries.js                             # [MODIFICAR] Novas queries: createUserProfile, getUserProfile, getProfileByNickname, completeUserProfile
│       ├── services/
│       │   ├── authService.js                         # [MODIFICAR] Atualização das respostas de login e verify_email para sinalizar profile_completed
│       │   ├── syncService.js                         # [MODIFICAR] Adição da ação profile.setup e controle de permissões por categoria
│       │   └── googleAuthService.js                   # [MODIFICAR] Integração do fluxo de primeiro login via Google com o status de perfil incompleto
│       └── middleware/
│           └── authMiddleware.js                      # [MODIFICAR] Verificação de barreira para profile_completed === 1
└── FrontEnd/
    ├── index.html                                     # [MODIFICAR] Estrutura HTML e CSS temático do painel de Criação de Perfil
    └── js/
        └── api/
            └── client.js                              # [MODIFICAR] Método setupProfile({ name, nickname, ageGroup, contacts, bio })
```

---

## ❓ Pontos de Confirmação de Regras de Negócio

Para alinhamento final antes do início da implementação de código:

1. **Limite da Bio**: Estipulado no plano em **500 caracteres** (ideal para apresentação sem poluir a interface).
2. **Faixas Etárias Sugeridas**:
   - Menor de 14 anos (`-14`)
   - 14 a 17 anos (`14-17`)
   - 18 a 24 anos (`18-24`)
   - 25 a 34 anos (`25-34`)
   - 35 anos ou mais (`35+`)
3. **Nickname**: Único no sistema, de 3 a 25 caracteres (apenas letras, números e underlines).
4. **Permissão de Alteração de Cargo**: Apenas o `superadmin` terá poderes para elevar ou alterar categorias de usuários no sistema.
