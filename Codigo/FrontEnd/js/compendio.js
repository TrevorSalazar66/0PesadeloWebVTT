/**
 * Gerenciador de Compêndio e Herança Delta (Frontend - Oficina do Mestre & Comunidade)
 * Suporte a Blocos Visuais com chaves individuais de visibilidade no canto inferior direito.
 */

export const ITEM_TYPE_ENUM = {
  consumable: 'Consumível (Ação Única)',
  reusable_tool: 'Ferramenta / Utilitário (Reutilizável)',
  ammo: 'Munição / Cargas para Arma',
  quest_key: 'Chave / Item de Enigma',
  craft_ingredient: 'Ingrediente / Material de Oficina',
  passive_talisman: 'Talismã / Objeto Passivo'
};

export const COMPENDIUM_SKELETONS = {
  item: {
    category: 'item',
    name: 'Novo Item AlphaD6',
    baseAssetId: 'asset_potion_red',
    blocks: {
      bloco_nome: { label: 'Nome do Item', value: 'Poção de Anima Menor', is_visible: true },
      bloco_tipo_item: { label: 'Tipo de Item (Mecânica)', value: 'consumable', options: ITEM_TYPE_ENUM, is_visible: true },
      bloco_uso: { label: 'Modo de Acionamento', value: 'Ação Rápida (Consumível)', is_visible: true },
      bloco_quantidade: { label: 'Quantidade Inicial', value: 1, is_visible: true },
      bloco_max_pilha: { label: 'Limite de Empilhamento', value: 10, is_visible: true },
      bloco_efeito_alphad6: { 
        label: 'Efeito AlphaD6', 
        value: 'Restaura 2d6 de Anima imediatamente', 
        is_visible: true,
        actions: [
          { type: 'heal_anima', params: { dice: '2d6', target: 'self' } }
        ]
      },
      bloco_custo_uso: { label: 'Custo de Uso', value: 'Consome 1 item', is_visible: true },
      bloco_cargas_atuais: { label: 'Cargas Atuais', value: 1, is_visible: true },
      bloco_cargas_max: { label: 'Cargas Máximas', value: 1, is_visible: true },
      bloco_duracao_efeito: { label: 'Duração do Efeito', value: 'Instantâneo', is_visible: true },
      bloco_alcance_uso: { label: 'Alcance do Efeito', value: 'Próprio Usuário (Self)', is_visible: true },
      bloco_peso_slot: { label: 'Peso em Slots', value: 0.5, is_visible: true },
      bloco_valor_pratas: { label: 'Valor em Pratas', value: 25, is_visible: true },
      bloco_raridade: { label: 'Raridade', value: 'Comum', is_visible: true },
      bloco_requisito_uso: { label: 'Requisitos de Uso', value: '', is_visible: true },
      bloco_gatilho_quebra: { label: 'Gatilho ao Quebrar/Zerar', value: '', is_visible: true },
      bloco_descricao_narrativa: { label: 'Descrição Narrativa', value: 'Um pequeno frasco contendo um líquido avermelhado e denso.', is_visible: true },
      bloco_lore_oculta: { label: 'Lore Oculta / Segredo', value: 'Criada nos laboratórios arcanos do Nível 777.', is_visible: false }
    }
  },
  equipment: {
    category: 'equipment',
    name: 'Novo Equipamento / Arma',
    baseAssetId: 'asset_sword_iron',
    blocks: {
      bloco_tipo: { label: 'Tipo de Equipamento', value: 'Arma Cortante de Uma Mão', is_visible: true },
      bloco_dano: { label: 'Dano AlphaD6', value: '1d6 + Vigor', is_visible: true },
      bloco_alcance: { label: 'Alcance', value: 'Corpo a Corpo (1 Tile)', is_visible: true },
      bloco_peso: { label: 'Peso em Carga', value: '1 Slot', is_visible: true },
      bloco_durabilidade: { label: 'Durabilidade', value: '10/10', is_visible: true },
      bloco_requisito: { label: 'Requisitos', value: 'Vigor >= 1', is_visible: true }
    }
  },
  creature: {
    category: 'creature',
    name: 'Nova Criatura / NPC',
    baseAssetId: 'asset_npc_hooded',
    blocks: {
      bloco_vigor: { label: 'Vigor', value: 2, is_visible: true },
      bloco_agilidade: { label: 'Agilidade', value: 2, is_visible: true },
      bloco_mente: { label: 'Mente', value: 2, is_visible: true },
      bloco_anima: { label: 'Anima Total', value: 10, is_visible: true },
      bloco_defesa: { label: 'Defesa Passiva', value: '10', is_visible: true },
      bloco_ataque: { label: 'Ataque AlphaD6', value: 'Ataque Básico (1d6)', is_visible: true },
      bloco_lore_oculta: { label: 'Segredo Oculto', value: 'Informação secreta sobre o NPC', is_visible: false }
    }
  },
  power: {
    category: 'power',
    name: 'Novo Poder / Habilidade',
    baseAssetId: 'asset_spell_fire',
    blocks: {
      bloco_custo_anima: { label: 'Custo de Anima', value: '2 Anima', is_visible: true },
      bloco_alcance: { label: 'Alcance', value: '3 Tiles', is_visible: true },
      bloco_duracao: { label: 'Duração', value: 'Instantâneo', is_visible: true },
      bloco_efeito: { label: 'Efeito AlphaD6', value: 'Causa 1d6 + Mente de dano mágico', is_visible: true }
    }
  },
  clue: {
    category: 'clue',
    name: 'Nova Pista / Segredo',
    baseAssetId: 'asset_paper_scroll',
    blocks: {
      bloco_resumo: { label: 'Texto Visível', value: 'Uma nota antiga com pistas...', is_visible: true },
      bloco_lore_oculta: { label: 'Segredo Oculto', value: 'Segredo revelado apenas por gatilho', is_visible: false }
    }
  }
};

