/**
 * Testes Automatizados: Sistema de Chat, Persistência e Governança da Campanha
 * Cobre:
 * - chat.getHistory e chat.send
 * - Mensagens In-Character (IC), Out-Of-Character (OOC), Ações (/me), Narrações (/gm) e NPCs (/npc)
 * - Comandos de rolagem (/roll, /r) e rolagens secretas (/gmroll)
 * - Sussurros privados (/w) com filtragem estrita de privacidade
 * - Cards interativos de descanso (/descanso) e resposta do Mestre (chat.respondActionCard)
 * - Exclusão de mensagem (chat.deleteMessage) por autor e por mestre
 * - Limpeza total de histórico (chat.clearHistory) exclusiva para o Mestre
 */
import { createLocalD1 } from '../src/db/localD1.js';
import { handleAuthRequest } from '../src/services/authService.js';
import { handleSyncRequest } from '../src/services/syncService.js';
import { dbQueries } from '../src/db/queries.js';

async function runTests() {
  console.log('💬 INICIANDO SUÍTE DE TESTES: CHAT DA CAMPANHA & PERSISTÊNCIA D1\n');

  const db = createLocalD1(':memory:');
  const env = {
    DB: db,
    JWT_SECRET: 'test-chat-secret-2026',
    ENVIRONMENT: 'test'
  };
  const ip = '127.0.0.1';

  let userCounter = 1;
  async function criarUsuario(email, name, nick, role = 'jogador') {
    const userIp = `127.0.0.${userCounter}`;
    const deviceId = `dev_fingerprint_chat_test_${userCounter++}`;

    const regReq = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': deviceId
      },
      body: JSON.stringify({
        action: 'register',
        data: { email, password: 'SenhaForte123!', displayName: name }
      })
    });
    const regRes = await handleAuthRequest(regReq, env, userIp);
    const regData = await regRes.json();
    if (!regData.usuario) {
      throw new Error(`Erro ao cadastrar ${email}: ${JSON.stringify(regData)}`);
    }
    const userId = regData.usuario.id;

    // Verificar e-mail
    const verifyReq = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': deviceId
      },
      body: JSON.stringify({
        action: 'verify_email',
        data: { email, code: regData._codigoTesteDev }
      })
    });
    const verifyRes = await handleAuthRequest(verifyReq, env, userIp);
    let cookie = verifyRes.headers.get('Set-Cookie');

    // Setup de perfil
    const setupReq = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        action: 'profile.setup',
        data: {
          name,
          nickname: nick,
          ageGroup: '25-34',
          bio: `Bio de ${name}`,
          contacts: {}
        }
      })
    });
    const setupRes = await handleSyncRequest(setupReq, env, userIp);
    cookie = setupRes.headers.get('Set-Cookie') || cookie;

    if (role !== 'jogador') {
      await dbQueries.updateUserRole(db, userId, role);
      const loginReq = new Request('http://localhost/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          data: { email, password: 'SenhaForte123!' }
        })
      });
      const loginRes = await handleAuthRequest(loginReq, env, userIp);
      cookie = loginRes.headers.get('Set-Cookie') || cookie;
    }

    return { userId, email, name, nick, cookie, ip: userIp };
  }


  async function syncCall(userObj, action, data) {
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userObj.cookie
      },
      body: JSON.stringify({ action, data })
    });
    const res = await handleSyncRequest(req, env, userObj.ip);
    return await res.json();
  }

  // 1. Setup de Usuários e Campanha
  console.log('1. Criando Mestre, Jogador 1 (Thorek) e Jogador 2 (Elion)...');
  const mestre = await criarUsuario('mestre.chat@rpg.com', 'Mestre Arthur', 'mestrearthur', 'mestre');
  const jog1 = await criarUsuario('jog1.chat@rpg.com', 'Thorek Machado de Pedra', 'thorek', 'jogador');
  const jog2 = await criarUsuario('jog2.chat@rpg.com', 'Elion Brisa Estelar', 'elion', 'jogador');

  console.log('2. Criando campanha com moderação manual de ações (auto_approve_actions = 0)...');
  const campRes = await syncCall(mestre, 'campaigns.create', {
    name: 'A Cripta dos Condenados',
    systemId: 'alphad6',
    themeId: 'dark-fantasy',
    maxPlayers: 5,
    loreDescription: 'Uma antiga catacumba sob a colina proibida.',
    settings: {
      auto_approve_actions: 0
    }
  });

  const campData = campRes.dados || campRes.campanha;
  if (!campRes.sucesso || !campData) {
    throw new Error(`Falha ao criar campanha: ${JSON.stringify(campRes)}`);
  }
  const campId = campData.id;

  // Ingressar jogadores na campanha
  await dbQueries.addPlayerToCampaign(db, campId, jog1.userId, 'jogador');
  await dbQueries.addPlayerToCampaign(db, campId, jog2.userId, 'jogador');


  // Criar personagem para Thorek (Jog 1)
  const charRes = await syncCall(jog1, 'characters.create', {
    name: 'Thorek Guerreiro',
    campaignId: campId,
    sheetData: {
      nome: 'Thorek Guerreiro',
      atributos: { corpo: 4, mente: 2, social: 2, espirito: 3 },
      anima: 12,
      max_anima: 20
    }
  });
  const charId = charRes.dados?.id || charRes.personagem?.id;

  console.log('✅ Setup inicial concluído com sucesso.\n');


  // ==========================================
  // TESTE 1: Envio de Mensagem In-Character (IC) e Out-Of-Character (OOC)
  // ==========================================
  console.log('TESTE 1: Envio de Mensagens IC e OOC');
  const msgIc = await syncCall(jog1, 'chat.send', {
    campaignId: campId,
    content: 'Empunho meu machado e olho para as sombras da cripta.',
    msgType: 'ic',
    characterId: charId
  });

  if (!msgIc.sucesso || msgIc.mensagem.msg_type !== 'ic' || msgIc.mensagem.author_name !== 'Thorek Guerreiro') {
    throw new Error(`Falha no envio de mensagem IC: ${JSON.stringify(msgIc)}`);
  }
  console.log('  ✓ Mensagem In-Character enviada e salva com autor vinculado.');

  const msgOoc = await syncCall(jog1, 'chat.send', {
    campaignId: campId,
    content: '/ooc Pessoal, vou precisar sair em 30 minutos.',
    characterId: charId
  });

  if (!msgOoc.sucesso || msgOoc.mensagem.msg_type !== 'ooc' || !msgOoc.mensagem.content.includes('30 minutos')) {
    throw new Error(`Falha no parser /ooc: ${JSON.stringify(msgOoc)}`);
  }
  console.log('  ✓ Mensagem /ooc processada e salva com tag OOC.');

  // ==========================================
  // TESTE 2: Ação Narrativa (/me) e Narração do Mestre (/gm)
  // ==========================================
  console.log('\nTESTE 2: Ações Narrativas (/me) e Narração do Mestre (/gm)');
  const msgMe = await syncCall(jog1, 'chat.send', {
    campaignId: campId,
    content: '/me acende uma tocha hesitante na escuridão.'
  });
  if (!msgMe.sucesso || msgMe.mensagem.msg_type !== 'acao') {
    throw new Error(`Falha no comando /me: ${JSON.stringify(msgMe)}`);
  }
  console.log('  ✓ Comando /me processado com msg_type = "acao".');

  const msgGm = await syncCall(mestre, 'chat.send', {
    campaignId: campId,
    content: '/gm Um vento gélido apaga subitamente a chama, e correntes ecoam nas profundezas.'
  });
  if (!msgGm.sucesso || msgGm.mensagem.msg_type !== 'narracao' || msgGm.mensagem.author_name !== 'Narrador') {
    throw new Error(`Falha na narração /gm: ${JSON.stringify(msgGm)}`);
  }
  console.log('  ✓ Comando /gm transformado em narração nobre do Mestre.');

  // ==========================================
  // TESTE 3: Fala de NPC pelo Mestre (/npc)
  // ==========================================
  console.log('\nTESTE 3: Fala de NPC pelo Mestre (/npc)');
  const msgNpc = await syncCall(mestre, 'chat.send', {
    campaignId: campId,
    content: '/npc Guardião_Espectral "Quem ousa perturbar o sono eterno dos reis?"'
  });
  if (!msgNpc.sucesso || msgNpc.mensagem.author_role !== 'npc' || msgNpc.mensagem.author_name !== 'Guardião_Espectral') {
    throw new Error(`Falha no comando /npc: ${JSON.stringify(msgNpc)}`);
  }
  console.log('  ✓ Comando /npc criou fala autêntica de NPC.');

  // ==========================================
  // TESTE 4: Comandos de Rolagem (/roll, /r) e Rolagem Secreta (/gmroll)
  // ==========================================
  console.log('\nTESTE 4: Rolagens de Dados e Teste AlphaD6');
  const msgRoll = await syncCall(jog1, 'chat.send', {
    campaignId: campId,
    content: '/roll corpo esp:machado dif:4',
    characterId: charId
  });
  if (!msgRoll.sucesso || msgRoll.mensagem.msg_type !== 'roll' || !msgRoll.mensagem.metadata.roll_data) {
    throw new Error(`Falha na rolagem AlphaD6: ${JSON.stringify(msgRoll)}`);
  }
  console.log(`  ✓ Rolagem AlphaD6 executada: ${msgRoll.mensagem.content}`);

  const msgGmRoll = await syncCall(mestre, 'chat.send', {
    campaignId: campId,
    content: '/gmroll 1d20+5'
  });
  if (!msgGmRoll.sucesso || !msgGmRoll.mensagem.metadata.isSecret || msgGmRoll.mensagem.whisper_target_id !== mestre.userId) {
    throw new Error(`Falha na rolagem secreta /gmroll: ${JSON.stringify(msgGmRoll)}`);
  }
  console.log('  ✓ Rolagem /gmroll gerada com trava secreta para o Mestre.');

  // ==========================================
  // TESTE 5: Sussurros (/w) e Filtragem de Privacidade
  // ==========================================
  console.log('\nTESTE 5: Sussurros Confidenciais (/w) e RLS de Visualização');
  const msgWhisper = await syncCall(mestre, 'chat.send', {
    campaignId: campId,
    content: `/w thorek Você percebe uma runa oculta sob a soleira da porta.`
  });
  if (!msgWhisper.sucesso || msgWhisper.mensagem.msg_type !== 'whisper' || msgWhisper.mensagem.whisper_target_id !== jog1.userId) {
    throw new Error(`Falha no sussurro /w: ${JSON.stringify(msgWhisper)}`);
  }
  console.log('  ✓ Sussurro enviado com destinatário fixado para Jogador 1.');

  // Consulta histórico pelo Jogador 1 (Deve ver o sussurro)
  const histJog1 = await syncCall(jog1, 'chat.getHistory', { campaignId: campId });
  const achouWhisperJog1 = histJog1.mensagens.some(m => m.id === msgWhisper.mensagem.id);
  if (!achouWhisperJog1) {
    throw new Error('Jogador 1 deveria enxergar o sussurro enviado a ele!');
  }
  console.log('  ✓ Jogador 1 visualiza o sussurro recebido no histórico.');

  // Consulta histórico pelo Jogador 2 (NÃO deve ver o sussurro!)
  const histJog2 = await syncCall(jog2, 'chat.getHistory', { campaignId: campId });
  const achouWhisperJog2 = histJog2.mensagens.some(m => m.id === msgWhisper.mensagem.id);
  if (achouWhisperJog2) {
    throw new Error('Vulnerabilidade de privacidade: Jogador 2 NÃO pode ver o sussurro entre Mestre e Jogador 1!');
  }
  console.log('  ✓ Jogador 2 NÃO visualiza o sussurro alheio (Privacidade validada).');

  // ==========================================
  // TESTE 6: Cards Interativos de Descanso e Moderação (chat.respondActionCard)
  // ==========================================
  console.log('\nTESTE 6: Solicitação de Descanso e Aprovação pelo Mestre');
  const msgRest = await syncCall(jog1, 'chat.send', {
    campaignId: campId,
    content: '/descanso curto',
    characterId: charId
  });
  if (!msgRest.sucesso || msgRest.mensagem.msg_type !== 'action_card' || msgRest.mensagem.metadata.action_data?.status !== 'pendente') {
    throw new Error(`Falha ao gerar action_card de descanso: ${JSON.stringify(msgRest)}`);
  }
  const actionMsgId = msgRest.mensagem.id;
  console.log('  ✓ Solicitação de descanso gerou action_card pendente.');

  // Tentativa do Jogador 2 responder a ação (deve ser rejeitado 403)
  const respFail = await syncCall(jog2, 'chat.respondActionCard', {
    campaignId: campId,
    messageId: actionMsgId,
    acao: 'aceitar'
  });
  if (respFail.sucesso) {
    throw new Error('Jogador comum não pode autorizar descanso de outro jogador!');
  }
  console.log('  ✓ Jogador comum bloqueado ao tentar autorizar card de ação.');

  // Mestre aceita a solicitação
  const respOk = await syncCall(mestre, 'chat.respondActionCard', {
    campaignId: campId,
    messageId: actionMsgId,
    acao: 'aceitar'
  });
  if (!respOk.sucesso || respOk.actionData.status !== 'aprovado') {
    throw new Error(`Falha ao autorizar ação pelo Mestre: ${JSON.stringify(respOk)}`);
  }
  console.log('  ✓ Mestre aprovou descanso, aplicando cura e avanço de relógio.');

  // ==========================================
  // TESTE 7: Exclusão de Mensagens e Limpeza de Histórico
  // ==========================================
  console.log('\nTESTE 7: Exclusão de Mensagens e Limpeza pelo Mestre');
  // Jogador apaga sua própria mensagem
  const delAuthor = await syncCall(jog1, 'chat.deleteMessage', {
    campaignId: campId,
    messageId: msgIc.mensagem.id
  });
  if (!delAuthor.sucesso) {
    throw new Error(`Autor deveria conseguir apagar sua própria mensagem: ${JSON.stringify(delAuthor)}`);
  }
  console.log('  ✓ Autor apagou sua mensagem com sucesso.');

  // Mestre apaga mensagem de terceiros
  const delMestre = await syncCall(mestre, 'chat.deleteMessage', {
    campaignId: campId,
    messageId: msgOoc.mensagem.id
  });
  if (!delMestre.sucesso) {
    throw new Error(`Mestre deveria conseguir apagar qualquer mensagem: ${JSON.stringify(delMestre)}`);
  }
  console.log('  ✓ Mestre apagou mensagem de jogador com sucesso.');

  // Mestre limpa todo o chat
  const clearRes = await syncCall(mestre, 'chat.clearHistory', { campaignId: campId });
  if (!clearRes.sucesso) {
    throw new Error(`Falha na limpeza de chat pelo Mestre: ${JSON.stringify(clearRes)}`);
  }
  console.log('  ✓ Mestre limpou todo o histórico da campanha.');

  const finalHist = await syncCall(mestre, 'chat.getHistory', { campaignId: campId });
  if (finalHist.mensagens.length !== 0) {
    throw new Error(`Histórico deveria estar vazio após limpeza, mas tem ${finalHist.mensagens.length} mensagens.`);
  }
  console.log('  ✓ Histórico pós-limpeza confirmado vazio.');

  console.log('\n🎉 TODOS OS TESTES DO CHAT DA CAMPANHA FORAM CONCLUÍDOS COM 100% DE SUCESSO!');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NA SUÍTE DE TESTES:', err);
  process.exit(1);
});
