# 05 — Planejamento de Identificação de Dispositivo (Device Fingerprinting), Trava Permanente Anti-Sybil e Painel de Desbloqueio Administrativo

Este documento formaliza o planejamento técnico da proteção contra criação massiva de contas através de identificação avançada de dispositivos (Device Fingerprinting), aplicação de trava permanente em caso de comportamento abusivo e criação do painel de controle direto na interface web para liberação exclusiva por Administradores.

---

## 📋 Lista de Tópicos Resumidos

### Tópico 1: Identificação Avançada do Dispositivo (Device Fingerprinting & Assinatura Digital)
- **Objetivo**: Detectar com alta precisão se requisições de criação de conta estão partindo do mesmo dispositivo físico, mesmo que o invasor utilize abas anônimas, troque de e-mails ou limpe o histórico de navegação.
- **Método**:
  - Geração de uma **Assinatura Digital de Dispositivo (`device_fingerprint`)** no frontend através da combinação de características técnicas do hardware e do navegador (resolução de tela, renderização gráfica via Canvas/WebGL, timezone, hardware concurrency, plataforma e headers do cliente).
  - Geração de um identificador criptográfico (`device_id`) persistido via Storage e Cookie seguro de longo prazo.
  - O Cloudflare Worker associa o `device_fingerprint` ao endereço IP real (`CF-Connecting-IP`) e rede (`ASN`), gerando uma tupla única de auditoria (`client_signature = HMAC(device_fingerprint + IP)`).
- **Resultados Esperados**: Capacidade de reconhecer a máquina física com precisão superior a 99%, sem necessidade de instalar nada na máquina do usuário.
- **Possíveis Problemas Pós-Implementação**: Usuários que compartilham a mesma rede Wi-Fi (ex: irmãos na mesma casa) poderiam ser associados caso o fingerprint considerasse apenas o IP (mitigado ao combinar a assinatura de hardware da máquina com o IP).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Bloquear apenas por IP é ineficiente porque invasores usam VPNs ou trocam de IP no roteador em segundos. A assinatura composta de dispositivo + rede amarra a ação à máquina que executou o ataque.

---

### Tópico 2: Mecanismo de Trava Permanente no Banco D1 (Bloqueio Automático)
- **Objetivo**: Interromper e paralisar imediatamente qualquer dispositivo que tente abusar da criação de contas (ataque Sybil, spam de contas ou criação massiva de bots).
- **Método**:
  - Nova tabela relacional no Cloudflare D1: `device_security` (rastreia `device_hash`, `first_ip`, `last_ip`, `accounts_created_count`, `status` ['ACTIVE', 'SUSPICIOUS', 'BLOCKED_PERMANENT'], `reason`, `blocked_at`, `unblocked_by`, `unblocked_at`).
  - **Regra de Detecção**: Caso o mesmo `device_hash` crie mais de **3 contas** em um período de 24 horas ou cometa 5 tentativas falhas de verificação consecutivas:
    1. O status do dispositivo é marcado permanentemente como `'BLOCKED_PERMANENT'`.
    2. O gateway rejeita qualquer requisição futura daquele `device_hash` com `HTTP 403 Forbidden` e a mensagem de erro padronizada: *"Este dispositivo foi bloqueado por atividades não autorizadas. Contate um Administrador para liberação."*
    3. As contas criadas durante o ataque são marcadas como congeladas para auditoria.
- **Resultados Esperados**: Bloqueio definitivo e automático do computador invasor, protegendo a cota do banco de dados e a integridade da comunidade da taverna.
- **Possíveis Problemas Pós-Implementação**: Falso positivo caso um usuário legítimo tente criar contas para seus familiares na mesma máquina (resolvido facilmente pelo painel de liberação do Admin).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Bloqueios temporários (como 15 minutos) não impedem scripts automatizados que apenas esperam o tempo passar. A trava permanente exige intervenção humana para ser destravada.

---

### Tópico 3: Painel Administrativo de Desbloqueio Direto na Página Web
- **Objetivo**: Permitir que usuários com papel `'Admin'` visualizem os dispositivos bloqueados e consigam destravá-los diretamente pela interface web com 1 clique, sem precisar abrir bancos de dados ou terminais.
- **Método**:
  - **Interface no FrontEnd**:
    - Quando um usuário autenticado possui o papel `role === 'Admin'`, o menu lateral da taverna exibe uma nova seção exclusiva: **Administração / Segurança**.
    - Tela de governança com tabela estilizada em dark fantasy contendo: Identificador do Dispositivo (mascarado para privacidade), IP aproximado, Quantidade de Contas Tentadas, Data do Bloqueio, Motivo e um botão de ação rápida: **"Liberar Dispositivo"**.
  - **Ação no Gateway `/api/sync`**:
    - `admin.devices.list`: Retorna todos os registros com status `'BLOCKED_PERMANENT'` (acessível exclusivamente se o JWT do solicitante tiver `role === 'Admin'`).
    - `admin.devices.unblock`: Recebe o `deviceId`, atualiza o status para `'ACTIVE'`, registra o `unblocked_by = admin_id` e zera os contadores de tentativa.
