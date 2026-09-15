# 🚫 Serviços e Tecnologias Descartadas (Not Work)

Este documento registra tecnologias, serviços e práticas que foram expressamente descartadas ou proibidas para o projeto **RetroForge VTT**, servindo como guia do que **não fazer**.

---

## ❌ 1. Provedores de Backend e Hospedagem Externos

- **Firebase (Google Cloud)**:
  - *Motivo do descarte*: Embora citado nas notas preliminares de idealização, foi formalmente descartado em favor do ecossistema unificado da Cloudflare. Não usar Firebase Auth, Firestore ou Realtime Database.
- **AWS / GCP / Azure**:
  - *Motivo do descarte*: Complexidade excessiva de provisionamento, cobranças imprevisíveis e desalinhamento com o princípio de baixo custo e arquitetura simples.
- **Vercel / Netlify**:
  - *Motivo do descarte*: Limitações e custos em relação a WebSockets persistentes de longo prazo, preferindo-se a unificação em Cloudflare Pages + Workers.
- **Supabase / BaaS proprietários**:
  - *Motivo do descarte*: Evitar dependência de bancos externos quando a Cloudflare fornece D1 (SQLite) nativo integrado ao runtime.

---

## ❌ 2. Padrões de Implementação Indesejados

- **Frameworks Frontend Opacos e Pesados (sem aprovação)**:
  - Não introduzir arquiteturas excessivamente complexas ou bundlers pesados que obscureçam o código HTML/JS e dificultem a leitura direta pelo autor.
- **Persistência Excessiva no Banco**:
  - Proibido salvar posições intermediárias ou estados efêmeros a cada pixel ou clique no banco relacional. Seguir a diretriz: *"Só persistir no backend o que realmente importa"*.
- **Polling HTTP Contínuo para Multiplayer**:
  - Proibido usar requisições repetitivas (`setInterval` / fetch contínuo) para sincronização de jogo. Usar WebSockets.
