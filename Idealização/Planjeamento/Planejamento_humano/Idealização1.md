
# planejamento-VTT

# 🧠 **Síntese do Projeto — RetroForge VTT**

O projeto é um **VTT (Virtual Tabletop) web**, leve e escalável, que permite criar e jogar RPGs diretamente no navegador, com foco em:

> 👉 **construção visual (no-code), execução em tempo real e baixo custo operacional**

---

# 🧩 **Ideia Central**

O sistema funciona como uma plataforma onde:

- o **mestre monta o mundo**

- o **jogador interage com esse mundo**

- o **sistema gerencia regras, estados e automações**

Tudo isso sem necessidade de programação por parte do usuário final.

---

# 🏗️ **Arquitetura Fundamental**

O projeto é baseado em três camadas principais:

### 🔹 1. Grid (mapa)

- Estrutura visual onde o jogo acontece

- Organizado em células (2D)

- Contém apenas referências (não lógica)

---

### 🔹 2. Compêndio (dados base)

- Biblioteca de:

  - NPCs

  - itens

  - habilidades

- Tudo é reutilizável e baseado em ID

---

### 🔹 3. Instâncias (estado real)

- Cópias dos elementos no mapa

- Guardam:

  - HP

  - posição

  - estados

---

# ⚙️ **Modelo de Execução**

O sistema usa uma arquitetura híbrida:

- **Frontend (cliente):**

  - renderização

  - lógica leve

  - execução de IA

  - movimentação

- **Backend (Firebase):**

  - autoridade do estado

  - validação

  - persistência

  - controle de turnos

---

# 🎮 **Funcionamento do Jogo**

- baseado em **turnos controlados pelo backend**

- ações importantes são validadas centralmente

- movimentação e cálculos leves são locais

- eventos críticos são persistidos

---

# 🤖 **Sistema de Automação**

- NPCs possuem **IA modular**

- funcionam mesmo sem mestre ativo

- executados no frontend (com validação)

---

# 🎭 **Modos de Experiência**

O sistema suporta dois formatos:

### 🟩 Grid (tático)

- exploração

- combate posicional

### 🟦 Telas de cena

- narrativa

- combate simplificado

- interações dirigidas (ex: mineração)

---

# 👥 **Sistema de Papéis**

Hierarquia clara:

- jogador

- auxiliar

- mestre

- admin

- super admin

👉 define permissões e controle do sistema

---

# 📊 **Estratégia de Escala**

- limites por mapa, campanha e mestre

- controle direto de performance

- prevenção de sobrecarga

---

# 🔥 **Princípio Técnico Central**

> 👉 **“Só persistir no backend o que realmente importa”**

Isso garante:

- baixo custo (Firebase)

- alta performance

- escalabilidade

---

# 🎯 **Objetivo Final**

Criar uma plataforma que seja:

- leve

- acessível

- modular

- expansível

Capaz de suportar:

- RPGs táticos

- experiências narrativas

- sistemas personalizados

---

# 🧠 **Resumo em 1 frase**

> Um VTT web no-code, baseado em grid e cenas, com lógica híbrida (cliente + backend), focado em performance, controle e automação inteligente.

---