- **Resultados Esperados**: Controle total e autônomo pelo dono do site, facilidade operacional e desbloqueio em tempo real sem necessidade de reiniciar nenhum servidor.
- **Possíveis Problemas Pós-Implementação**: Garantir que um usuário comum jamais consiga forjar chamadas para as ações `admin.*` (protegido pelo middleware RBAC do backend que checa o papel assinado no JWT).
- **Argumentação do Porquê Usar Esse Método e Não Outros**: Gerenciar bloqueios via scripts manuais de SQL no terminal é lento e pouco prático. Uma tela administrativa na própria web proporciona autonomia imediata para o administrador.

---

## 🔍 Detalhamento dos Tópicos

### Detalhamento do Tópico 1 — Entropia do Fingerprint e Assinatura
O cliente web executa uma rotina leve em JavaScript puro que coleta parâmetros do ambiente (sem requisições externas): dimensões da tela, profundidade de cor, idioma do navegador, renderização de uma matriz de pixels em `<canvas>` invisível e strings de renderizador WebGL. Esses dados são concatenados e passados pelo `crypto.subtle.digest('SHA-256')`, gerando uma sequência única como `dev_9f83a1b4e2...`. Esse hash viaja em um cabeçalho customizado `X-Device-Fingerprint` em todas as chamadas de autenticação. O Worker calcula a assinatura combinando esse hash com os dados de borda fornecidos pela Cloudflare, garantindo que o fingerprint não possa ser facilmente adulterado.

### Detalhamento do Tópico 2 — Regra de Negócio da Trava Permanente
No momento em que o endpoint `/api/auth` recebe a solicitação de criação de conta, o backend consulta a tabela `device_security` no D1 usando o `device_hash`. Se o registro já estiver como `BLOCKED_PERMANENT`, a requisição é cancelada no primeiro milissegundo, antes de qualquer consulta de usuário ou cálculo de hash PBKDF2. Se estiver ativo, incrementa o contador `accounts_created_count`. Se o contador atingir o limiar estipulado (ex: 3 contas), o trigger da aplicação atualiza a coluna `status` para `BLOCKED_PERMANENT` e emite o evento de bloqueio.

### Detalhamento do Tópico 3 — Segurança e UX do Painel do Administrador
O acesso ao painel de administração é protegido por uma barreira dupla. No frontend, o botão e a tela de administração só são renderizados se o perfil contiver `role: 'Admin'`. No backend, a função controladora verifica a claim `role` extraída do JWT criptografado; se não for `'Admin'`, a requisição é sumariamente rejeitada com `HTTP 403 Forbidden`. Ao clicar em "Liberar Dispositivo", a interface emite um feedback toast imediato e atualiza a listagem de travamentos em tempo real.

---

## 🗂️ Mapeamento Detalhado de Pastas e Arquivos Previstos

A implementação prática deste planejamento envolverá os seguintes arquivos:

```text
Código/
├── Backend/
│   └── src/
│       ├── services/
│       │   ├── deviceSecurityService.js            # Lógica de validação de fingerprint, detecção de abuso e bloqueio
│       │   └── adminService.js                     # Ações de listagem e desbloqueio de dispositivos por administradores
│       ├── middleware/
│       │   └── rbacMiddleware.js                   # Middleware para exigir role === 'Admin' em ações restritas
│       └── db/
│           └── queries.js                          # Queries parametrizadas para a tabela device_security
│
├── Banco/
│   ├── schema.sql                                  # Tabela device_security adicionada ao schema central
│   └── migrations/
│       └── 0003_device_security_and_blocks.sql     # Migração versionada da tabela de segurança de dispositivos
│
└── FrontEnd/
    ├── js/
    │   ├── security/
    │   │   └── fingerprint.js                      # Coleta segura de entropia do dispositivo (Canvas/WebGL/Screen)
    │   └── api/
    │       └── client.js                           # Injeção automática do header X-Device-Fingerprint nas requisições
    └── index.html                                  # Aba exclusiva "Administração" visível apenas para usuários com role Admin
```

---

## 📌 Próximos Passos

1. Submeter este plano técnico ao controle de versão (Git commit e push).
2. Aguardar o aval explícito do autor sob a etiqueta **`#> Implementação`** para dar início à codificação do sistema de fingerprint, regras de trava permanente no D1 e tela de governança administrativa.
