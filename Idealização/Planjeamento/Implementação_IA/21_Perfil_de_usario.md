# Plano de Implementação: Aba de Perfil do Aventureiro na Página Inicial

Este plano detalha a modernização e implementação completa da **Aba de Perfil** (`#view-perfil` no `index.html`), conectando-a à camada de dados reais do Cloudflare D1 através do gateway `/api/sync` e proporcionando uma experiência imersiva com identidade visual heráldica, contatos sociais, métricas do aventureiro e gestão de segurança.

---

## 🎯 Objetivos

1. **Sincronização Real de Dados (`profile.get` & `profile.update`)**:
   - Carregar dados reais da tabela `user_profiles` e `users` ao abrir a aba de perfil.
   - Permitir edição de Nome, `@nickname` único, Faixa Etária, Bio (até 500 chars com contador), Avatar/Banner e Contatos Sociais (Discord, WhatsApp, Instagram).
   - Validar duplicidade de nickname e integridade de dados no backend.
2. **Identidade Visual & Hero Header**:
   - Estandarte/Banner temático personalizável de topo.
   - Avatar com moldura heráldica dourada, badge oficial da categoria de usuário (`Jogador`, `Mestre`, `Admin`, `Superadmin`) e data de cadastro na taverna.
   - Código do usuário (`usr_...`) com botão de cópia instantânea.
3. **Métricas & Showcase do Aventureiro**:
   - Painel com contadores de engajamento na taverna: Campanhas participando, Campanhas mestradas e Total de personagens forjados.
4. **Segurança & Troca de Senha**:
   - Seção para alteração segura de senha para contas de e-mail/senha com validação de senha atual e geração de novo salt/hash PBKDF2.
5. **Testes Automatizados, Migração e Deploy**:
   - Criação de testes dedicados em `Codigo/Backend/test/profileService.test.js`.
   - Deploy no Cloudflare Workers e Pages com commit no repositório Git.

---

## 🏗️ Proposta de Mudanças

### Backend (`Codigo/Backend/`)

#### [MODIFY] [queries.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/db/queries.js)
- Adicionar query para estatísticas do usuário (`getUserStats`): contagem de campanhas onde o usuário participa, campanhas onde é dono e quantidade de personagens vinculados.
- Garantir que `updateUserProfile` suporte atualização completa (`name`, `nickname`, `age_group`, `bio`, `contacts`, `avatar_url`, `banner_url`).
- Adicionar método `updateUserPassword(db, userId, newPasswordHash, newSalt)`.

#### [MODIFY] [syncService.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/src/services/syncService.js)
- Expandir `case 'profile.get'`: retornar dados completos do usuário, perfil enriquecido e estatísticas agregadas (`stats`).
- Expandir `case 'profile.update'`: validar campos, unicidade de nickname (caso alterado), limite e sanitização da Bio, validação de contatos e atualização do JWT em cookie.
- Adicionar `case 'profile.password.update'`: validar senha atual via `verifyPassword`, validar requisitos da nova senha, atualizar hash/salt no banco.

#### [NEW] [profileService.test.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/Backend/test/profileService.test.js)
- Suíte de testes automatizados cobrindo leitura de perfil, atualização de dados, bloqueio de nicknames duplicados, troca de senha e consulta de estatísticas.

---

### Frontend (`Codigo/FrontEnd/`)

#### [MODIFY] [index.html](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/index.html)
- Reformular completamente a seção `<section id="view-perfil">` com layout em cards e hero heráldico:
  - **Hero Header**: Banner estilizado, Avatar grande, Badge de Role, Nome de Exibição, `@nickname`, Data de Registro e ID com botão de cópia.
  - **Card 1 — Identidade do Aventureiro**: Nome, Nickname, Faixa Etária e Bio com contador regressivo (`500/500`).
  - **Card 2 — Contatos & Guildas**: Discord, WhatsApp, Instagram e Mídias (Avatar URL e Banner URL).
  - **Card 3 — Vitrine da Taverna (Métricas)**: Cards de estatísticas de Campanhas e Personagens.
  - **Card 4 — Segurança da Conta**: E-mail com status de verificação, método de autenticação e formulário colapsável de Alteração de Senha.
- Adicionar estilos CSS modernos para os cards de perfil, contadores e badges.
- Conectar carregamento ao alternar para a aba `perfil` (`alternarAba('perfil')` -> `carregarPerfilUsuario()`).
- Implementar funções JavaScript: `carregarPerfilUsuario()`, `salvarPerfilCompleto()`, `alterarSenhaPerfil()`, `copiarIdUsuarioPerfil()`.

#### [MODIFY] [client.js](file:///c:/Users/João/Documents/Programas/HTML/Projetos/0PesadeloWebVTT/Codigo/FrontEnd/js/api/client.js)
- Adicionar métodos auxiliares: `getUserProfile()`, `updateUserProfile(data)`, `changeUserPassword(data)`.

---

## 🧪 Plano de Verificação

### Testes Automatizados
- Executar:
  ```powershell
  & "C:\Program Files\nodejs\node.exe" test/profileService.test.js
  ```
- Executar todas as suítes de teste de regressão para assegurar compatibilidade global:
  ```powershell
  & "C:\Program Files\nodejs\node.exe" test/campaignSettings.test.js; & "C:\Program Files\nodejs\node.exe" test/adminService.test.js; & "C:\Program Files\nodejs\node.exe" test/rpgEngine.test.js
  ```

### Verificação Manual & Visual
- Abrir a aplicação, navegar até a aba "Perfil", checar o preenchimento automático dos dados do usuário logado.
- Testar edição de bio, nome, nickname e contatos com salvamento e feedback toast imediato.
- Testar troca de senha e validação de credenciais.

---

## 🚀 Deploy & Publicação
- Deploy no Cloudflare Workers (`wrangler deploy`).
- Deploy no Cloudflare Pages (`wrangler pages deploy`).
- Commit e push das alterações no Git.
