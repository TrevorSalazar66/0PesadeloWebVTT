/**
 * Cena: Terminal Hacking / Logs (Modelo 6)
 */
class TerminalHackingScene {
  constructor(containerId, sceneData, noCodeEngine) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.sceneData = sceneData;
    this.engine = noCodeEngine;

    // Converte model_data string
    let modelData = {};
    try {
      modelData = typeof sceneData.model_data === 'string' ? JSON.parse(sceneData.model_data) : (sceneData.model_data || {});
    } catch (e) {
      modelData = {};
    }

    this.commands = modelData.commands || [
      {
         input_string: "OPENSESAME",
         output_text: "> ACESSO CONCEDIDO. DESTRANCANDO COMPARTIMENTO SECRETO...",
         effects: [{ type: 'award_item', params: 'gold_key' }]
      },
      {
         input_string: "HELP",
         output_text: "> SISTEMA ARCANO V4.0\n> COMANDOS DISPONÍVEIS: HELP, OPENSESAME\n> ERROS MAXIMOS PERMITIDOS ANTES DO BLOQUEIO: 3",
         effects: []
      }
    ];

    this.maxAttempts = modelData.maxAttempts !== undefined ? modelData.maxAttempts : 3;
    this.failedAttempts = 0;
    this.isLocked = false;
    this.commandHistory = [];
    this.historyIndex = -1;

    // Boot Log Inicial
    this.outputLogs = [
      "> INICIANDO SISTEMA ARCANO V4.0...",
      "> CONEXÃO ESTABELECIDA.",
      "> INSIRA A PALAVRA DE PASSE OU COMANDO DE ACESSO:"
    ];
  }

  render() {
    if (!this.container) return;
    
    // O layout básico já está no HTML (campanha.html) em scene-terminal-viewport
    // Vamos preencher o history
    const historyDiv = document.getElementById('terminal-history');
    if (historyDiv) {
       historyDiv.innerHTML = this.outputLogs.map(log => `<div>${log.replace(/\n/g, '<br>')}</div>`).join('');
       historyDiv.scrollTop = historyDiv.scrollHeight;
    }

    const inputEl = document.getElementById('terminal-input');
    if (inputEl && !this.inputBound) {
       inputEl.addEventListener('keydown', (e) => this.handleInput(e));
       this.inputBound = true;
       // Manter focus ao clicar em qualquer lugar do terminal
       this.container.addEventListener('click', () => inputEl.focus());
       setTimeout(() => inputEl.focus(), 100);
    }

    if (this.isLocked && inputEl) {
       inputEl.disabled = true;
    }
  }

  handleInput(e) {
    if (this.isLocked) return;
    const inputEl = e.target;

    if (e.key === 'Enter') {
       const cmd = inputEl.value.trim();
       if (cmd) {
         this.processCommand(cmd);
         inputEl.value = '';
         this.historyIndex = this.commandHistory.length; // Reseta índice do histórico
       }
    } else if (e.key === 'ArrowUp') {
       e.preventDefault();
       if (this.historyIndex > 0) {
         this.historyIndex--;
         inputEl.value = this.commandHistory[this.historyIndex];
       }
    } else if (e.key === 'ArrowDown') {
       e.preventDefault();
       if (this.historyIndex < this.commandHistory.length - 1) {
         this.historyIndex++;
         inputEl.value = this.commandHistory[this.historyIndex];
       } else {
         this.historyIndex = this.commandHistory.length;
         inputEl.value = '';
       }
    }
  }

  async processCommand(inputStr) {
    // Adiciona ao log e ao histórico de setas
    this.outputLogs.push(`> ${inputStr}`);
    this.commandHistory.push(inputStr);

    // Procura o comando cadastrado pelo Mestre
    const match = this.commands.find(c => c.input_string.toLowerCase() === inputStr.toLowerCase());

    if (match) {
       this.outputLogs.push(match.output_text);
       
       // Trigger Engine NoCode (se houver efeitos)
       if (match.effects && match.effects.length > 0 && window.obterUsuarioAtual && window.apiClient) {
          const user = window.obterUsuarioAtual();
          const meuChar = window.currentPartyCharacters?.find(c => c.user_id === (user ? user.id : ''));
          for (const effect of match.effects) {
             await window.apiClient.triggerSceneAction(window.currentCampaignId, this.sceneData.id, {
               trigger: 'on_terminal_command',
               actionType: effect.type,
               actionParams: effect.params,
               characterId: meuChar ? meuChar.id : null
             });
          }
       }
    } else {
       this.outputLogs.push("> ERRO: Comando não reconhecido.");
       this.failedAttempts++;

       if (this.failedAttempts >= this.maxAttempts) {
         this.outputLogs.push("> ALERTA DE INTRUSÃO DETECTADA.");
         this.outputLogs.push("> SISTEMA BLOQUEADO.");
         this.isLocked = true;
         
         // Trigger Penalidade NoCode
         if (this.engine) {
            this.engine.triggerSceneAction(window.currentCampaignId, this.sceneData.id, { trigger: 'on_terminal_lock' });
         }
       }
    }

    this.render();
  }

  destroy() {
    // O inputBound flag impede múltiplos binds, mas poderiamos remover listeners aqui
    if (this.container) {
      const historyDiv = document.getElementById('terminal-history');
      if (historyDiv) historyDiv.innerHTML = '';
      const inputEl = document.getElementById('terminal-input');
      if (inputEl) {
         inputEl.value = '';
         inputEl.disabled = false;
      }
    }
    this.inputBound = false;
  }
}

window.TerminalHackingScene = TerminalHackingScene;
