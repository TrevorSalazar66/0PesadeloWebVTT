/**
 * Bateria de Testes: Motor de Regras e Gateway de Sincronização RPG (Fase 10)
 */
import assert from 'node:assert';
import worker from '../src/index.js';
import { createLocalD1 } from '../src/db/localD1.js';
import { signJWT } from '../src/services/cryptoService.js';

const JWT_SECRET = 'arcana-super-secret-key-development-local-2026-vtt';
const VALID_ORIGIN = 'http://localhost:5500';

async function runRPGSyncTests() {
  console.log('🎲 INICIANDO BATERIA DE TESTES DE ROLAGEM E REGRAS RPG VIA SYNC GATEWAY\n');

  const db = createLocalD1(':memory:');
  const env = {
    ENVIRONMENT: 'development',
    ALLOWED_ORIGINS: VALID_ORIGIN,
    JWT_SECRET,
    DB: db
  };

  // 1. Cria um usuário autenticado com perfil completo
  await db.prepare(`
    INSERT INTO users (id, email, display_name, role, email_verified, profile_completed)
    VALUES ('usr_rpg_tester', 'rpg@arcana.vtt', 'Sir Alistair', 'jogador', 1, 1);
  `).run();

  const token = await signJWT({
    sub: 'usr_rpg_tester',
    email: 'rpg@arcana.vtt',
    role: 'jogador',
    emailVerified: 1,
    profileCompleted: 1,
    exp: Math.floor(Date.now() / 1000) + 3600
  }, JWT_SECRET);
  const cookie = `arcana_session=${token}`;

  // ----------------------------------------------------
  // TESTE 1: Rolagem de Pool D6 com Dificuldade (rpg.rollPool)
  // ----------------------------------------------------
  console.log('1. Testando ação rpg.rollPool via /api/sync...');
  const resPool = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.rollPool',
      data: {
        dadosCount: 5,
        dificuldade: 4,
        atributo: 'corpo',
        especializacao: 'luta armada',
        vantagens: 1
      }
    })
  }), env);

  assert.equal(resPool.status, 200);
  const jsonPool = await resPool.json();
  assert.equal(jsonPool.sucesso, true);
  assert.equal(jsonPool.dados.tipo, 'pool_d6');
  assert.equal(jsonPool.dados.dadosCount, 5);
  assert.equal(jsonPool.dados.dificuldade, 4);
  assert.ok(['SUCESSO_TOTAL', 'SUCESSO_PARCIAL', 'FALHA_TOTAL'].includes(jsonPool.dados.veredicto));
  console.log('   ✅ rpg.rollPool respondeu com veredicto válido:', jsonPool.dados.veredicto);

  // ----------------------------------------------------
  // TESTE 2: Rolagem Livre Expressão (rpg.rollFree)
  // ----------------------------------------------------
  console.log('2. Testando ação rpg.rollFree via /api/sync...');
  const resFree = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.rollFree',
      data: { expressao: '2d6+5' }
    })
  }), env);

  assert.equal(resFree.status, 200);
  const jsonFree = await resFree.json();
  assert.equal(jsonFree.sucesso, true);
  assert.equal(jsonFree.dados.quantidadeDados, 2);
  assert.equal(jsonFree.dados.modificador, 5);
  assert.equal(jsonFree.dados.total, jsonFree.dados.somaDados + 5);
  console.log('   ✅ rpg.rollFree 2d6+5 total:', jsonFree.dados.total);

  // ----------------------------------------------------
  // TESTE 3: Teste Resistido (rpg.opposedRoll)
  // ----------------------------------------------------
  console.log('3. Testando ação rpg.opposedRoll via /api/sync...');
  const rollA = { totalSucessos: 3, somaSucessos: 15, dados: [5, 6, 4] };
  const rollB = { totalSucessos: 2, somaSucessos: 10, dados: [6, 4] };

  const resOpposed = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.opposedRoll',
      data: { rollA, rollB, nomeA: 'Guerreiro', nomeB: 'Ogro' }
    })
  }), env);

  assert.equal(resOpposed.status, 200);
  const jsonOpposed = await resOpposed.json();
  assert.equal(jsonOpposed.sucesso, true);
  assert.equal(jsonOpposed.dados.vencedor, 'A');
  console.log('   ✅ rpg.opposedRoll venceu lado A conforme esperado');

  // ----------------------------------------------------
  // TESTE 4: Comando de Chat (/roll com ficha integrada)
  // ----------------------------------------------------
  console.log('4. Testando ação rpg.chatCommand com integração de ficha...');
  // Cria uma ficha de teste
  const sheetData = {
    atributos: { corpo: 3, mente: 2, social: 1, espirito: 2 }
  };
  await db.prepare(`
    INSERT INTO characters (id, user_id, name, sheet_data)
    VALUES ('chr_teste_01', 'usr_rpg_tester', 'Valeros', ?);
  `).bind(JSON.stringify(sheetData)).run();

  const resChat = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.chatCommand',
      data: {
        comando: '/roll corpo esp:atletismo vant:1 dif:4',
        characterId: 'chr_teste_01'
      }
    })
  }), env);

  assert.equal(resChat.status, 200);
  const jsonChat = await resChat.json();
  assert.equal(jsonChat.sucesso, true);
  assert.equal(jsonChat.dados.tipo, 'pool_d6');
  // 3 (corpo) + 1 (esp) + 1 (vant) = 5 dados
  assert.equal(jsonChat.dados.dadosCount, 5);
  assert.equal(jsonChat.dados.dificuldade, 4);
  console.log('   ✅ rpg.chatCommand processou ficha e modificadores com sucesso:', jsonChat.dados.dadosCount, 'dados lançados');

  // ----------------------------------------------------
  // TESTE 5: Dano e Passagem para o Vazio (rpg.damage)
  // ----------------------------------------------------
  console.log('\n5. Testando ação rpg.damage com Passagem para o Vazio...');
  const resDano = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.damage',
      data: { characterId: 'chr_teste_01', dano: 20 }
    })
  }), env);

  assert.equal(resDano.status, 200);
  const jsonDano = await resDano.json();
  assert.equal(jsonDano.sucesso, true);
  assert.equal(jsonDano.dados.animaAtual, 0);
  assert.equal(jsonDano.dados.passagemParaOVazio, true);
  console.log('   ✅ rpg.damage aplicou dano e acionou Passagem para o Vazio');

  // ----------------------------------------------------
  // TESTE 6: Descanso com Auto-Approve e Avanço de Relógio (rpg.rest)
  // ----------------------------------------------------
  console.log('\n6. Testando rpg.rest com avanço automático do Relógio da Campanha...');
  // Cria campanha com auto_approve_actions = 1
  await db.prepare(`
    INSERT INTO campaigns (id, simple_id, name, owner_id, system_id, clock_data, settings)
    VALUES ('cmp_teste_relogio', 'FORJA-100', 'Campanha do Relógio', 'usr_rpg_tester', 'alphad6', 
            '{"ano":1,"mes":1,"dia":1,"hora":8,"minuto":0,"periodo":"Manhã"}',
            '{"auto_approve_actions":1}');
  `).run();

  const resRestAuto = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.rest',
      data: {
        characterId: 'chr_teste_01',
        campaignId: 'cmp_teste_relogio',
        tipo: 'curto',
        customRoll: [4, 3, 3] // +10 anima
      }
    })
  }), env);

  assert.equal(resRestAuto.status, 200);
  const jsonRestAuto = await resRestAuto.json();
  assert.equal(jsonRestAuto.sucesso, true);
  assert.equal(jsonRestAuto.aprovado, true);
  assert.equal(jsonRestAuto.dados.animaAtual, 10);
  assert.equal(jsonRestAuto.dados.relogio.hora, 10); // 8h + 2h do descanso curto
  assert.equal(jsonRestAuto.dados.relogio.periodo, 'Manhã');
  console.log('   ✅ rpg.rest aplicou cura (+10) e avançou o relógio para 10:00');

  // ----------------------------------------------------
  // TESTE 7: Descanso com Moderação Manual (auto_approve_actions = 0) e Aprovação do Mestre
  // ----------------------------------------------------
  console.log('\n7. Testando moderação manual (auto_approve_actions = 0) e ação rpg.actionApprove...');
  // Cria usuário jogador separado
  await db.prepare(`
    INSERT INTO users (id, email, display_name, role, email_verified, profile_completed)
    VALUES ('usr_player_simples', 'player@arcana.vtt', 'Jogador Simples', 'jogador', 1, 1);
  `).run();
  const tokenPlayer = await signJWT({
    sub: 'usr_player_simples',
    email: 'player@arcana.vtt',
    role: 'jogador',
    emailVerified: 1,
    profileCompleted: 1,
    exp: Math.floor(Date.now() / 1000) + 3600
  }, JWT_SECRET);
  const cookiePlayer = `arcana_session=${tokenPlayer}`;

  // Cria ficha do jogador
  await db.prepare(`
    INSERT INTO characters (id, user_id, campaign_id, name, sheet_data)
    VALUES ('chr_player_02', 'usr_player_simples', 'cmp_teste_relogio', 'Lorde Thorin', '{"anima":5,"max_anima":20}');
  `).run();

  // Configura a campanha para aprovação manual
  await db.prepare(`
    UPDATE campaigns SET settings = '{"auto_approve_actions":0}' WHERE id = 'cmp_teste_relogio';
  `).run();

  // Jogador solicita descanso longo
  const resPlayerRest = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'rpg.rest',
      data: {
        characterId: 'chr_player_02',
        campaignId: 'cmp_teste_relogio',
        tipo: 'longo',
        customRoll: [6, 6, 6]
      }
    })
  }), env);

  const jsonPlayerRest = await resPlayerRest.json();
  assert.equal(jsonPlayerRest.sucesso, true);
  assert.equal(jsonPlayerRest.requerAprovacao, true);
  assert.equal(jsonPlayerRest.pendente, true);
  console.log('   ✅ Solicitação de descanso do jogador colocada em estado pendente para moderação');

  // Mestre aprova a solicitação
  const resMestreApprove = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie }, // Mestre
    body: JSON.stringify({
      action: 'rpg.actionApprove',
      data: {
        actionType: 'rest',
        characterId: 'chr_player_02',
        campaignId: 'cmp_teste_relogio',
        tipo: 'longo',
        customRoll: [6, 6, 6]
      }
    })
  }), env);

  const jsonApprove = await resMestreApprove.json();
  assert.equal(jsonApprove.sucesso, true);
  assert.equal(jsonApprove.aprovado, true);
  assert.equal(jsonApprove.dados.animaAtual, 20); // 5 + 18 capped em 20
  assert.equal(jsonApprove.dados.relogio.hora, 16); // 10h + 6h = 16h
  assert.equal(jsonApprove.dados.relogio.periodo, 'Tarde');
  console.log('   ✅ Mestre aprovou descanso: Anima atualizada e relógio avançado para 16:00 (Tarde)');

  // ----------------------------------------------------
  // TESTE 8: Avanço Manual do Relógio e Atualização de Configurações
  // ----------------------------------------------------
  console.log('\n8. Testando avanço manual do relógio (campaigns.clock.advance)...');
  const resClockManual = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'campaigns.clock.advance',
      data: {
        campaignId: 'cmp_teste_relogio',
        hours: 8 // 16h + 8h = 00h do próximo dia
      }
    })
  }), env);

  const jsonClockManual = await resClockManual.json();
  assert.equal(jsonClockManual.sucesso, true);
  assert.equal(jsonClockManual.dados.dia, 2);
  assert.equal(jsonClockManual.dados.hora, 0);
  assert.equal(jsonClockManual.dados.periodo, 'Madrugada');
  console.log('   ✅ Relógio avançou para o Dia 2 - 00:00 (Madrugada)');

  // ----------------------------------------------------
  // TESTE 9: Iniciativa de Combate (rpg.combat.initiative)
  // ----------------------------------------------------
  console.log('\n9. Testando cálculo de iniciativa de combate (rpg.combat.initiative)...');
  const resInit = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.combat.initiative',
      data: {
        combatants: [
          { id: 'c1', nome: 'Guerreiro', corpo: 3, customRoll: [6, 5, 2] }, // 2 sucessos
          { id: 'c2', nome: 'Cultista', corpo: 2, customRoll: [6, 6] }       // 2 sucessos (soma 12 vs 11)
        ]
      }
    })
  }), env);

  assert.equal(resInit.status, 200);
  const jsonInit = await resInit.json();
  assert.equal(jsonInit.sucesso, true);
  assert.equal(jsonInit.dados[0].characterId, 'c2'); // c2 venceu na soma de sucessos (12 > 11)
  assert.equal(jsonInit.dados[1].characterId, 'c1');
  console.log('   ✅ rpg.combat.initiative ordenou os combatentes com desempate matemático');

  // ----------------------------------------------------
  // TESTE 10: Ataque de Combate (rpg.combat.attack)
  // ----------------------------------------------------
  console.log('\n10. Testando ataque de combate e contra-ataque (rpg.combat.attack)...');
  const resAttackHit = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.combat.attack',
      data: {
        attackerName: 'Arqueiro',
        targetName: 'Zumbi',
        attackerRoll: { totalSucessos: 3 },
        targetDefense: 1,
        weaponKey: 'fogo_grande_fraca',
        customDamageRoll: { total: 14, dados: [10] }
      }
    })
  }), env);

  const jsonAttackHit = await resAttackHit.json();
  assert.equal(jsonAttackHit.sucesso, true);
  assert.equal(jsonAttackHit.dados.acerto, true);
  assert.equal(jsonAttackHit.dados.danoTotal, 14);
  console.log('   ✅ rpg.combat.attack registrou acerto e calculou dano da arma');

  // ----------------------------------------------------
  // TESTE 11: Teste de Morrendo (rpg.combat.dyingCheck)
  // ----------------------------------------------------
  console.log('\n11. Testando teste de sobrevivência/morrendo (rpg.combat.dyingCheck)...');
  const resDying = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.combat.dyingCheck',
      data: {
        characterId: 'chr_teste_01',
        characterName: 'Valeros',
        atributoChoice: 'corpo',
        atributoValue: 4,
        tentativaNumero: 1,
        customRoll: [6, 5, 4, 4] // 4 sucessos (dificuldade 4 -> sucesso total)
      }
    })
  }), env);

  const jsonDying = await resDying.json();
  assert.equal(jsonDying.sucesso, true);
  assert.equal(jsonDying.dados.sobreviveu, true);
  assert.equal(jsonDying.dados.dificuldade, 4);
  console.log('   ✅ rpg.combat.dyingCheck avaliou sobrevivência na 1ª tentativa');

  // ----------------------------------------------------
  // TESTE 12: Manifestação de Poder com Gasto de Anima (rpg.power.use)
  // ----------------------------------------------------
  console.log('\n12. Testando manifestação de poder com gasto de Anima (rpg.power.use)...');
  // Garante que a ficha tenha Anima = 15
  await db.prepare(`
    UPDATE characters SET sheet_data = '{"anima":15,"max_anima":20}' WHERE id = 'chr_teste_01';
  `).run();

  const resPower = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.power.use',
      data: {
        characterId: 'chr_teste_01',
        power: {
          nome: 'Chamas do Vazio',
          tipo: 'ativo',
          custoAnima: 4,
          descricao: 'Projéteis espectrais incineradores.'
        }
      }
    })
  }), env);

  const jsonPower = await resPower.json();
  assert.equal(jsonPower.sucesso, true);
  assert.equal(jsonPower.dados.custoAnima, 4);
  assert.equal(jsonPower.dados.animaAtual, 11);
  console.log('   ✅ rpg.power.use deduziu Anima da ficha e persistiu no banco (15 -> 11)');

  // ----------------------------------------------------
  // TESTE 13: Compêndios Oficiais de Armas e Defesas
  // ----------------------------------------------------
  console.log('\n13. Testando compêndios canônicos de armas e defesas...');
  const resCompWeapons = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ action: 'rpg.compendium.weapons', data: {} })
  }), env);
  const jsonCompWeapons = await resCompWeapons.json();
  assert.equal(jsonCompWeapons.sucesso, true);
  assert.ok(jsonCompWeapons.dados.fogo_especial_forte);

  const resCompDefenses = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ action: 'rpg.compendium.defenses', data: {} })
  }), env);
  const jsonCompDefenses = await resCompDefenses.json();
  assert.equal(jsonCompDefenses.sucesso, true);
  assert.ok(jsonCompDefenses.dados.defesa_pesada);
  console.log('   ✅ Compêndios canônicos retornados com sucesso');

  // ----------------------------------------------------
  // TESTE 14: Criação e Listagem de Cenas com Gatilhos de XP (campaigns.scenes.create / list)
  // ----------------------------------------------------
  console.log('\n14. Testando criação e listagem de cenas com gatilhos de XP...');
  const resCreateScene = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'campaigns.scenes.create',
      data: {
        campaignId: 'cmp_teste_relogio',
        name: 'Templo dos Sussurros',
        description: 'Um santuário esquecido tomado por névoas.',
        xpTriggers: [
          { id: 'trg_entrada', titulo: 'Entrada no Templo', xp: 1, tipo: 'entrada', status: 'pendente' },
          { id: 'trg_chefe', titulo: 'Derrotar o Guardião', xp: 2, tipo: 'objetivo', status: 'pendente' }
        ]
      }
    })
  }), env);

  const jsonCreateScene = await resCreateScene.json();
  assert.equal(jsonCreateScene.sucesso, true);
  const sceneId = jsonCreateScene.dados.id;
  assert.ok(sceneId.startsWith('scn_'));

  const resListScenes = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'campaigns.scenes.list',
      data: { campaignId: 'cmp_teste_relogio' }
    })
  }), env);
  const jsonListScenes = await resListScenes.json();
  assert.equal(jsonListScenes.sucesso, true);
  assert.equal(jsonListScenes.dados.length, 1);
  assert.equal(jsonListScenes.dados[0].xp_triggers.length, 2);
  console.log('   ✅ Cena criada e listada com 2 gatilhos de XP configurados');

  // ----------------------------------------------------
  // TESTE 15: Disparo de Gatilho de XP na Cena (campaigns.scenes.triggerXP)
  // ----------------------------------------------------
  console.log('\n15. Testando acionamento de gatilho de XP de cena...');
  const resTriggerXP = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'campaigns.scenes.triggerXP',
      data: {
        campaignId: 'cmp_teste_relogio',
        sceneId,
        triggerId: 'trg_entrada'
      }
    })
  }), env);

  const jsonTriggerXP = await resTriggerXP.json();
  assert.equal(jsonTriggerXP.sucesso, true);
  assert.equal(jsonTriggerXP.dados.xpConcedido, 1);
  console.log('   ✅ Gatilho "trg_entrada" acionado e concedeu 1 XP para a party');

  // ----------------------------------------------------
  // TESTE 16: Concessão Direta de XP e Subida de Nível (rpg.character.awardXP & levelUp)
  // ----------------------------------------------------
  console.log('\n16. Testando concessão de XP e evolução com Level Up...');
  // Concede +1 XP para o personagem chr_player_02 (totalizando 2 XP, pronto para Nível 2)
  const resAward = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      action: 'rpg.character.awardXP',
      data: {
        campaignId: 'cmp_teste_relogio',
        characterId: 'chr_player_02',
        xpAmount: 1,
        motivo: 'Superação de Desafio'
      }
    })
  }), env);

  const jsonAward = await resAward.json();
  assert.equal(jsonAward.sucesso, true);
  assert.equal(jsonAward.dados[0].xpAtual, 2);
  assert.equal(jsonAward.dados[0].prontoParaEvoluir, true);

  // Executa Level Up
  const resLevelUp = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer }, // Jogador dono
    body: JSON.stringify({
      action: 'rpg.character.levelUp',
      data: { characterId: 'chr_player_02' }
    })
  }), env);

  const jsonLevelUp = await resLevelUp.json();
  assert.equal(jsonLevelUp.sucesso, true);
  assert.equal(jsonLevelUp.dados.novoNivel, 2);
  assert.equal(jsonLevelUp.dados.sheet.xp_atual, 0); // XP ZERADO
  assert.equal(jsonLevelUp.dados.pontosAtributoDisponiveis, 2); // +2 atributos
  assert.equal(jsonLevelUp.dados.novaMaxAnima, 23); // 20 + 3
  console.log('   ✅ Level Up concluído com sucesso: Nível 2 alcançado, XP zerado e +2 pontos concedidos');

  // ----------------------------------------------------
  // TESTE 17: Distribuição Dinâmica de Pontos de Atributos (rpg.character.distributeAttributes)
  // ----------------------------------------------------
  console.log('\n17. Testando distribuição dinâmica de pontos de atributos...');
  const resDist = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'rpg.character.distributeAttributes',
      data: {
        characterId: 'chr_player_02',
        distribution: { corpo: 1, mente: 1 }
      }
    })
  }), env);

  const jsonDist = await resDist.json();
  assert.equal(jsonDist.sucesso, true);
  assert.equal(jsonDist.dados.pontosRestantes, 0);
  assert.equal(jsonDist.dados.atributos.corpo, 2); // 1 + 1
  assert.equal(jsonDist.dados.atributos.mente, 2); // 1 + 1
  assert.equal(jsonDist.dados.novasEspecializacoesDisponiveis, 1); // +1 por subir Mente
  // ----------------------------------------------------
  // TESTE 18: Criação de Personagem Canônica AlphaD6 e Trava de 1 por Campanha
  // ----------------------------------------------------
  console.log('\n18. Testando criação de personagem oficial AlphaD6 e trava de 1 personagem por campanha...');
  
  // 18.1 Tentativa de criar segundo personagem na mesma campanha (deve falhar com LIMIT_REACHED)
  const resLimit = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'rpg.character.createAlphaD6',
      data: {
        name: 'Segundo Personagem Inválido',
        arquetipo: 'Guerreiro',
        atributos: { corpo: 3, mente: 3, social: 2, espirito: 2 },
        especializacoes: ['Luta', 'Táticas', 'Foco'],
        contatos: [
          { nome: 'A', vinculo: 'amizade', ocupacao: 'Guarda' },
          { nome: 'B', vinculo: 'divida', ocupacao: 'Ferreiro' },
          { nome: 'C', vinculo: 'aliado', ocupacao: 'Comerciante' }
        ],
        campaignId: 'cmp_teste_relogio' // Já possui chr_player_02 nesta mesa
      }
    })
  }), env);

  const jsonLimit = await resLimit.json();
  assert.equal(resLimit.status, 400);
  assert.equal(jsonLimit.sucesso, false);
  assert.equal(jsonLimit.codigo, 'LIMIT_REACHED');
  console.log('   ✅ Trava de integridade ativa: Impediu criação de 2º personagem para o mesmo jogador na mesma campanha');

  // 18.2 Cria uma nova campanha para permitir criação de personagem
  await db.prepare(`
    INSERT INTO campaigns (id, simple_id, name, owner_id, system_id)
    VALUES ('cmp_nova_aventura', 'AVEN-001', 'A Saga dos Ermos', 'usr_rpg_tester', 'alphad6');
  `).run();

  const resCreateAlpha = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'rpg.character.createAlphaD6',
      data: {
        name: 'Rowan O Rastreador',
        sexo: 'Masculino',
        idade: '32 anos',
        raca: 'Humano',
        arquetipo: 'Caçador de Horrores',
        atributos: { corpo: 3, mente: 3, social: 2, espirito: 2 }, // soma 10
        especializacoes: ['Rastreamento Selvagem', 'Tiroteio Tático', 'Sobrevivência'], // 3 para Mente 3
        contatos: [
          { nome: 'Silas', vinculo: 'amizade', ocupacao: 'Guarda Florestal' },
          { nome: 'Madame Zara', vinculo: 'divida', ocupacao: 'Cartomante' },
          { nome: 'Coronel Vance', vinculo: 'antigo_aliado', ocupacao: 'Veterano' }
        ],
        lore: {
          historia_origem: 'Cresceu nas florestas fronteiriças atacadas pelo Vazio.',
          personalidade: 'Silencioso, cauteloso e desconfiado.',
          motivacao: 'Proteger os assentamentos rurais de incursões sombrias.'
        },
        equipamentoSilhueta: {
          tronco: { nome: 'Defesa Básica', bonusDefesa: 1 },
          mao_primaria: { nome: 'Arma de Fogo Média e Forte', dano: '2d8+4', atributo: 'mente' }
        },
        campaignId: 'cmp_nova_aventura'
      }
    })
  }), env);

  const jsonCreateAlpha = await resCreateAlpha.json();
  assert.equal(jsonCreateAlpha.sucesso, true);
  const newAlphaCharId = jsonCreateAlpha.dados.id;
  assert.ok(newAlphaCharId.startsWith('chr_'));
  assert.equal(jsonCreateAlpha.dados.sheet.identidade.nome, 'Rowan O Rastreador');
  assert.equal(jsonCreateAlpha.dados.sheet.sistema_estado.defesa_total, 2); // Base 1 + 1 armadura
  assert.equal(jsonCreateAlpha.dados.sheet.sistema_estado.armas_ativas.length, 1);
  console.log('   ✅ Personagem AlphaD6 criado com sucesso no banco D1 com silhueta e metadados de sistema');

  // ----------------------------------------------------
  // TESTE 19: Equipando Slot na Silhueta de Equipamento (rpg.character.equipSlot)
  // ----------------------------------------------------
  console.log('\n19. Testando atualização de slots na silhueta (rpg.character.equipSlot)...');
  const resEquip = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'rpg.character.equipSlot',
      data: {
        characterId: newAlphaCharId,
        slotKey: 'tronco',
        item: { nome: 'Defesa Reforçada', bonusDefesa: 2 }
      }
    })
  }), env);

  const jsonEquip = await resEquip.json();
  assert.equal(jsonEquip.sucesso, true);
  assert.equal(jsonEquip.dados.defesaTotal, 3); // 1 + 2
  console.log('   ✅ Slot "tronco" atualizado para Defesa Reforçada e Defesa total recalculada para 3');

  // ----------------------------------------------------
  // TESTE 20: Atualização de Lore e Estado de Sistema
  // ----------------------------------------------------
  console.log('\n20. Testando atualização de lore e estado de sistema...');
  const resLore = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'rpg.character.updateLore',
      data: {
        characterId: newAlphaCharId,
        lore: { diario_anotacoes: 'Encontrei pegadas estranhas na floresta esta noite.' }
      }
    })
  }), env);
  const jsonLore = await resLore.json();
  assert.equal(jsonLore.sucesso, true);
  assert.equal(jsonLore.dados.lore.diario_anotacoes, 'Encontrei pegadas estranhas na floresta esta noite.');

  const resSys = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'rpg.character.updateSystemState',
      data: {
        characterId: newAlphaCharId,
        acoesRestantes: 2,
        reacoesDisponiveis: 1,
        condicoes: ['alerta']
      }
    })
  }), env);
  const jsonSys = await resSys.json();
  assert.equal(jsonSys.sucesso, true);
  assert.equal(jsonSys.dados.sistemaEstado.acoes_restantes, 2);
  assert.equal(jsonSys.dados.sistemaEstado.reacoes_disponiveis, 1);
  assert.deepEqual(jsonSys.dados.sistemaEstado.condicoes, ['alerta']);
  console.log('   ✅ Lore e variáveis de estado de sistema atualizadas com sucesso');

  // ----------------------------------------------------
  // TESTE 21: Listagem Hierárquica de Personagens (characters.listHierarchical)
  // ----------------------------------------------------
  console.log('\n21. Testando listagem hierárquica por pastas (characters.listHierarchical)...');
  const resHier = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'characters.listHierarchical',
      data: {}
    })
  }), env);
  const jsonHier = await resHier.json();
  assert.equal(jsonHier.sucesso, true);
  assert.ok(Array.isArray(jsonHier.dados));
  assert.ok(jsonHier.dados.length >= 1);
  const alphad6Folder = jsonHier.dados.find(d => d.systemId === 'alphad6');
  assert.ok(alphad6Folder);
  assert.equal(alphad6Folder.systemName, 'AlphaD6 RPG');
  assert.ok(alphad6Folder.campaigns.length >= 1);
  console.log('   ✅ characters.listHierarchical retornou estrutura hierárquica por Sistemas > Campanhas > Personagens');

  // ----------------------------------------------------
  // TESTE 22: Listagem de Membros da Party da Campanha (campaigns.characters.list)
  // ----------------------------------------------------
  console.log('\n22. Testando listagem da party da mesa (campaigns.characters.list)...');
  const resParty = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookiePlayer },
    body: JSON.stringify({
      action: 'campaigns.characters.list',
      data: { campaignId: 'cmp_nova_aventura' }
    })
  }), env);
  const jsonParty = await resParty.json();
  assert.equal(jsonParty.sucesso, true);
  assert.ok(Array.isArray(jsonParty.dados));
  assert.equal(jsonParty.dados.length, 1);
  assert.equal(jsonParty.dados[0].name, 'Rowan O Rastreador');
  assert.equal(jsonParty.dados[0].playerName, 'Jogador Simples');
  console.log('   ✅ campaigns.characters.list retornou os personagens e dados dos jogadores da mesa');

  console.log('\n🎉 TODOS OS TESTES DO MOTOR DE COMBATE, EVOLUÇÃO, CRIAÇÃO DE PERSONAGENS, HIERARQUIA E GATEWAY RPG PASSARAM COM SUCESSO!\n');
}

runRPGSyncTests().catch(err => {
  console.error('❌ FALHA NO TESTE:', err);
  process.exit(1);
});
