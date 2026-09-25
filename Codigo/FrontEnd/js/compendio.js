/**
 * Gerenciador de Compêndio e Herança Delta (Frontend - Oficina do Mestre & Comunidade)
 * Suporte a Blocos Visuais com chaves individuais de visibilidade, Modais Dedicados e Motor No-Code [QUANDO ➔ ENTÃO].
 */

export const ITEM_TYPE_ENUM = {
  consumable: 'Consumível (Ação Única)',
  reusable_tool: 'Ferramenta / Utilitário (Reutilizável)',
  ammo: 'Munição / Cargas para Arma',
  quest_key: 'Chave / Item de Enigma',
  craft_ingredient: 'Ingrediente / Material de Oficina',
  passive_talisman: 'Talismã / Objeto Passivo'
};

export const ACTION_COST_TYPE_ENUM = {
  action_1: '1 Ação (Rápida)',
  action_2: '2 Ações',
  full_turn: 'Turno Completo (4 Ações)',
  reaction: 'Reação',
  free: 'Ação Livre (0 Ações)',
  passive: 'Passivo (Efeito Contínuo)',
  outside_combat: 'Fora de Combate (Descanso/Acampamento)'
};

export const ITEM_COST_MODE_ENUM = {
  destroy_item: 'Consome 1 Item da Pilha',
  spend_charge: 'Consome Cargas do Item',
  spend_anima: 'Consome Anima (Pontos Fixo)',
  spend_anima_percent: 'Consome Anima (% da Máxima)',
  none: 'Sem Custo de Recurso'
};

export const RANGE_TYPE_ENUM = {
  self: 'Próprio Usuário (Self)',
  touch: 'Toque (1 Tile / 1.5m)',
  ranged_tiles: 'À Distância (Tiles)',
  area_burst: 'Área / Explosão (Raio em Tiles)',
  cone: 'Cone (Comprimento em Tiles)',
  line: 'Linha Reta',
  global_scene: 'Toda a Cena / Mapa'
};

export const DURATION_TYPE_ENUM = {
  instant: 'Instantâneo',
  rounds: 'Rodadas em Combate',
  scenes: 'Cenas',
  until_short_rest: 'Até Próximo Descanso Curto',
  until_long_rest: 'Até Próximo Descanso Longo',
  permanent: 'Permanente (Equipado/Ativo)'
};

export const TRIGGER_EVENT_ENUM = {
  on_use: '⚡ Ao Ativar / Consumir',
  on_equip: '🛡️ Ao Equipar / Portar',
  on_turn_start: '⏳ No Início de Cada Turno',
  on_downed: '💀 Ao Entrar em Morrendo / Colapso',
  on_break_or_zero: '📦 Ao Quebrar / Zerar Cargas'
};

export const EXEC_ACTION_TYPE_ENUM = {
  heal_anima: '💚 Restaurar Anima (Cura)',
  damage: '⚔️ Causar Dano',
  apply_buff: '🛡️ Aplicar Bônus (+Defesa / +Atributo)',
  apply_debuff: '⚠️ Aplicar Penalidade (-Defesa / -Movimento)',
  remove_condition: '🌿 Remover Condição (Pânico, Sangramento)',
  grant_temp_anima: '✨ Conceder Anima Temporária',
  reveal_block: '📜 Revelar Bloco Oculto da Pista'
};

export const EQUIPMENT_CATEGORY_ENUM = {
  weapon_melee: 'Arma Branca / Corpo a Corpo',
  weapon_ranged: 'Arma de Fogo / À Distância',
  armor: 'Armadura / Traje',
  shield: 'Escudo / Parada',
  arcane_focus: 'Foco Arcano / Canalizador',
  accessory: 'Acessório / Objeto Equipável'
};

export const EQUIPMENT_SLOT_ENUM = {
  mao_primaria: 'Mão Primária',
  mao_secundaria: 'Mão Secundária',
  duas_maos: 'Duas Mãos (Ambas)',
  tronco: 'Tronco / Armadura',
  cabeca: 'Cabeça / Capacete/Visor',
  costas: 'Costas / Tenda/Mochila',
  acessorios: 'Acessório / Relíquia'
};

export const WEAPON_DAMAGE_TYPE_ENUM = {
  slashing: 'Cortante',
  piercing: 'Perfurante',
  bludgeoning: 'Impacto / Contundente',
  ballistic: 'Balístico / Fogo',
  fire: 'Fogo / Elemental',
  arcane: 'Arcano / Éter'
};

export const CREATURE_TYPE_ENUM = {
  ally_npc: 'PNJ / Aliado',
  minion: 'Inimigo Comum / Capanga',
  elite: 'Inimigo Elite',
  boss: 'Chefe / Monstro Lendário',
  aberration: 'Aberração / Entidade do Vazio'
};

export const CREATURE_SIZE_ENUM = {
  tiny: 'Miúdo (0.5 Tile)',
  small: 'Pequeno (1 Tile)',
  medium: 'Médio (1 Tile)',
  large: 'Grande (2x2 Tiles)',
  huge: 'Enorme (3x3 Tiles)',
  colossal: 'Colossal (4x4+ Tiles)'
};

export const POWER_TYPE_ENUM = {
  active_spell: 'Magia Ativa (Conjuração)',
  passive_perk: 'Técnica Passiva / Talento',
  combat_technique: 'Manobra de Combate / Marcial',
  ritual: 'Ritual Extenso (Fora de Combate)',
  aura: 'Aura / Efeito de Área Sustentado'
};

export const POWER_ORIGIN_ENUM = {
  arcane: 'Arcano / Éter',
  divine_spiritual: 'Divino / Espiritual',
  elemental: 'Elemental / Natureza',
  martial_tactical: 'Marcial / Tático',
  void_occult: 'Ocultismo / Vazio'
};

export const CLUE_TYPE_ENUM = {
  document: 'Documento / Carta / Diário',
  artifact_inscription: 'Inscrição Rúnica / Monólito',
  map_fragment: 'Mapa / Fragmento de Rota',
  cipher_puzzle: 'Cifra / Enigma Críptico',
  testimony: 'Depoimento / Pista Oral'
};

export const REVELATION_DIFFICULTY_ENUM = {
  automatic: 'Automática (Visível ao Encontrar)',
  skill_check: 'Teste de Perícia (Investigação/Ocultismo)',
  item_trigger: 'Gatilho de Item (Requer Objeto Específico)',
  master_only: 'Manual (Apenas Ação do Mestre)'
};

