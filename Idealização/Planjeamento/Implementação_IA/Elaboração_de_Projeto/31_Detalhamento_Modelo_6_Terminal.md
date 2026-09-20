# 31. Detalhamento do Modelo de Cena 6: Terminal (Console de Comando & Criptografia)

Este documento estabelece a especificação técnica e o planejamento funcional completo do **Modelo 6: Terminal (Interface de Linha de Comando Fictícia, Puzzles de Hacking e Criptografia)** para o Arcana VTT.

---

## 💻 1. Visão Geral do Modelo

O Modelo 6 é uma cena **Assíncrona (1 jogador ativo por sessão)** no formato de console de linha de comando retro (CLI), onde o jogador digita palavras-chave ou frases de código para interagir com computadores antigos, relíquias criptografadas ou terminais mágicos.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CONSOLE RETRO (Fictício & Seguro)                          │
│   > INICIANDO SISTEMA ARCANO V4.0...                                       │
│   > INSIRA A PALAVRA DE PASSE OU COMANDO DE ACESSO:                        │
│   > _ (Cursor Piscante | Suporte a Fontes Monospace e Alfabetos Rúnicos)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                 Navegação por Setas (▲ / ▼) pelo Histórico                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 2. Estilização & Alfabetos Customizados

* **Visual Personalizado**: O mestre escolhe o tema visual do terminal:
  - *Console Hacker Verde* (CRT Retro estilo Matrix).
  - *Console Âmbar* (Retro Monocromático).
  - *Console Rúnico* (Letras substituídas por fontes/símbolos rúnicos ou alienígenas).
* **Segurança Absoluta**: A interface é uma simulação puramente gráfica e narrativa no frontend, sem qualquer acesso a comandos de terminal reais do sistema operacional.

---

## ⌨️ 3. Mecânica de Entrada e Histórico

1. **Prompt de Entrada**: Campo de texto com cursor piscante no estilo linha de comando.
2. **Navegação por Histórico**: O jogador pode utilizar as setas do teclado `▲` (Cima) e `▼` (Baixo) para navegar pelos comandos fictícios que ele já digitou durante aquela sessão.
3. **Rolagem Automática**: Novas respostas e linhas impressas empurram o console para baixo com auto-scroll.

---

## ⚙️ 4. Regras de Comandos Criadas pelo Mestre (Lógica `If-Then`)

O mestre não precisa de comandos de ajuda pré-existentes do sistema. Toda a inteligência do terminal é definida por regras de entrada e resposta configuradas pelo mestre na Oficina:

### 4.1. Estrutura do Comando no Construtor da Oficina:
Cada comando cadastrado possui 3 parâmetros:
1. **Palavra-chave / Comando Esperado (`input_string`)**: A frase ou código que o jogador deve digitar (ex: `OPENSESAME`, `OVERRIDE_404`, `iniciar_protocolo`).
2. **Resposta Impressa no Console (`output_text`)**: O texto impresso na tela do terminal ao enviar aquele comando (ex: `> ACESSO CONCEDIDO. DESTRANCANDO COMPARTIMENTO SEGREDO...`).
3. **Ação / Gatilho No-Code (`[ENTÃO]`)**:
   * `change_tile` / `delete_tile`: altera ou limpa elementos do mapa.
   * `award_item` / `award_xp`: entrega recompensas.
   * `transfer_scene`: abre a porta e teleporta para outra cena.
   * `log_diary`: grava no Diário de Bordo da mesa.

---

## ❌ 5. Feedback de Erros e Controle de Tentativas

O mestre define manualmente a política de erros da cena:

* **Comando Não Reconhecido (Fallback)**: Texto exibido ao digitar um comando inválido (ex: `> ERRO: Comando não reconhecido pelo terminal`).
* **Limite de Tentativas & Penalidades**:
  - Mestre define se há um limite máximo de erros permitidos (ex: 3 tentativas).
  - Atingir o limite de erros pode acionar o gatilho `on_terminal_lock` $\rightarrow$ aplicar dano de Anima no personagem ou bloquear o terminal.
