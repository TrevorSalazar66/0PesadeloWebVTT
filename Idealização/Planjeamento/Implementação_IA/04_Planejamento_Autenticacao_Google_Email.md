# 04 — Planejamento da Autenticação Híbrida: Google OAuth 2.0, Validação de E-mail e Unificação de Contas

Este documento detalha o planejamento técnico formal para a implementação do sistema completo de autenticação e criação de contas do **Arcana VTT / RetroForge VTT**, integrando o **Google OAuth 2.0 (100% gratuito)** com o fluxo tradicional de **E-mail e Senha com Verificação de E-mail Real**, banco de dados Cloudflare D1 e unificação automática de contas.

---

## 📋 Lista de Tópicos Resumidos

### Tópico 1: Integração com Google OAuth 2.0 Nativo no Cloudflare Worker
- **Objetivo**: Permitir que aventureiros entrem na taverna com apenas um clique utilizando sua conta do Google, de forma 100% gratuita, sem intermediários pagos e com e-mail pré-verificado pelo Google.
- **Método**:
  - Utilizar o fluxo padrão de autorização OAuth 2.0 (OpenID Connect) implementado diretamente no Cloudflare Worker com a API nativa `fetch`:
    1. Rota de início: `GET /api/auth/google/redirect` gera o link oficial do Google com `client_id`, `redirect_uri`, escopos (`openid`, `email`, `profile`) e um token aleatório criptográfico `state` (armazenado em cookie efêmero para proteção estrita contra CSRF).
    2. Rota de callback: `GET /api/auth/google/callback` valida o `state`, troca o código de autorização (`code`) pelo token de acesso na API do Google e obtém os dados cadastrais (`sub`, `email`, `name`, `picture`).
    3. Cadastra ou vincula o usuário no D1 e emite o cookie de sessão seguro `arcana_session` (`HttpOnly; Secure; SameSite=Strict`).
- **Resultados Esperados**: Experiência de login fluida, sem necessidade de memorizar senhas, custo operacional R$ 0,00 e sem limites de usuários.
- **Possíveis Problemas Pós-Implementação**: Necessidade de configurar as credenciais (`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`) no Google Cloud Console com as URIs de redirecionamento autorizadas.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O Google OAuth 2.0 é totalmente gratuito para autenticação. A Cloudflare possui o *Cloudflare Access*, mas ele é desenhado para redes corporativas fechadas (Zero Trust), e não para permitir que qualquer usuário da internet crie conta em um jogo. O fluxo nativo no Worker é a solução canônica e recomendada.

---

### Tópico 2: Cadastro por E-mail e Senha com Verificação Real via Código OTP (6 dígitos)
- **Objetivo**: Assegurar que contas criadas manualmente pertençam a donos de e-mails reais e ativos, evitando contas fantasmas, robôs ou cadastros com e-mails forjados.
- **Método**:
  - Quando um aventureiro preenche o formulário de cadastro com e-mail e senha:
    1. A senha é cifrada com `PBKDF2` (100.000 iterações), e a conta é criada no Cloudflare D1 com a flag `email_verified = 0`.
    2. É gerado um código numérico aleatório de 6 dígitos (alta entropia via `crypto.getRandomValues`) gravado em uma tabela temporária `email_verifications` com validade de 10 minutos e contador de tentativas.
    3. **Envio de e-mail**: Uma função de despacho envia o código para a caixa de entrada do usuário via API transacional gratuita (ex: Resend, que oferece 3.000 envios/mês gratuitos). No ambiente de testes e desenvolvimento local, o código é exibido no console do servidor e em notificação toast na interface para possibilitar testes imediatos.
    4. O usuário digita o código de 6 dígitos no frontend; a ação `/api/auth` (`verify_email`) valida o código, marca `email_verified = 1` e emite a sessão definitiva.
