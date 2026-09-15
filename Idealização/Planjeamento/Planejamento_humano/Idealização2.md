
# 🧠 Síntese do Projeto RetroForge VTT

O projeto é um **VTT web leve e modular**, onde mestres criam experiências de RPG e jogadores interagem em tempo real, com foco em:

> **flexibilidade, baixo custo e automação inteligente**

---

## 🎯 Ideia central

Um sistema que combina:

- **mapas em grid (exploração tática)**
- **cenas dirigidas (narrativa, combate simples, interação)**
- **elementos reutilizáveis (compêndio)**
- **estado dinâmico (instâncias)**

Tudo funcionando direto no navegador.

---

## ⚙️ Como funciona

- O **mestre monta o mundo visualmente**
- O sistema usa uma **base reutilizável de elementos (compêndio)**
- Quando usados, viram **instâncias com estado próprio**
- O jogo roda com:
  - lógica leve no frontend
  - validação e persistência no backend

---

## 🧠 Diferencial principal

O sistema não depende totalmente do mestre:

- possui **IA básica para NPCs**
- permite **automação de comportamentos**
- mantém **controle por turnos com backend autoritário**

---

## 💡 Filosofia técnica

- **Frontend faz o máximo possível** (reduz custo)
- **Backend decide o que é importante** (garante consistência)
- **Só eventos relevantes são salvos**

---

## 🎮 Tipos de experiência

O sistema suporta dois modos principais:

### 1. Grid (tático)

- movimentação
- combate posicional
- exploração

### 2. Cenas (abstrato)

- narrativa estilo livro-jogo
- combate simplificado
- sistemas de interação (ex: mineração)

---

## 📊 Objetivo estrutural

Criar um sistema:

- escalável
- reutilizável
- controlado em custo
- acessível (web, mobile)
- expansível via JSON

---

## 🧩 Em uma frase

> Um VTT híbrido que mistura mapa tático, narrativa interativa e automação de sistemas, com foco em eficiência e escalabilidade.