export const COMPENDIUM_SKELETONS = {
  item: {
    category: 'item',
    name: 'Novo Item Consumível',
    icon: '🧪',
    is_custom: true,
    blocks: {
      bloco_nome: { label: 'Nome do Item', value: 'Cura Rápida Consumível', is_visible: true },
      bloco_tipo_item: { label: 'Tipo de Item', value: 'consumable', options: ITEM_TYPE_ENUM, is_visible: true },
      bloco_raridade: { label: 'Raridade', value: 'Comum', options: { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', epico: 'Épico', reliquia: 'Relíquia' }, is_visible: true },
      bloco_quantidade: { label: 'Quantidade Inicial', value: 1, type: 'number', is_visible: true },
      bloco_peso_slot: { label: 'Peso em Slots', value: 1, type: 'number', is_visible: true },
      bloco_valor_pratas: { label: 'Valor em Pratas', value: 50, type: 'number', is_visible: true },
      bloco_modo_acionamento: { label: 'Modo de Acionamento', value: 'action_1', options: ACTION_COST_TYPE_ENUM, is_visible: true },
      bloco_modo_custo: { label: 'Modo de Custo', value: 'spend_charge', options: ITEM_COST_MODE_ENUM, is_visible: true },
      bloco_alcance_tipo: { label: 'Tipo de Alcance', value: 'self', options: RANGE_TYPE_ENUM, is_visible: true },
      bloco_duracao_tipo: { label: 'Tipo de Duração', value: 'instant', options: DURATION_TYPE_ENUM, is_visible: true },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_use', action_type: 'heal_anima', formula: '1d6 + Corpo', target: 'self' }
        ]
      },
      bloco_descricao_narrativa: { label: 'Descrição Narrativa', value: 'Gasta 1 ação (3 doses). Cada dose recupera 1d6 + Corpo de Anima.', is_visible: true },
      bloco_lore_oculta: { label: 'Lore Oculta / Segredo', value: 'Formulações médicas padrões das caravanas de Ouroburgo.', is_visible: false }
    }
  },
  equipment: {
    category: 'equipment',
    name: 'Novo Equipamento / Arma',
    icon: '⚔️',
    is_custom: true,
    blocks: {
      bloco_nome: { label: 'Nome do Equipamento', value: 'Espada Longa de Aço', is_visible: true },
      bloco_categoria_equip: { label: 'Categoria', value: 'weapon_melee', options: EQUIPMENT_CATEGORY_ENUM, is_visible: true },
      bloco_slot: { label: 'Slot', value: 'mao_primaria', options: EQUIPMENT_SLOT_ENUM, is_visible: true },
      bloco_raridade: { label: 'Raridade', value: 'Comum', options: { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', epico: 'Épico', reliquia: 'Relíquia' }, is_visible: true },
      bloco_atributo_base: { label: 'Atributo Base', value: 'corpo', options: { corpo: 'Corpo', mente: 'Mente', espirito: 'Espírito', social: 'Social' }, is_visible: true },
      bloco_formula_dano: { label: 'Fórmula de Dano', value: '1d6+2', type: 'string', is_visible: true },
      bloco_tipo_dano: { label: 'Tipo de Dano', value: 'slashing', options: WEAPON_DAMAGE_TYPE_ENUM, is_visible: true },
      bloco_bonus_defesa: { label: 'Bônus de Defesa', value: 0, type: 'number', is_visible: true },
      bloco_peso_slots: { label: 'Peso em Slots', value: 2, type: 'number', is_visible: true },
      bloco_valor_pratas: { label: 'Valor em Pratas', value: 150, type: 'number', is_visible: true },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_use', action_type: 'damage', formula: '1d6+2', target: 'target' }
        ]
      },
      bloco_descricao_narrativa: { label: 'Descrição Narrativa', value: 'Lâmina nobre forjada em aço temperado com empunhadura reforçada.', is_visible: true },
      bloco_lore_oculta: { label: 'Lore Oculta / Segredo', value: 'Forjada pelos mestres de ferro das Forjas Centrais.', is_visible: false }
    }
  },
  creature: {
    category: 'creature',
    name: 'Nova Criatura / NPC',
    icon: '👹',
    is_custom: true,
    blocks: {
      bloco_nome: { label: 'Nome da Criatura', value: 'Capanga das Sombras', is_visible: true },
      bloco_tipo_criatura: { label: 'Classificação', value: 'minion', options: CREATURE_TYPE_ENUM, is_visible: true },
      bloco_tamanho: { label: 'Tamanho em Tiles', value: 'medium', options: CREATURE_SIZE_ENUM, is_visible: true },
      bloco_corpo: { label: 'Corpo (d6)', value: 2, type: 'number', is_visible: true },
      bloco_mente: { label: 'Mente (d6)', value: 1, type: 'number', is_visible: true },
      bloco_espirito: { label: 'Espírito (d6)', value: 1, type: 'number', is_visible: true },
      bloco_social: { label: 'Social (d6)', value: 1, type: 'number', is_visible: true },
      bloco_anima_max: { label: 'Anima Máxima', value: 10, type: 'number', is_visible: true },
      bloco_defesa_passiva: { label: 'Defesa Passiva', value: 10, type: 'number', is_visible: true },
      bloco_deslocamento_m: { label: 'Deslocamento (m)', value: 6, type: 'number', is_visible: true },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_turn_start', action_type: 'apply_buff', formula: '+0 Defesa', target: 'self' }
        ]
      },
      bloco_descricao_narrativa: { label: 'Descrição Visual', value: 'Figura encapuzada armada com adagas enferrujadas.', is_visible: true },
      bloco_lore_oculta: { label: 'Lore Oculta / Segredo', value: 'Foge se o líder for derrotado.', is_visible: false }
    }
  },
  power: {
    category: 'power',
    name: 'Novo Poder / Magia',
    icon: '✨',
    is_custom: true,
    blocks: {
      bloco_nome: { label: 'Nome do Poder', value: 'Explosão de Éter', is_visible: true },
      bloco_tipo_poder: { label: 'Tipo de Poder', value: 'active_spell', options: POWER_TYPE_ENUM, is_visible: true },
      bloco_origem: { label: 'Origem', value: 'arcane', options: POWER_ORIGIN_ENUM, is_visible: true },
      bloco_nivel_complexidade: { label: 'Nível', value: 1, type: 'number', is_visible: true },
      bloco_modo_acionamento: { label: 'Custo de Ações', value: 'action_1', options: ACTION_COST_TYPE_ENUM, is_visible: true },
      bloco_custo_anima: { label: 'Custo de Anima', value: 2, type: 'number', is_visible: true },
      bloco_alcance_tipo: { label: 'Tipo de Alcance', value: 'ranged_tiles', options: RANGE_TYPE_ENUM, is_visible: true },
      bloco_alcance_distancia: { label: 'Distância (Tiles)', value: 3, type: 'number', is_visible: true },
      bloco_duracao_tipo: { label: 'Duração', value: 'instant', options: DURATION_TYPE_ENUM, is_visible: true },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_use', action_type: 'damage', formula: '1d6 + Mente', target: 'area' }
        ]
      },
      bloco_descricao_narrativa: { label: 'Manifestação Visual', value: 'Detonação de energia reluzente que atinge o alvo com concussão arcana.', is_visible: true },
      bloco_lore_oculta: { label: 'Lore Oculta / Segredo', value: 'Supercarrega sob tempestades arcanas.', is_visible: false }
    }
  },
  clue: {
    category: 'clue',
    name: 'Nova Pista / Segredo',
    icon: '📜',
    is_custom: true,
    blocks: {
      bloco_nome: { label: 'Nome da Pista', value: 'Carta Antiga do Arquivista', is_visible: true },
      bloco_tipo_pista: { label: 'Tipo de Pista', value: 'document', options: CLUE_TYPE_ENUM, is_visible: true },
      bloco_modo_revelacao: { label: 'Modo de Revelação', value: 'skill_check', options: REVELATION_DIFFICULTY_ENUM, is_visible: true },
      bloco_pericia_requerida: { label: 'Especialização', value: 'Investigação', type: 'string', is_visible: true },
      bloco_meta_sucessos: { label: 'Meta de Sucessos', value: 2, type: 'number', is_visible: true },
      bloco_resumo_publico: { label: 'Trecho Público', value: 'Uma missiva rasgada com selo de cera vermelha...', is_visible: true },
      bloco_conteudo_decifrado: { label: 'Conteúdo Decifrado', value: 'A senha do cofre subterrâneo é "Éter-7".', is_visible: false },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_use', action_type: 'reveal_block', formula: 'bloco_conteudo_decifrado', target: 'self' }
        ]
      },
      bloco_lore_oculta: { label: 'Segredo do Mestre', value: 'Escrito pelo antigo grão-mestre antes de sua queda.', is_visible: false }
    }
  }
};