- **Resultados Esperados**: Blindagem contra contas falsas, garantia de que o e-mail cadastrado recebe mensagens reais e possibilidade de recuperação de senha segura no futuro.
- **Possíveis Problemas Pós-Implementação**: E-mails de confirmação caindo na caixa de spam do destinatário caso o domínio não tenha registros SPF/DKIM configurados (em produção).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O código de 6 dígitos oferece a melhor usabilidade em dispositivos móveis e desktops, eliminando a quebra de aba causada por links mágicos longos.

---

### Tópico 3: Unificação de Contas e Evolução da Estrutura no Cloudflare D1
- **Objetivo**: Permitir que o mesmo aventureiro possa entrar na taverna tanto com sua senha quanto com o botão do Google, vinculando os dados à mesma conta sem duplicar personagens ou campanhas.
- **Método**:
  - Adicionar à tabela `users` do Cloudflare D1 os campos:
    - `google_id TEXT UNIQUE`: Armazena o identificador único fornecido pelo Google.
    - `avatar_url TEXT`: Foto de perfil (pode ser herdada do Google ou definida pelo jogador).
    - `email_verified INTEGER DEFAULT 0`: `1` para e-mails confirmados e `0` para pendentes.
    - `auth_provider TEXT DEFAULT 'email'`: Identifica a origem do cadastro (`'email'`, `'google'`, ou `'both'`).
  - Criar a tabela `email_verifications`:
    - `id TEXT PRIMARY KEY`, `email TEXT NOT NULL`, `code_hash TEXT NOT NULL`, `expires_at DATETIME NOT NULL`, `attempts INTEGER DEFAULT 0`.
  - Lógica de Vínculo: Se um usuário já existe com `joao@gmail.com` e efetua login com o Google, o backend valida o e-mail, salva o `google_id` correspondente na mesma linha e unifica a conta automaticamente.
- **Resultados Esperados**: Zero duplicação de dados, histórico de campanhas e personagens preservado independentemente de como o aventureiro decidir fazer login.
- **Possíveis Problemas Pós-Implementação**: Evitar que uma conta criada com e-mail não verificado seja sequestrada por login OAuth falso (resolvido garantindo que o Google só unifique se `email_verified = true` no Google).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Modelos com contas separadas por método de login geram frustração para os jogadores, que acabam criando duas contas sem querer e perdem o acesso às suas fichas.

---

### Tópico 4: Atualização Visual da Tela de Autenticação no FrontEnd
- **Objetivo**: Integrar os novos métodos de acesso à interface dark fantasy sem quebrar a elegância e a imersão da taverna.
- **Método**:
  - No card "Entrar na taverna" do `index.html`:
    - Inserir o botão nobre **"Entrar com o Google"** estilizado com o ícone oficial multicolorido do Google sobre fundo escuro com bordas douradas sutis.
    - Adicionar um divisor elegante *"ou continue com e-mail"*.
    - Criar o painel/modal de inserção dos 6 dígitos para ativação imediata pós-cadastro.
- **Resultados Esperados**: Interface intuitiva, moderna e alinhada aos padrões dos maiores aplicativos web.
- **Possíveis Problemas Pós-Implementação**: Manter o design harmônico e compacto para telas de smartphones.
- **Argumentação do Porquê Usar Esse Método e Não Outros**: O padrão com botão social no topo seguido de divisor e formulário tradicional é a convenção mais reconhecida por usuários em todo o mundo.

---

## 🔍 Detalhamento dos Tópicos

### Detalhamento do Tópico 1 — Funcionamento do Google OAuth 2.0 Serverless
O Google OAuth 2.0 não requer custos, servidores dedicados nem SDKs proprietários pesados. Quando o aventureiro clica em "Entrar com o Google", o frontend faz o redirecionamento para `/api/auth/google/redirect`. O Cloudflare Worker monta o endereço de autorização oficial do Google: `https://accounts.google.com/o/oauth2/v2/auth?...` anexando um `state` (UUID v4) assinado para evitar CSRF. O Google solicita a autorização do usuário e o redireciona de volta para `/api/auth/google/callback?code=...&state=...`. O Worker compara o `state`, faz uma requisição `fetch` POST para `https://oauth2.googleapis.com/token` trocando o código pelo token de identidade (ID Token), decodifica as informações e consulta o D1: se o usuário já existe, efetua o login; se não existe, cadastra com `email_verified = 1` e role `'Jogador'`.