export class CompendiumUI {
  constructor(containerId, apiClient) {
    this.container = document.getElementById(containerId);
    this.apiClient = apiClient;
    this.currentCategory = 'item';
    this.items = [];
    this.activeItem = null;
  }

  async loadItems(campaignId = null) {
    try {
      const res = await this.apiClient.sync('compendium.list', { category: this.currentCategory, campaignId });
      if (res && res.sucesso) {
        this.items = res.dados || [];
        this.render();
      }
    } catch (e) {
      console.error('[CompendiumUI] Erro ao carregar itens:', e);
    }
  }

  renderBlockEditor(blocks, isMasterView = true) {
    if (!blocks || Object.keys(blocks).length === 0) return '<p class="text-muted">Nenhum bloco de propriedade cadastrado.</p>';

    let html = '<div class="compendium-blocks-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin-top: 15px;">';

    for (const [blockId, blockData] of Object.entries(blocks)) {
      const label = blockData.label || blockId;
      const val = blockData.value !== undefined ? blockData.value : '';
      const isVisible = blockData.is_visible !== false;

      // Se for visão do jogador e o campo for oculto OU estiver completamente vazio, ignora a renderização!
      if (!isMasterView && (!isVisible || val === '' || val === null)) {
        continue;
      }

      let inputHtml = '';
      if (blockData.options) {
        inputHtml = `<select class="compendium-block-input" data-block-id="${blockId}" style="width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 4px; box-sizing: border-box;">
          ${Object.entries(blockData.options).map(([optKey, optLabel]) => `
            <option value="${optKey}" ${val === optKey ? 'selected' : ''}>${optLabel}</option>
          `).join('')}
        </select>`;
      } else {
        inputHtml = `<input type="text" class="compendium-block-input" data-block-id="${blockId}" value="${val}" placeholder="Vazio (Ignorado se não preenchido)" style="width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 4px; box-sizing: border-box;">`;
      }

      html += `
        <div class="compendium-block-card" style="background: rgba(20, 20, 30, 0.85); border: 1px solid ${isVisible ? '#d4af37' : '#444'}; border-radius: 8px; padding: 12px; position: relative;">
          <div style="font-size: 0.8em; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">${label} <span style="color: #666;">(${blockId})</span></div>
          ${inputHtml}
          
          ${isMasterView ? `
            <!-- Chave de Visibilidade (Toggle On/Off no canto inferior direito) -->
            <div style="margin-top: 8px; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
              <span style="font-size: 0.75em; color: ${isVisible ? '#2eb886' : '#888'};">${isVisible ? 'Visível pros Jogadores' : 'Oculto (Mestre)'}</span>
              <label class="switch-toggle" style="position: relative; display: inline-block; width: 34px; height: 20px;">
                <input type="checkbox" class="compendium-block-toggle" data-block-id="${blockId}" ${isVisible ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isVisible ? '#2eb886' : '#444'}; border-radius: 20px; transition: .3s;"></span>
              </label>
            </div>
          ` : ''}
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  render() {
    if (!this.container) return;

    let html = `
      <div class="compendium-hub-wrapper" style="display: flex; gap: 20px; height: 100%; color: #e0e0e0;">
        <!-- Gaveta Esquerda: Filtros e Seleção -->
        <div class="compendium-drawer-left" style="width: 300px; background: rgba(15, 15, 25, 0.95); border-right: 1px solid #d4af37; padding: 15px; box-sizing: border-box;">
          <h3 style="color: #d4af37; margin-top: 0;">📚 Compêndio AlphaD6</h3>
          <div class="compendium-category-tabs" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
            <button class="btn-category ${this.currentCategory === 'item' ? 'active' : ''}" data-category="item">🧪 Consumíveis / Itens</button>
            <button class="btn-category ${this.currentCategory === 'equipment' ? 'active' : ''}" data-category="equipment">⚔️ Equipamentos & Armas</button>
            <button class="btn-category ${this.currentCategory === 'creature' ? 'active' : ''}" data-category="creature">👹 Criaturas & NPCs</button>
            <button class="btn-category ${this.currentCategory === 'power' ? 'active' : ''}" data-category="power">✨ Poderes & Magias</button>
            <button class="btn-category ${this.currentCategory === 'clue' ? 'active' : ''}" data-category="clue">📜 Pistas & Segredos</button>
          </div>
          
          <button id="btn-add-compendium-item" style="width: 100%; background: #d4af37; color: #000; font-weight: bold; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">+ Criar Elemento (${this.items.length}/100)</button>

          <div class="compendium-items-list" style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: calc(100vh - 280px);">
            ${this.items.map(item => `
              <div class="compendium-item-card ${this.activeItem?.id === item.id ? 'selected' : ''}" data-item-id="${item.id}" style="padding: 10px; border: 1px solid ${this.activeItem?.id === item.id ? '#d4af37' : '#333'}; border-radius: 6px; cursor: pointer; background: rgba(30, 30, 45, 0.6);">
                <div style="font-weight: bold; color: #fff;">${item.name}</div>
                <div style="font-size: 0.8em; color: #aaa;">${item.is_public ? '🌐 Público (Comunidade)' : '🔒 Privado (Mestre)'}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Painel Direiro: Construtor / Editor por Blocos -->
        <div class="compendium-editor-panel" style="flex: 1; padding: 20px; overflow-y: auto;">
          ${this.activeItem ? `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px;">
              <h2 style="color: #d4af37; margin: 0;">${this.activeItem.name}</h2>
              <button id="btn-save-compendium-item" style="background: #2eb886; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">Salvar Alterações</button>
            </div>

            <div style="margin-top: 15px;">
              <label style="display: block; font-size: 0.9em; color: #aaa;">Nome do Elemento:</label>
              <input type="text" id="compendium-item-name-input" value="${this.activeItem.name}" style="width: 100%; max-width: 400px; padding: 8px; background: #111; border: 1px solid #333; color: #fff; border-radius: 4px; margin-top: 5px;">
            </div>

            <div style="margin-top: 20px;">
              <h4 style="color: #d4af37; margin-bottom: 5px;">🧩 Blocos Visuais & Visibilidade Granular</h4>
              <p style="font-size: 0.85em; color: #aaa; margin: 0;">Cada bloco representa uma propriedade do elemento. Use a chave no canto inferior direito para definir o que o jogador enxerga.</p>
              ${this.renderBlockEditor(this.activeItem.resolved_blocks || this.activeItem.blocks)}
            </div>
          ` : `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #666; font-size: 1.1em;">
              Selecione um elemento na gaveta à esquerda ou crie um novo usando um dos esqueletos base AlphaD6.
            </div>
          `}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }
}