/**
 * CATÁLOGO CANÔNICO OFICIAL DO SISTEMA ALPHAD6
 */
export const SYSTEM_COMPENDIUM_DATABASE = [
  {
    id: 'cura_rapida',
    category: 'item',
    icon: '🧪',
    name: 'Cura Rápida Consumível',
    is_custom: false,
    origin_type: 'system',
    short_desc: 'Gasta 1 ação (3 doses). Cada dose recupera 1d6 + Corpo de Anima.',
    blocks: {
      bloco_nome: { label: 'Nome do Item', value: 'Cura Rápida Consumível', is_visible: true },
      bloco_tipo_item: { label: 'Tipo de Item', value: 'consumable', options: ITEM_TYPE_ENUM, is_visible: true },
      bloco_raridade: { label: 'Raridade', value: 'Comum', is_visible: true },
      bloco_quantidade: { label: 'Doses Máximas', value: 3, type: 'number', is_visible: true },
      bloco_peso_slot: { label: 'Peso em Slots', value: 1, type: 'number', is_visible: true },
      bloco_valor_pratas: { label: 'Valor em Pratas', value: 50, type: 'number', is_visible: true },
      bloco_modo_acionamento: { label: 'Custo de Ação', value: 'action_1', options: ACTION_COST_TYPE_ENUM, is_visible: true },
      bloco_modo_custo: { label: 'Modo de Custo', value: 'spend_charge', options: ITEM_COST_MODE_ENUM, is_visible: true },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_use', action_type: 'heal_anima', formula: '1d6 + Corpo', target: 'self' }
        ]
      },
      bloco_descricao_narrativa: { label: 'Descrição', value: 'Frasco de elixir estabilizado de rápida absorção celular.', is_visible: true },
      bloco_lore_oculta: { label: 'Lore Oculta', value: 'Fórmula padronizada das guildas de batedores.', is_visible: false }
    }
  },
  {
    id: 'arma_cortante_grande',
    category: 'equipment',
    icon: '⚔️',
    name: 'Espada Longa / Machado de Batalha',
    is_custom: false,
    origin_type: 'system',
    short_desc: 'Arma Branca (1d6+2 Dano). Cortante. Slot Mão Primária.',
    blocks: {
      bloco_nome: { label: 'Nome', value: 'Espada Longa / Machado de Batalha', is_visible: true },
      bloco_categoria_equip: { label: 'Categoria', value: 'weapon_melee', options: EQUIPMENT_CATEGORY_ENUM, is_visible: true },
      bloco_slot: { label: 'Slot', value: 'mao_primaria', options: EQUIPMENT_SLOT_ENUM, is_visible: true },
      bloco_atributo_base: { label: 'Atributo Base', value: 'corpo', is_visible: true },
      bloco_formula_dano: { label: 'Fórmula de Dano', value: '1d6+2', is_visible: true },
      bloco_tipo_dano: { label: 'Tipo de Dano', value: 'Cortante', is_visible: true },
      bloco_peso_slots: { label: 'Peso em Slots', value: 2, type: 'number', is_visible: true },
      bloco_valor_pratas: { label: 'Valor em Pratas', value: 150, type: 'number', is_visible: true },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_use', action_type: 'damage', formula: '1d6+2', target: 'target' }
        ]
      },
      bloco_descricao_narrativa: { label: 'Descrição', value: 'Lâmina nobre forjada em aço temperado.', is_visible: true },
      bloco_lore_oculta: { label: 'Lore Oculta', value: 'Arma padrão dos cavaleiros de fronteira.', is_visible: false }
    }
  },
  {
    id: 'sys_creature_01',
    category: 'creature',
    icon: '👹',
    name: 'Capanga das Sombras',
    is_custom: false,
    origin_type: 'system',
    short_desc: 'Inimigo Comum (Minion). Corpo 2d6, Anima 10, Defesa 10.',
    blocks: {
      bloco_nome: { label: 'Nome', value: 'Capanga das Sombras', is_visible: true },
      bloco_tipo_criatura: { label: 'Tipo', value: 'minion', options: CREATURE_TYPE_ENUM, is_visible: true },
      bloco_tamanho: { label: 'Tamanho', value: 'medium', options: CREATURE_SIZE_ENUM, is_visible: true },
      bloco_corpo: { label: 'Corpo', value: 2, type: 'number', is_visible: true },
      bloco_mente: { label: 'Mente', value: 1, type: 'number', is_visible: true },
      bloco_espirito: { label: 'Espírito', value: 1, type: 'number', is_visible: true },
      bloco_social: { label: 'Social', value: 1, type: 'number', is_visible: true },
      bloco_anima_max: { label: 'Anima Máx', value: 10, type: 'number', is_visible: true },
      bloco_defesa_passiva: { label: 'Defesa Passiva', value: 10, type: 'number', is_visible: true },
      bloco_deslocamento_m: { label: 'Deslocamento (m)', value: 6, type: 'number', is_visible: true },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_turn_start', action_type: 'apply_buff', formula: '+0 Defesa', target: 'self' }
        ]
      },
      bloco_descricao_narrativa: { label: 'Aparência', value: 'Figura encapuzada armada com adagas enferrujadas e semblante sombrio.', is_visible: true },
      bloco_lore_oculta: { label: 'Segredo do Mestre', value: 'Foge se o líder for derrotado.', is_visible: false }
    }
  },
  {
    id: 'encantamento_protecao',
    category: 'power',
    icon: '🔮',
    name: 'Encantamento & Proteção Arcana',
    is_custom: false,
    origin_type: 'system',
    short_desc: 'Magia de Santuário. Concede barreira mística e cura 1d6 de Anima.',
    blocks: {
      bloco_nome: { label: 'Nome do Poder', value: 'Encantamento & Proteção Arcana', is_visible: true },
      bloco_tipo_poder: { label: 'Tipo', value: 'active_spell', options: POWER_TYPE_ENUM, is_visible: true },
      bloco_origem: { label: 'Origem', value: 'divine_spiritual', options: POWER_ORIGIN_ENUM, is_visible: true },
      bloco_nivel_complexidade: { label: 'Nível', value: 1, type: 'number', is_visible: true },
      bloco_modo_acionamento: { label: 'Custo de Ações', value: 'action_1', options: ACTION_COST_TYPE_ENUM, is_visible: true },
      bloco_custo_anima: { label: 'Custo Anima', value: 2, type: 'number', is_visible: true },
      bloco_alcance_tipo: { label: 'Tipo de Alcance', value: 'touch', options: RANGE_TYPE_ENUM, is_visible: true },
      bloco_duracao_tipo: { label: 'Duração', value: 'instant', options: DURATION_TYPE_ENUM, is_visible: true },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_use', action_type: 'heal_anima', formula: '1d6', target: 'self' }
        ]
      },
      bloco_descricao_narrativa: { label: 'Efeito Visual', value: 'Um domo reluzente reveste o alvo absorvendo o próximo impacto.', is_visible: true },
      bloco_lore_oculta: { label: 'Lore Oculta', value: 'Rito tradicional dos guardiões espirituais.', is_visible: false }
    }
  },
  {
    id: 'sys_clue_01',
    category: 'clue',
    icon: '📜',
    name: 'Carta Antiga do Arquivista',
    is_custom: false,
    origin_type: 'system',
    short_desc: 'Pista (Documento). Requer Investigação (2 Sucessos) para decifrar.',
    blocks: {
      bloco_nome: { label: 'Nome da Pista', value: 'Carta Antiga do Arquivista', is_visible: true },
      bloco_tipo_pista: { label: 'Tipo', value: 'document', options: CLUE_TYPE_ENUM, is_visible: true },
      bloco_modo_revelacao: { label: 'Modo Revelação', value: 'skill_check', options: REVELATION_DIFFICULTY_ENUM, is_visible: true },
      bloco_pericia_requerida: { label: 'Perícia', value: 'Investigação', is_visible: true },
      bloco_meta_sucessos: { label: 'Sucessos Necessários', value: 2, type: 'number', is_visible: true },
      bloco_resumo_publico: { label: 'Texto Público', value: 'Uma missiva rasgada com selo de cera vermelha...', is_visible: true },
      bloco_conteudo_decifrado: { label: 'Decifrado', value: 'A senha do cofre subterrâneo é "Éter-7".', is_visible: false },
      bloco_gatilhos_efeitos: {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: [
          { id: 'trig_01', event: 'on_use', action_type: 'reveal_block', formula: 'bloco_conteudo_decifrado', target: 'self' }
        ]
      },
      bloco_lore_oculta: { label: 'Segredo do Mestre', value: 'O autor foi assassinado antes de enviar a carta.', is_visible: false }
    }
  }
];