### Detalhamento do Tópico 2 — Sistema OTP de 6 Dígitos e Validação Real
O fluxo de e-mail e senha passa a ter duas fases para novos cadastros. Na fase de submissão, a senha é protegida com salt e PBKDF2 e gravada no D1. O sistema gera 6 números aleatórios (ex: `849201`). Para evitar injeções ou leituras indevidas, o código numérico também é hasheado antes de ser salvo na tabela `email_verifications`. O envio é delegado a um serviço de e-mail transacional (como Resend ou Cloudflare Email Routing). Para que você consiga desenvolver e testar tudo no seu computador sem depender de chaves de API de terceiros de imediato, o servidor local registrará o código de forma evidente no terminal de logs e o frontend exibirá um toast de auxílio. Em ambiente de produção, basta preencher a variável `RESEND_API_KEY` para que o disparo aconteça para as caixas de correio reais.

### Detalhamento do Tópico 3 — Estrutura Relacional no Cloudflare D1
A evolução do banco de dados será implementada através de uma nova migração (`0002_auth_google_and_email_verification.sql`). A tabela `users` ganha colunas dedicadas para rastrear o `google_id`, `avatar_url` e `email_verified`. A tabela `email_verifications` terá uma chave estrangeira e um gatilho de expiração de 10 minutos. Caso ocorram 5 tentativas erradas de digitação do código, o registro é bloqueado para impedir ataques de força bruta no código de 6 dígitos.

### Detalhamento do Tópico 4 — UX e Integração Visual na Taverna
O card de autenticação receberá um refinamento estético de primeira linha. O botão do Google será integrado com transição suave, cantos arredondados condizentes com o tema dark fantasy e sombra profunda. A alternância entre a tela de login, tela de criação de conta e tela de digitação do código de confirmação acontecerá sem recarregar a página, mantendo o padrão SPA de alta velocidade que definimos no Tópico 1 da nossa arquitetura.

---

## 🗂️ Mapeamento Detalhado de Pastas e Arquivos Previstos

A implementação prática deste planejamento envolverá os seguintes arquivos:

```text
Código/
├── Backend/
│   ├── wrangler.toml                               # Inclusão dos secrets GOOGLE_CLIENT_ID e RESEND_API_KEY
│   └── src/
│       ├── services/
│       │   ├── googleAuthService.js                # Lógica do handshake OAuth 2.0 (redirect e callback com Google)
│       │   ├── emailService.js                     # Geração de OTP de 6 dígitos e disparo transacional
│       │   └── authService.js                      # Atualizado com login social, verify_email e unificação
│       └── db/
│           └── queries.js                          # Novas queries para verificação de e-mail e vínculo do Google ID
│
├── Banco/
│   ├── schema.sql                                  # Schema consolidado atualizado
│   └── migrations/
│       └── 0002_auth_google_and_verification.sql   # Migração 0002 para suportar Google e OTP
│
└── FrontEnd/
    ├── index.html                                  # Botão do Google, modal/seção de código de 6 dígitos e refinamentos
    └── js/
        └── api/
            └── client.js                           # Métodos auxiliares para acionar o fluxo OAuth e verificar código
```

---

## 📌 Próximos Passos

1. Submeter este plano técnico ao controle de versão (Git commit e push).
2. Aguardar o aval explícito do autor sob a etiqueta **`#> Implementação`** para dar início à codificação dos serviços de Google OAuth, despacho de código OTP, migração SQL 0002 e atualização do frontend.
