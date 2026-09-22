import { createLocalD1 } from '../db/localD1.js';
import { dbQueries } from '../db/queries.js';
import { join } from 'path';

const dbPath = join(process.cwd(), '.data/arcana_local.sqlite');
const db = createLocalD1(dbPath);

async function seed() {
  console.log('Seeding mock users...');
  
  const users = [
    { id: 'usr_mock_1', email: 'mestre1@teste.com', name: 'Mestre Ancião', role: 'mestre' },
    { id: 'usr_mock_2', email: 'mestre2@teste.com', name: 'Mestre Sombrio', role: 'mestre' },
    { id: 'usr_mock_3', email: 'mestre3@teste.com', name: 'Senhor dos Dragões', role: 'mestre' }
  ];

  for (const u of users) {
    try {
      await dbQueries.createUser(db, {
        id: u.id, email: u.email, passwordHash: 'hash', salt: 'salt',
        displayName: u.name, role: u.role, emailVerified: 1, profileCompleted: 1
      });
      console.log('Created user:', u.name);
    } catch(e) {
      console.log('User already exists or error:', u.name);
    }
  }

  console.log('Seeding mock campaigns...');
  const campaigns = [
    { id: 'camp_mock_1', simpleId: 'ORACULO-502', name: 'O Oráculo Caído', ownerId: 'usr_mock_1', systemId: 'dnd5e', themeId: 'dark-fantasy', lore: 'Uma jornada nas profundezas.', max: 5 },
    { id: 'camp_mock_2', simpleId: 'VAMPIRO-999', name: 'Sangue em Chicago', ownerId: 'usr_mock_2', systemId: 'vtm', themeId: 'cyberpunk', lore: 'Intrigas noturnas e política sobrenatural na metrópole.', max: 4 },
    { id: 'camp_mock_3', simpleId: 'DRAG-001', name: 'O Covil de Fogo', ownerId: 'usr_mock_3', systemId: 'custom', themeId: 'high-fantasy', lore: 'O antigo dragão vermelho despertou de seu sono milenar.', max: 6 },
    { id: 'camp_mock_4', simpleId: 'CTHULHU-42', name: 'Sussurros do Abismo', ownerId: 'usr_mock_1', systemId: 'coc', themeId: 'dark-fantasy', lore: 'Você não pode escapar da loucura.', max: 3 },
    { id: 'camp_mock_5', simpleId: 'SPACE-777', name: 'Rebelião Estelar', ownerId: 'usr_mock_2', systemId: 'custom', themeId: 'cyberpunk', lore: 'A frota rebelde tenta um último ataque à corporação Mega.', max: 8 }
  ];

  for (const c of campaigns) {
    try {
      await dbQueries.createCampaign(db, {
        id: c.id, simpleId: c.simpleId, name: c.name, ownerId: c.ownerId,
        systemId: c.systemId, themeId: c.themeId, loreDescription: c.lore, maxPlayers: c.max
      });
      console.log('Created campaign:', c.name);
    } catch(e) {
      console.log('Campaign already exists or error:', c.name);
    }
  }
  
  console.log('Seeding mock compendium items (AlphaD6 Skeletons)...');
  const systemUserId = 'usr_mock_1';
  const compendiumItems = [
    {
      id: 'base_item_pocao_cura',
      parentId: null,
      ownerUserId: systemUserId,
      name: 'Poção de Anima Menor',
      category: 'item',
      systemId: 'alphad6',
      baseAssetId: 'asset_potion_red',
      isPublic: 1,
      blocks: {
        bloco_nome: { label: 'Nome do Item', value: 'Poção de Anima Menor', is_visible: true },
        bloco_tipo_item: { label: 'Tipo de Item (Mecânica)', value: 'consumable', is_visible: true },
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
    {
      id: 'base_equip_espada_curta',
      parentId: null,
      ownerUserId: systemUserId,
      name: 'Espada Curta de Aço',
      category: 'equipment',
      systemId: 'alphad6',
      baseAssetId: 'asset_sword_iron',
      isPublic: 1,
      blocks: {
        bloco_tipo: { label: 'Tipo de Equipamento', value: 'Arma Cortante de Uma Mão', is_visible: true },
        bloco_dano: { label: 'Dano AlphaD6', value: '1d6 + Vigor', is_visible: true },
        bloco_alcance: { label: 'Alcance', value: 'Corpo a Corpo (1 Tile)', is_visible: true },
        bloco_peso: { label: 'Peso em Carga', value: '1 Slot', is_visible: true },
        bloco_durabilidade: { label: 'Durabilidade', value: '10/10', is_visible: true },
        bloco_requisito: { label: 'Requisitos', value: 'Vigor >= 1', is_visible: true }
      }
    },
    {
      id: 'base_creature_cultista',
      parentId: null,
      ownerUserId: systemUserId,
      name: 'Cultista dos Anéis Sombrios',
      category: 'creature',
      systemId: 'alphad6',
      baseAssetId: 'asset_npc_hooded',
      isPublic: 1,
      blocks: {
        bloco_vigor: { label: 'Vigor', value: 2, is_visible: true },
        bloco_agilidade: { label: 'Agilidade', value: 3, is_visible: true },
        bloco_mente: { label: 'Mente', value: 2, is_visible: true },
        bloco_anima: { label: 'Anima Total', value: 12, is_visible: true },
        bloco_defesa: { label: 'Defesa Passiva', value: '11', is_visible: true },
        bloco_ataque: { label: 'Ataque AlphaD6', value: 'Adaga Ritualística (1d6+2)', is_visible: true },
        bloco_lore_oculta: { label: 'Fraqueza Oculta', value: 'Vulnerável a Dano Sagrado', is_visible: false }
      }
    },
    {
      id: 'base_power_bola_fogo',
      parentId: null,
      ownerUserId: systemUserId,
      name: 'Explosão Arcana',
      category: 'power',
      systemId: 'alphad6',
      baseAssetId: 'asset_spell_fire',
      isPublic: 1,
      blocks: {
        bloco_custo_anima: { label: 'Custo de Anima', value: '3 Anima', is_visible: true },
        bloco_alcance: { label: 'Alcance', value: '4 Tiles (Área de Éter)', is_visible: true },
        bloco_duracao: { label: 'Duração', value: 'Instantâneo', is_visible: true },
        bloco_efeito: { label: 'Efeito AlphaD6', value: 'Causa 2d6 de Dano de Éter a todos no raio de 1 tile', is_visible: true }
      }
    },
    {
      id: 'base_clue_diario_antigo',
      parentId: null,
      ownerUserId: systemUserId,
      name: 'Página Rasgada do Diário',
      category: 'clue',
      systemId: 'alphad6',
      baseAssetId: 'asset_paper_scroll',
      isPublic: 1,
      blocks: {
        bloco_resumo: { label: 'Texto Visível', value: 'Siga as luzes vermelhas quando a senha for digitada...', is_visible: true },
        bloco_lore_oculta: { label: 'Segredo Oculto', value: 'A combinação correta do Nível 777 é 3-7-1-9', is_visible: false }
      }
    }
  ];

  for (const item of compendiumItems) {
    try {
      await dbQueries.createCompendiumItem(db, {
        id: item.id,
        parentId: item.parentId,
        ownerUserId: item.ownerUserId,
        name: item.name,
        category: item.category,
        systemId: item.systemId,
        baseAssetId: item.baseAssetId,
        isPublic: item.isPublic,
        blocks: item.blocks
      });
      console.log('Created compendium item skeleton:', item.name);
    } catch(e) {
      console.log('Compendium item already exists or error:', item.name);
    }
  }

  console.log('Seeding complete.');
}

seed();