export class CompendiumUI {
  constructor(containerId = 'hub-modal-compendio', apiClient = null) {
    this.container = document.getElementById(containerId);
    this.apiClient = apiClient;
    this.activeTab = 'system'; // 'system' (Compêndio do Sistema) | 'custom' (Criações/Comunidade)
    this.activeCategory = 'all'; // 'all', 'item', 'equipment', 'creature', 'power', 'clue'
    this.searchQuery = '';
    this.selectedItemId = null;
    this.customItems = this.loadCustomItemsFromStorage();
  }

  async loadItems(campaignId = null) {
    try {
      if (this.apiClient && typeof this.apiClient.sync === 'function') {
        const res = await this.apiClient.sync('compendium.list', { category: this.activeCategory, campaignId });
        if (res && res.sucesso && Array.isArray(res.dados) && res.dados.length > 0) {
          const remoteItems = res.dados;
          remoteItems.forEach(rItem => {
            if (!SYSTEM_COMPENDIUM_DATABASE.some(s => s.id === rItem.id)) {
              SYSTEM_COMPENDIUM_DATABASE.push(rItem);
            }
          });
        }
      }
    } catch (e) {
      console.log('[CompendiumUI] Utilizando catálogo canônico do AlphaD6.');
    }
    this.render();
  }

  loadCustomItemsFromStorage() {
    try {
      const stored = localStorage.getItem('pesadelo_custom_compendium');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('[CompendiumUI] Falha ao carregar itens customizados:', e);
      return [];
    }
  }

  saveCustomItemsToStorage() {
    try {
      localStorage.setItem('pesadelo_custom_compendium', JSON.stringify(this.customItems));
    } catch (e) {
      console.error('[CompendiumUI] Falha ao salvar itens customizados:', e);
    }
  }

