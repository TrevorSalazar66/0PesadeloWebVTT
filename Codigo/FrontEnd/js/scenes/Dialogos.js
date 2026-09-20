/**
 * Cena: Diálogos Visual Novel (Modelo 4)
 */
class DialogosScene {
  constructor(containerId, sceneData, noCodeEngine) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.sceneData = sceneData;
    this.engine = noCodeEngine;
    
    let modelData = {};
    try {
      modelData = typeof sceneData.model_data === 'string' ? JSON.parse(sceneData.model_data) : (sceneData.model_data || {});
    } catch (e) {
      modelData = {};
    }

    this.nodes = modelData.nodes || {
      "node_inicio": {
        id: "node_inicio",
        speaker: "Guardião da Cripta",
        title: "Entidade Antiga",
        avatar: "🧙",
        text: "Quem ousa perturbar o repouso das eras?",
        options: [
          { text: "Buscamos apenas passagem.", goto: "node_passagem", condition: null, effects: [] },
          { text: "Fomos enviados pela Ordem Arcana.", goto: "node_bencao", condition: null, effects: [{type: 'heal_anima', params: 5}] },
          { text: "[Sacar a arma]", goto: "node_combate", condition: null, effects: [] }
        ]
      },
      "node_passagem": {
        id: "node_passagem",
        speaker: "Guardião da Cripta",
        title: "Entidade Antiga",
        avatar: "🧙",
        text: "Passagem? Apenas aqueles dignos de sacrifício cruzam os portais. Demonstrem sua fibra ou retornem ao pó.",
        options: [
          { text: "Aceitar a provação e avançar.", goto: "node_fim", condition: null, effects: [] }
        ]
      },
      "node_bencao": {
        id: "node_bencao",
        speaker: "Guardião da Cripta",
        title: "Entidade Antiga",
        avatar: "🧙",
        text: "A Ordem Arcana... faz séculos que não ouço este nome. Se são seus herdeiros, concedo-lhes minha bênção. (Cura Anima)",
        options: [
          { text: "Agradecer e prosseguir.", goto: "node_fim", condition: null, effects: [] }
        ]
      },
      "node_combate": {
        id: "node_combate",
        speaker: "Guardião da Cripta",
        title: "Entidade Antiga",
        avatar: "🧙",
        text: "Audácia tola! As sombras consumirão seus ossos!",
        options: [
          { text: "Lutar!", goto: "node_fim", condition: null, effects: [{type: 'apply_damage', params: 10}] }
        ]
      },
      "node_fim": {
        id: "node_fim",
        speaker: "Sistema",
        title: "",
        avatar: "⚙️",
        text: "A conversa foi encerrada.",
        options: []
      }
    };

