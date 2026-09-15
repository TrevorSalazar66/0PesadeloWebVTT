# 🌐 Diretrizes de Hospedagem e Infraestrutura — Ecossistema Cloudflare

Este documento consolida a decisão mandatória de infraestrutura para o projeto **RetroForge VTT**.

---

## 📌 Decisão Central

**Todo o projeto será hospedado e executado exclusivamente utilizando as ferramentas do ecossistema Cloudflare.**

Nenhum outro serviço de hospedagem ou provedor externo em nuvem (como Firebase, AWS, GCP, Vercel ou Supabase) será empregado.

---

## 🛠️ Ferramentas Cloudflare Selecionadas

1. **Cloudflare Pages (Frontend)**:
   - Hospedagem estática e de alta velocidade para a interface web (HTML, CSS e JavaScript modular).
   - Entrega global via Edge CDN com baixíssima latência.

2. **Cloudflare Workers (Backend & APIs)**:
   - Camada de backend serverless executando em JavaScript/Node.js compatível (`nodejs_compat`).
   - Gerenciamento de rotas de API, autoridade de regras do jogo e validação de turnos.

3. **Cloudflare Workers WebSockets / Durable Objects (Multiplayer em Tempo Real)**:
   - Manipulação de conexões WebSockets para comunicação bidirecional em tempo real entre jogadores e mestre.
   - Sincronização de estado da partida com controle autoritário no servidor.

4. **Cloudflare D1 & KV (Banco de Dados e Persistência)**:
   - **Cloudflare D1**: Banco de dados relacional baseado em SQLite para campanhas, fichas, autenticação e histórico persistente.
   - **Cloudflare KV**: Armazenamento chave-valor de alta velocidade para compêndio estático (blueprints de monstros, itens e magias) e sessões temporárias.

---

## 🎯 Vantagens para o Projeto

- **Custo Operacional Reduzido**: O plano gratuito da Cloudflare atende perfeitamente ao princípio fundamental de *"baixo custo operacional"*.
- **Arquitetura Unificada**: Toda a infraestrutura (frontend, APIs, banco e websockets) é gerenciada em uma única plataforma através do `Wrangler CLI`.
- **Manutenibilidade e Leitura**: Fácil compreensão através de padrões claros em HTML, JavaScript/Node.js e SQL padrão.