  getFilteredItems() {
    const sourceList = this.activeTab === 'system' ? SYSTEM_COMPENDIUM_DATABASE : this.customItems;
    return sourceList.filter(item => {
      const matchCategory = this.activeCategory === 'all' || item.category === this.activeCategory;
      const q = this.searchQuery.toLowerCase().trim();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.short_desc && item.short_desc.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }

  init() {
    this.injectModalsMarkup();
    this.loadItems();
    this.bindEvents();
  }

  injectModalsMarkup() {
    if (this.container) {
      this.container.innerHTML = `
        <div class="modal-content hub-modal compendium-modal-fullscreen" style="width: 90vw; max-width: 1400px; height: 90vh; display: flex; flex-direction: column; background: #0b0b14; border: 1px solid var(--border-gold); border-radius: 16px; padding: 24px; box-sizing: border-box; overflow: hidden; box-shadow: 0 0 40px rgba(0,0,0,0.8);">
          
          <!-- CABEÇALHO DO COMPÊNDIO -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 16px; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h2 class="modal-title" style="color: var(--gold-light); margin: 0; font-family: var(--font-title); font-size: 22px; display: flex; align-items: center; gap: 10px;">
                <span>📚</span> Compêndio do Sistema & Oficina Homebrew
              </h2>
              <p style="color: var(--text-muted); font-size: 13px; margin: 4px 0 0 0;">
                Navegue pelos elementos oficiais do sistema AlphaD6, crie novos itens/criaturas e gerencie automações No-Code.
              </p>
            </div>
            
            <div style="display: flex; align-items: center; gap: 12px;">
              <button class="btn-primary" id="btn-comp-new-item" style="padding: 8px 16px; font-size: 13px;">➕ Criar Novo Elemento</button>
              <button class="btn-close-modal" id="btn-comp-close-main" style="background: none; border: none; color: #fff; font-size: 28px; cursor: pointer; line-height: 1;">×</button>
            </div>
          </div>

          <!-- NAVEGAÇÃO DE ORIGEM DA BASE (ABAS DE SEPARAÇÃO) -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div class="compendium-origin-tabs" style="display: flex; gap: 8px; background: rgba(255,255,255,0.03); padding: 4px; border-radius: 10px; border: 1px solid var(--border-subtle);">
              <button class="tab-origin-btn ${this.activeTab === 'system' ? 'active' : ''}" data-tab="system" style="padding: 8px 16px; border-radius: 8px; border: none; background: ${this.activeTab === 'system' ? 'var(--gold-dark)' : 'transparent'}; color: ${this.activeTab === 'system' ? 'var(--gold-light)' : 'var(--text-muted)'}; border: 1px solid ${this.activeTab === 'system' ? 'var(--gold-border-dark)' : 'transparent'}; font-weight: 600; cursor: pointer;">
                📜 Compêndio Oficial do Sistema (${SYSTEM_COMPENDIUM_DATABASE.length})
              </button>
              <button class="tab-origin-btn ${this.activeTab === 'custom' ? 'active' : ''}" data-tab="custom" style="padding: 8px 16px; border-radius: 8px; border: none; background: ${this.activeTab === 'custom' ? 'var(--gold-dark)' : 'transparent'}; color: ${this.activeTab === 'custom' ? 'var(--gold-light)' : 'var(--text-muted)'}; border: 1px solid ${this.activeTab === 'custom' ? 'var(--gold-border-dark)' : 'transparent'}; font-weight: 600; cursor: pointer;">
                🛠️ Minhas Criações / Edições & Comunidade (${this.customItems.length})
              </button>
            </div>

            <!-- CAMPO DE BUSCA -->
            <div style="position: relative; min-width: 260px;">
              <input type="text" id="comp-search-input" placeholder="🔍 Buscar elemento por nome..." value="${this.searchQuery}" style="width: 100%; background: #121222; border: 1px solid var(--border-card); color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px; box-sizing: border-box;">
            </div>
          </div>

          <!-- BARRA DE FILTROS POR CATEGORIA -->
          <div class="compendium-category-filters" style="display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 4px;">
            <button class="cat-filter-btn ${this.activeCategory === 'all' ? 'active' : ''}" data-cat="all">🌟 Todos</button>
            <button class="cat-filter-btn ${this.activeCategory === 'item' ? 'active' : ''}" data-cat="item">🧪 Consumíveis / Itens</button>
            <button class="cat-filter-btn ${this.activeCategory === 'equipment' ? 'active' : ''}" data-cat="equipment">⚔️ Equipamentos & Armas</button>
            <button class="cat-filter-btn ${this.activeCategory === 'creature' ? 'active' : ''}" data-cat="creature">👹 Criaturas & NPCs</button>
            <button class="cat-filter-btn ${this.activeCategory === 'power' ? 'active' : ''}" data-cat="power">✨ Poderes & Magias</button>
            <button class="cat-filter-btn ${this.activeCategory === 'clue' ? 'active' : ''}" data-cat="clue">📜 Pistas & Segredos</button>
          </div>

          <!-- CONTAINER DA GRADE DE RETÂNGULOS (CARDS DE ELEMENTOS) -->
          <div class="compendium-cards-grid-container" style="flex: 1; overflow-y: auto; padding-right: 4px;">
            <div id="compendium-items-rect-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px;">
              <!-- Cards inseridos dinamicamente -->
            </div>
          </div>
        </div>
      `;
    }

    if (!document.getElementById('modal-compendio-detalhes')) {
      const detailsModal = document.createElement('div');
      detailsModal.id = 'modal-compendio-detalhes';
      detailsModal.className = 'modal-overlay';
      detailsModal.style.cssText = 'display: none; z-index: 1100; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);';
      detailsModal.innerHTML = `
        <div class="modal-content" style="width: 90%; max-width: 800px; max-height: 85vh; display: flex; flex-direction: column; background: #10101d; border: 1px solid var(--gold-light); border-radius: 14px; padding: 24px; box-shadow: 0 0 30px rgba(212,163,75,0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span id="comp-det-icon" style="font-size: 32px;">📜</span>
              <div>
                <h2 id="comp-det-title" style="color: var(--gold-light); margin: 0; font-family: var(--font-title); font-size: 20px;">Detalhes do Elemento</h2>
                <span id="comp-det-badge" style="font-size: 11px; color: var(--text-muted);">Origem</span>
              </div>
            </div>
            <button type="button" class="btn-secondary" onclick="document.getElementById('modal-compendio-detalhes').style.display='none'" style="padding: 4px 12px; font-size: 14px;">✕ Fechar</button>
          </div>
          
          <div id="comp-det-body" style="flex: 1; overflow-y: auto; padding-right: 8px;">
            <!-- Blocos detalhados renderizados via JS -->
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 14px;" id="comp-det-actions">
            <!-- Botões de ação -->
          </div>
        </div>
      `;
      document.body.appendChild(detailsModal);
    }

    if (!document.getElementById('modal-compendio-editor')) {
      const editorModal = document.createElement('div');
      editorModal.id = 'modal-compendio-editor';
      editorModal.className = 'modal-overlay';
      editorModal.style.cssText = 'display: none; z-index: 1200; background: rgba(0,0,0,0.9); backdrop-filter: blur(6px);';
      editorModal.innerHTML = `
        <div class="modal-content" style="width: 90%; max-width: 950px; max-height: 90vh; display: flex; flex-direction: column; background: #0c0c16; border: 1px solid var(--gold-light); border-radius: 14px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px;">
            <h2 id="comp-editor-title" style="color: var(--gold-light); margin: 0; font-family: var(--font-title); font-size: 20px;">✏️ Editor de Elemento do Compêndio</h2>
            <button type="button" class="btn-secondary" onclick="document.getElementById('modal-compendio-editor').style.display='none'" style="padding: 4px 12px; font-size: 14px;">✕ Cancelar</button>
          </div>
          
          <form id="form-comp-editor" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;" onsubmit="event.preventDefault();">
            <input type="hidden" id="edit-comp-id">
            <input type="hidden" id="edit-comp-category">

            <div style="display: grid; grid-template-columns: 1fr 120px; gap: 12px; margin-bottom: 16px;">
              <div>
                <label style="font-size: 12px; color: var(--gold-light); font-weight: 600;">Nome do Elemento</label>
                <input type="text" id="edit-comp-name" class="form-control" style="width: 100%; background: #141424; border: 1px solid var(--border-card); color: #fff; padding: 8px; border-radius: 6px; margin-top: 4px;" required>
              </div>
              <div>
                <label style="font-size: 12px; color: var(--gold-light); font-weight: 600;">Ícone / Emoji</label>
                <input type="text" id="edit-comp-icon" class="form-control" style="width: 100%; background: #141424; border: 1px solid var(--border-card); color: #fff; padding: 8px; border-radius: 6px; margin-top: 4px; text-align: center; font-size: 18px;" required>
              </div>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="font-size: 12px; color: var(--gold-light); font-weight: 600;">Descrição Curta de Apresentação</label>
              <input type="text" id="edit-comp-short-desc" class="form-control" style="width: 100%; background: #141424; border: 1px solid var(--border-card); color: #fff; padding: 8px; border-radius: 6px; margin-top: 4px;" placeholder="Resumo exibido no card principal">
            </div>

            <h4 style="color: var(--gold-light); font-size: 14px; margin: 12px 0 6px 0;">🧩 Edição dos Blocos Visuais & Visibilidade Granular</h4>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Use a chave em cada bloco para definir o que fica visível para os Jogadores ou Oculto (exclusivo do Mestre).</p>

            <div id="comp-editor-blocks-list" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; padding: 4px;">
              <!-- Blocos dinâmicos inseridos via JS -->
            </div>

            <!-- CONSTRUTOR VISUAL NO-CODE (GATILHOS E EFEITOS AUTOMATIZADOS) -->
            <div style="margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="color: var(--gold-light); font-size: 14px; margin: 0;">⚡ Motor No-Code: Gatilhos & Efeitos Automatizados</h4>
                <button type="button" class="btn-secondary" id="btn-add-nocode-trigger" style="font-size: 11px; padding: 4px 10px;">➕ Adicionar Gatilho</button>
              </div>
              <div id="nocode-triggers-editor-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto;">
                <!-- Regras de gatilhos inseridas via JS -->
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
              <span style="font-size: 12px; color: var(--text-muted);">Salvamento automático na aba de Minhas Criações / Homebrew.</span>
              <div style="display: flex; gap: 12px;">
                <button type="button" class="btn-secondary" onclick="document.getElementById('modal-compendio-editor').style.display='none'">Cancelar</button>
                <button type="button" class="btn-primary" id="btn-save-comp-editor" style="padding: 8px 24px;">💾 Salvar Elemento</button>
              </div>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(editorModal);
    }
  }

  render() {
    const gridEl = document.getElementById('compendium-items-rect-grid');
    if (!gridEl) return;

    const items = this.getFilteredItems();

    if (items.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: var(--text-dim); background: rgba(15,15,25,0.4); border: 1px dashed var(--border-subtle); border-radius: 12px;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h3 style="color: #fff; font-size: 16px; margin-bottom: 6px;">Nenhum elemento encontrado nesta categoria</h3>
          <p style="font-size: 13px; max-width: 400px; margin: 0 auto; line-height: 1.5;">
            ${this.activeTab === 'system' ? 'Não há itens do sistema correspondentes aos filtros selecionados.' : 'Você ainda não possui criações ou edições personalizadas nesta categoria. Clique no botão "Criar Novo Elemento" acima para começar!'}
          </p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = items.map(item => {
      const isSelected = this.selectedItemId === item.id;
      const originBadge = item.is_custom ? '🛠️ Homebrew / Mestre' : '📜 Oficial Sistema';

      return `
        <div class="compendium-card-rect ${isSelected ? 'selected' : ''}" data-item-id="${item.id}" style="display: flex; align-items: center; gap: 14px; background: ${isSelected ? 'rgba(40, 35, 20, 0.75)' : 'rgba(20, 20, 35, 0.85)'}; border: ${isSelected ? '2px solid var(--gold-light)' : '1px solid var(--border-card)'}; border-radius: 12px; padding: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: ${isSelected ? '0 0 15px rgba(212, 163, 75, 0.3)' : 'none'}; position: relative; overflow: hidden;">
          
          <div style="width: 52px; height: 52px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0;">
            ${item.icon || '📜'}
          </div>

          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px;">
              <h4 style="margin: 0; color: ${isSelected ? 'var(--gold-light)' : '#ffffff'}; font-size: 15px; font-weight: 700; font-family: var(--font-title); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${item.name}
              </h4>
              <span style="font-size: 10px; padding: 2px 8px; border-radius: 20px; background: ${item.is_custom ? 'rgba(168, 85, 247, 0.15)' : 'rgba(212, 163, 75, 0.15)'}; color: ${item.is_custom ? '#c084fc' : 'var(--gold-light)'}; border: 1px solid ${item.is_custom ? 'rgba(168, 85, 247, 0.3)' : 'rgba(212, 163, 75, 0.3)'}; white-space: nowrap; flex-shrink: 0;">
                ${originBadge}
              </span>
            </div>

            <p style="margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${item.short_desc || (item.blocks && item.blocks.bloco_descricao_narrativa ? item.blocks.bloco_descricao_narrativa.value : 'Sem descrição cadastrada.')}
            </p>
          </div>
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    const btnCloseMain = document.getElementById('btn-comp-close-main');
    if (btnCloseMain) {
      btnCloseMain.onclick = () => {
        if (this.container) this.container.style.display = 'none';
      };
    }

    document.querySelectorAll('.tab-origin-btn').forEach(btn => {
      btn.onclick = (e) => {
        this.activeTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('.tab-origin-btn').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = 'var(--text-muted)';
          b.style.borderColor = 'transparent';
        });
        e.currentTarget.style.background = 'var(--gold-dark)';
        e.currentTarget.style.color = 'var(--gold-light)';
        e.currentTarget.style.borderColor = 'var(--gold-border-dark)';
        this.render();
      };
    });

    document.querySelectorAll('.cat-filter-btn').forEach(btn => {
      btn.onclick = (e) => {
        this.activeCategory = e.currentTarget.getAttribute('data-cat');
        document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.render();
      };
    });

    const searchInput = document.getElementById('comp-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render();
      };
    }

    const gridEl = document.getElementById('compendium-items-rect-grid');
    if (gridEl) {
      gridEl.onclick = (e) => {
        const card = e.target.closest('.compendium-card-rect');
        if (card) {
          const itemId = card.getAttribute('data-item-id');
          this.selectedItemId = itemId;
          this.render();
          this.openItemDetailsModal(itemId);
        }
      };
    }

    const btnNewItem = document.getElementById('btn-comp-new-item');
    if (btnNewItem) {
      btnNewItem.onclick = () => {
        const targetCategory = this.activeCategory !== 'all' ? this.activeCategory : 'item';
        const defaultSkeleton = COMPENDIUM_SKELETONS[targetCategory] || COMPENDIUM_SKELETONS.item;
        this.openItemEditorModal(JSON.parse(JSON.stringify(defaultSkeleton)), true);
      };
    }
  }