    this.currentNodeId = modelData.startNode || "node_inicio";
    this.history = []; // Armazena { speaker, text, isPlayer }
  }

  render() {
    if (!this.container) return;

    let html = `
      <div id="dialogue-novel-wrapper" style="display: flex; flex-direction: column; height: 100%; max-height: 500px; border: 1px solid #334155; border-radius: 8px; background: #0f172a;">
         
         <div id="dialogue-history-container" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px;">
    `;

    // Renderiza o histórico de chat
    this.history.forEach(msg => {
      if (msg.isPlayer) {
        html += `
          <div style="align-self: flex-end; background: #3b82f6; color: white; padding: 10px 14px; border-radius: 16px 16px 0px 16px; max-width: 80%;">
             <span style="font-size: 12px; opacity: 0.8; display: block; margin-bottom: 4px;">Você</span>
             ${msg.text}
          </div>
        `;
      } else {
        html += `
          <div style="align-self: flex-start; background: #1e293b; color: #e2e8f0; padding: 10px 14px; border-radius: 16px 16px 16px 0px; max-width: 80%; border: 1px solid #334155;">
             <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
               <span style="font-size: 20px;">${msg.avatar}</span>
               <div>
                 <span style="font-size: 14px; font-weight: bold; color: #a78bfa;">${msg.speaker}</span>
                 <span style="font-size: 10px; color: #94a3b8; margin-left: 4px;">${msg.title}</span>
               </div>
             </div>
             ${msg.text}
          </div>
        `;
      }
    });

    html += `</div>`; // fim do histórico

    // Opções do nó atual
    const node = this.nodes[this.currentNodeId];
    if (node) {
       html += `
         <div style="padding: 16px; border-top: 1px solid #334155; background: #1e293b; border-radius: 0 0 8px 8px;">
           <div style="display: flex; flex-direction: column; gap: 8px;" id="dialogue-options-list">
       `;
       
       if (node.options && node.options.length > 0) {
         node.options.forEach((opt, idx) => {
           // Simulação de check de condição (pode ser expandido lendo a ficha)
           const meetsCondition = this.checkCondition(opt.condition);
           if (meetsCondition) {
             html += `
               <button type="button" class="dialogue-choice-btn" data-idx="${idx}" style="text-align: left; padding: 12px; background: #0f172a; border: 1px solid #475569; color: #e2e8f0; border-radius: 6px; cursor: pointer; transition: background 0.2s;">
                 <span style="color: #60a5fa; margin-right: 8px;">${idx + 1}.</span> ${opt.text}
               </button>
             `;
           }
         });
       } else {
         html += `<div style="text-align: center; color: #94a3b8; font-style: italic;">Fim do diálogo.</div>`;
       }

       html += `
           </div>
         </div>
       `;
    }

    html += `</div>`;
    this.container.innerHTML = html;

    // Scroll to bottom
    const historyContainer = this.container.querySelector('#dialogue-history-container');
    if (historyContainer) historyContainer.scrollTop = historyContainer.scrollHeight;

    // Binds
    if (node && node.options) {
      const btns = this.container.querySelectorAll('.dialogue-choice-btn');
      btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
          this.selectOption(node.options[idx], node);
        });
      });
    }

    // Se é o primeiro render e não há histórico, push the current node text
    if (this.history.length === 0 && node) {
       this.history.push({
         isPlayer: false,
         speaker: node.speaker,
         title: node.title,
         avatar: node.avatar,
         text: node.text
       });
       this.render(); // Re-render to show initial message
    }
  }

  checkCondition(conditionStr) {
    if (!conditionStr) return true;
    // Exemplo: "has_item: chave_prata" ou "min_stat: mente_3"
    // Num sistema real, leria de window.currentPartyCharacters
    console.log("Checando condição:", conditionStr);
    return true; // Mock: sempre passa por enquanto
  }

  async selectOption(option, currentNode) {
    // 1. Log player's choice
    this.history.push({
      isPlayer: true,
      text: option.text
    });

    // 2. Trigger NoCode Effects
    if (option.effects && option.effects.length > 0) {
      if (window.obterUsuarioAtual && window.currentPartyCharacters && window.apiClient) {
        const user = window.obterUsuarioAtual();
        const meuChar = window.currentPartyCharacters.find(c => c.user_id === (user ? user.id : ''));
        
        for (const effect of option.effects) {
           await window.apiClient.triggerSceneAction(window.currentCampaignId, this.sceneData.id, {
             trigger: 'on_dialogue_choice',
             actionType: effect.type,
             actionParams: effect.params,
             characterId: meuChar ? meuChar.id : null
           });
        }
        if (window.loadDiarioData) await window.loadDiarioData();
        if (window.atualizarHudPersonagemPalco) window.atualizarHudPersonagemPalco();
      }
    }

    // 3. Move to next node
    this.currentNodeId = option.goto;
    const nextNode = this.nodes[this.currentNodeId];

    // 4. Log NPC's new response
    if (nextNode) {
      this.history.push({
        isPlayer: false,
        speaker: nextNode.speaker,
        title: nextNode.title,
        avatar: nextNode.avatar,
        text: nextNode.text
      });
    }

    this.render();
  }

  destroy() {
    // Aqui poderiamos disparar o Log de Auditoria para o Diário do Mestre
    console.log("Enviando transcript para o Mestre:", this.history);
    if (this.container) this.container.innerHTML = '';
  }
}

window.DialogosScene = DialogosScene;
