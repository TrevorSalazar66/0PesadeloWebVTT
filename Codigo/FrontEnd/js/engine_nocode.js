/**
 * Motor No-Code (Gatilhos) para o Arcana VTT
 * Processa a lógica de [QUANDO] -> [SE] -> [ENTÃO] no lado do cliente
 * e despacha requisições autoritativas para o backend.
 */
class NoCodeEngine {
  constructor(apiClient, currentCampaignId) {
    this.apiClient = apiClient;
    this.campaignId = currentCampaignId;
  }

  /**
   * Avalia uma lista de regras para uma cena e aciona o evento.
   * @param {Array} rulesData - Array de regras { trigger, condition, actions }
   * @param {Object} eventContext - Dados do evento { triggerType, entityId, characterId, etc }
   * @param {String} sceneId - ID da cena atual
   */
  async processEvent(rulesData, eventContext, sceneId) {
    if (!rulesData || !Array.isArray(rulesData)) return;

    for (const rule of rulesData) {
      if (rule.trigger === eventContext.triggerType) {
        
        // Verifica a condição (SE)
        const conditionMet = this.evaluateCondition(rule.condition, eventContext);
        
        if (conditionMet) {
          // Executa as ações (ENTÃO)
          await this.executeActions(rule.actions, eventContext, sceneId);
        }
      }
    }
  }

  evaluateCondition(condition, context) {
    if (!condition) return true; // Se não tem condição, passa
    
    // Suporte futuro para: "if character_has_item X"
    return true;
  }

  async executeActions(actions, context, sceneId) {
    if (!actions || !Array.isArray(actions)) return;

    for (const action of actions) {
      switch (action.type) {
        case 'change_tile':
        case 'delete_tile':
        case 'create_tile':
          // Atualiza visual via P2P (ou atualizando state_data)
          if (window.p2pNetManager) {
             window.p2pNetManager.broadcast('scene_state_update', {
                sceneId,
                action: action.type,
                params: action.params
             });
          }
          break;
          
        case 'apply_damage':
        case 'heal_anima':
        case 'award_xp':
          // Ações autoritativas que mudam a ficha vão para o Backend
          try {
            const res = await this.apiClient.triggerSceneAction({
              campaignId: this.campaignId,
              sceneId: sceneId,
              trigger: context.triggerType,
              actionType: action.type,
              actionParams: action.params,
              characterId: context.characterId
            });
            if (res.sucesso && res.dados && res.dados.message) {
               console.log("[NoCodeEngine] Backend confirmou:", res.dados.message);
               // Atualiza o diário e HUD
               if (window.loadDiarioData) window.loadDiarioData();
               if (window.atualizarHudPersonagemPalco) window.atualizarHudPersonagemPalco();
            }
          } catch (e) {
            console.error("[NoCodeEngine] Erro na ação:", e);
          }
          break;
          
        case 'show_toast':
          alert(action.params || "Mensagem da Cena");
          break;
      }
    }
  }
}

window.NoCodeEngine = NoCodeEngine;