  openItemDetailsModal(itemId) {
    const allItems = [...SYSTEM_COMPENDIUM_DATABASE, ...this.customItems];
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('modal-compendio-detalhes');
    if (!modal) return;

    document.getElementById('comp-det-icon').innerText = item.icon || '📜';
    document.getElementById('comp-det-title').innerText = item.name;
    document.getElementById('comp-det-badge').innerText = item.is_custom ? '🛠️ Elemento Homebrew / Criado pelo Mestre' : '📜 Elemento Oficial do Sistema AlphaD6';

    const bodyEl = document.getElementById('comp-det-body');
    let blocksHtml = '<div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">';

    if (item.blocks) {
      for (const [blockId, blockData] of Object.entries(item.blocks)) {
        const isVisible = blockData.is_visible !== false;
        const val = blockData.value !== undefined ? blockData.value : '';

        // RENDERIZAÇÃO ESPECIAL PARA GATILHOS NO-CODE
        if (blockId === 'bloco_gatilhos_efeitos' || blockData.triggers) {
          const triggers = blockData.triggers || [];
          blocksHtml += `
            <div style="background: rgba(30, 20, 55, 0.8); border: 1px solid var(--border-gold); padding: 12px; border-radius: 8px;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--gold-light); font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>⚡ Gatilhos & Efeitos Automatizados (No-Code)</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${triggers.length > 0 ? triggers.map(trig => `
                  <div style="background: rgba(0,0,0,0.4); border-left: 3px solid #34d399; padding: 6px 10px; border-radius: 4px; font-size: 12.5px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <span style="color: #a78bfa; font-weight: bold;">[${TRIGGER_EVENT_ENUM[trig.event] || trig.event}]</span>
                      <span style="color: #fff; margin-left: 6px;">➔ ${EXEC_ACTION_TYPE_ENUM[trig.action_type] || trig.action_type}</span>
                    </div>
                    <span style="font-family: monospace; color: #34d399; background: rgba(52, 211, 153, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                      Fórmula: ${trig.formula || 'N/A'} (${trig.target || 'self'})
                    </span>
                  </div>
                `).join('') : '<span style="font-size: 12px; color: var(--text-dim);">Nenhuma regra automatizada configurada neste elemento.</span>'}
              </div>
            </div>
          `;
          continue;
        }

        blocksHtml += `
          <div style="background: rgba(20,20,35,0.7); border: 1px solid ${isVisible ? 'var(--border-card)' : 'rgba(239, 68, 68, 0.4)'}; padding: 12px; border-radius: 8px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; text-transform: uppercase; color: var(--gold-light); font-weight: 600;">${blockData.label || blockId}</span>
              <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${isVisible ? 'rgba(46, 184, 134, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isVisible ? '#2eb886' : '#f87171'}; border: 1px solid ${isVisible ? 'rgba(46, 184, 134, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
                ${isVisible ? '👁️ Visível Jogadores' : '🔒 Oculto (Mestre)'}
              </span>
            </div>
            <div style="font-size: 13.5px; color: #fff; line-height: 1.5; white-space: pre-wrap;">${typeof val === 'object' ? JSON.stringify(val, null, 2) : val}</div>
          </div>
        `;
      }
    }
    blocksHtml += '</div>';
    bodyEl.innerHTML = blocksHtml;

    const actionsEl = document.getElementById('comp-det-actions');
    actionsEl.innerHTML = `
      ${item.is_custom ? `
        <button type="button" class="btn-action-sm btn-action-ban" id="btn-comp-det-delete" style="padding: 8px 16px;">🗑️ Excluir Elemento</button>
        <button type="button" class="btn-primary" id="btn-comp-det-edit" style="padding: 8px 20px;">✏️ Editar Elemento</button>
      ` : `
        <button type="button" class="btn-primary" id="btn-comp-det-clone" style="padding: 8px 20px; background: var(--gold-primary); color: #000;">📦 Clonar para Minhas Criações</button>
      `}
    `;

    modal.style.display = 'flex';

    if (document.getElementById('btn-comp-det-edit')) {
      document.getElementById('btn-comp-det-edit').onclick = () => {
        modal.style.display = 'none';
        this.openItemEditorModal(JSON.parse(JSON.stringify(item)), false);
      };
    }

    if (document.getElementById('btn-comp-det-clone')) {
      document.getElementById('btn-comp-det-clone').onclick = () => {
        modal.style.display = 'none';
        const newItem = JSON.parse(JSON.stringify(item));
        newItem.id = 'custom_' + Date.now();
        newItem.name = item.name + ' (Cópia Homebrew)';
        newItem.is_custom = true;
        this.openItemEditorModal(newItem, true);
      };
    }

    if (document.getElementById('btn-comp-det-delete')) {
      document.getElementById('btn-comp-det-delete').onclick = () => {
        if (confirm(`Tem certeza que deseja excluir "${item.name}" das suas criações?`)) {
          this.customItems = this.customItems.filter(i => i.id !== item.id);
          this.saveCustomItemsToStorage();
          modal.style.display = 'none';
          this.render();
        }
      };
    }
  }

  openItemEditorModal(item, isNew = false) {
    const modal = document.getElementById('modal-compendio-editor');
    if (!modal) return;

    document.getElementById('comp-editor-title').innerText = isNew ? '➕ Criar Novo Elemento Homebrew' : `✏️ Editar Elemento: ${item.name}`;
    document.getElementById('edit-comp-id').value = item.id || ('custom_' + Date.now());
    document.getElementById('edit-comp-category').value = item.category || 'item';
    document.getElementById('edit-comp-name').value = item.name || '';
    document.getElementById('edit-comp-icon').value = item.icon || '📜';
    document.getElementById('edit-comp-short-desc').value = item.short_desc || '';

    const blocksListEl = document.getElementById('comp-editor-blocks-list');
    let html = '';

    const blocks = item.blocks || (COMPENDIUM_SKELETONS[item.category] ? COMPENDIUM_SKELETONS[item.category].blocks : {});

    // Renderiza blocos padrão de atributos/propriedades (ignorando a chave de triggers que tem construtor dedicado)
    for (const [blockId, blockData] of Object.entries(blocks)) {
      if (blockId === 'bloco_gatilhos_efeitos') continue;

      const isVisible = blockData.is_visible !== false;
      const val = blockData.value !== undefined ? blockData.value : '';

      let inputHtml = '';
      if (blockData.options) {
        inputHtml = `<select class="edit-block-val form-control" data-block-id="${blockId}" style="width: 100%; background: #121222; border: 1px solid var(--border-card); color: #fff; padding: 6px; border-radius: 4px;">
          ${Object.entries(blockData.options).map(([optKey, optLabel]) => `
            <option value="${optKey}" ${val === optKey ? 'selected' : ''}>${optLabel}</option>
          `).join('')}
        </select>`;
      } else {
        inputHtml = `<input type="text" class="edit-block-val form-control" data-block-id="${blockId}" value="${typeof val === 'object' ? JSON.stringify(val) : val}" style="width: 100%; background: #121222; border: 1px solid var(--border-card); color: #fff; padding: 6px; border-radius: 4px;">`;
      }

      html += `
        <div style="background: rgba(20,20,35,0.85); border: 1px solid ${isVisible ? 'var(--border-gold)' : 'var(--border-card)'}; border-radius: 8px; padding: 10px; position: relative;">
          <div style="font-size: 11px; color: var(--gold-light); font-weight: 600; margin-bottom: 4px;">${blockData.label || blockId}</div>
          ${inputHtml}
          
          <div style="margin-top: 8px; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
            <span style="font-size: 11px; color: ${isVisible ? '#2eb886' : 'var(--text-muted)'};">${isVisible ? 'Visível Jogadores' : 'Oculto (Mestre)'}</span>
            <input type="checkbox" class="edit-block-toggle" data-block-id="${blockId}" ${isVisible ? 'checked' : ''} style="cursor: pointer;">
          </div>
        </div>
      `;
    }
    blocksListEl.innerHTML = html;

    // EDITOR VISUAL DE GATILHOS NO-CODE
    const triggersContainer = document.getElementById('nocode-triggers-editor-container');
    let currentTriggers = (blocks.bloco_gatilhos_efeitos && blocks.bloco_gatilhos_efeitos.triggers) ? [...blocks.bloco_gatilhos_efeitos.triggers] : [];

    const renderTriggersList = () => {
      if (!triggersContainer) return;
      if (currentTriggers.length === 0) {
        triggersContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-dim);">Nenhum gatilho configurado. Clique em "Adicionar Gatilho" acima.</span>';
        return;
      }

      triggersContainer.innerHTML = currentTriggers.map((trig, idx) => `
        <div style="background: rgba(18, 18, 34, 0.9); border: 1px solid var(--border-card); border-radius: 6px; padding: 8px 12px; display: grid; grid-template-columns: 1fr 1fr 1fr 90px 40px; gap: 8px; align-items: center;">
          <select class="trig-event-sel form-control" data-idx="${idx}" style="font-size: 11.5px; padding: 4px;">
            ${Object.entries(TRIGGER_EVENT_ENUM).map(([eKey, eLabel]) => `<option value="${eKey}" ${trig.event === eKey ? 'selected' : ''}>${eLabel}</option>`).join('')}
          </select>
          
          <select class="trig-action-sel form-control" data-idx="${idx}" style="font-size: 11.5px; padding: 4px;">
            ${Object.entries(EXEC_ACTION_TYPE_ENUM).map(([aKey, aLabel]) => `<option value="${aKey}" ${trig.action_type === aKey ? 'selected' : ''}>${aLabel}</option>`).join('')}
          </select>

          <input type="text" class="trig-formula-inp form-control" data-idx="${idx}" value="${trig.formula || ''}" placeholder="Ex: 2d6 + Corpo" style="font-size: 11.5px; padding: 4px;">

          <select class="trig-target-sel form-control" data-idx="${idx}" style="font-size: 11.5px; padding: 4px;">
            <option value="self" ${trig.target === 'self' ? 'selected' : ''}>Self</option>
            <option value="target" ${trig.target === 'target' ? 'selected' : ''}>Alvo</option>
            <option value="area" ${trig.target === 'area' ? 'selected' : ''}>Área</option>
          </select>

          <button type="button" class="btn-action-sm btn-action-ban btn-remove-trig" data-idx="${idx}" style="padding: 4px; font-size: 12px;" title="Remover Gatilho">🗑️</button>
        </div>
      `).join('');

      // Bind dos seletores de gatilhos
      document.querySelectorAll('.trig-event-sel').forEach(s => s.onchange = (e) => currentTriggers[e.target.dataset.idx].event = e.target.value);
      document.querySelectorAll('.trig-action-sel').forEach(s => s.onchange = (e) => currentTriggers[e.target.dataset.idx].action_type = e.target.value);
      document.querySelectorAll('.trig-formula-inp').forEach(i => i.oninput = (e) => currentTriggers[e.target.dataset.idx].formula = e.target.value);
      document.querySelectorAll('.trig-target-sel').forEach(s => s.onchange = (e) => currentTriggers[e.target.dataset.idx].target = e.target.value);
      document.querySelectorAll('.btn-remove-trig').forEach(b => b.onclick = (e) => {
        currentTriggers.splice(e.target.dataset.idx, 1);
        renderTriggersList();
      });
    };

    renderTriggersList();

    const btnAddTrig = document.getElementById('btn-add-nocode-trigger');
    if (btnAddTrig) {
      btnAddTrig.onclick = () => {
        currentTriggers.push({
          id: 'trig_' + Date.now(),
          event: 'on_use',
          action_type: 'heal_anima',
          formula: '1d6',
          target: 'self'
        });
        renderTriggersList();
      };
    }

    modal.style.display = 'flex';

    document.getElementById('btn-save-comp-editor').onclick = () => {
      const id = document.getElementById('edit-comp-id').value;
      const category = document.getElementById('edit-comp-category').value;
      const name = document.getElementById('edit-comp-name').value.trim() || 'Novo Elemento';
      const icon = document.getElementById('edit-comp-icon').value.trim() || '📜';
      const short_desc = document.getElementById('edit-comp-short-desc').value.trim();

      const updatedBlocks = JSON.parse(JSON.stringify(blocks));
      document.querySelectorAll('.edit-block-val').forEach(input => {
        const bId = input.getAttribute('data-block-id');
        if (updatedBlocks[bId]) {
          updatedBlocks[bId].value = input.value;
        }
      });

      document.querySelectorAll('.edit-block-toggle').forEach(chk => {
        const bId = chk.getAttribute('data-block-id');
        if (updatedBlocks[bId]) {
          updatedBlocks[bId].is_visible = chk.checked;
        }
      });

      // Atualiza o bloco de gatilhos No-Code
      updatedBlocks['bloco_gatilhos_efeitos'] = {
        label: 'Gatilhos & Efeitos Automatizados (No-Code)',
        is_visible: true,
        triggers: currentTriggers
      };

      const updatedItem = {
        id,
        category,
        name,
        icon,
        short_desc,
        is_custom: true,
        origin_type: 'custom',
        blocks: updatedBlocks
      };

      const existingIndex = this.customItems.findIndex(i => i.id === id);
      if (existingIndex >= 0) {
        this.customItems[existingIndex] = updatedItem;
      } else {
        this.customItems.push(updatedItem);
      }

      this.saveCustomItemsToStorage();
      modal.style.display = 'none';

      this.activeTab = 'custom';
      this.selectedItemId = id;
      this.render();
    };
  }
}
