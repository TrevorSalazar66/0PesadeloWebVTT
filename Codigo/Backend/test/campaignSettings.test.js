/**
 * Teste Automatizado das Configurações & Governança da Campanha
 * Cobre:
 * - campaigns.settings.update (autoApproveActions, sceneAccessMode, xpMultiplier, etc.)
 * - campaigns.requests.list e campaigns.requests.respond (aprovação/rejeição)
 * - campaigns.players.setRole (promoção a assistente de mestre e rebaixamento)
 * - campaigns.players.kick (expulsão da mesa)
 * - campaigns.players.ban (banimento no nível de mestre - todas as mesas)
 * - Bloqueio de novas solicitações/entrada para jogadores banidos pelo mestre (403)
 * - campaigns.players.listBanned e campaigns.players.unban (desbanimento)
 * - campaigns.delete (exclusão definitiva de campanha)
 */
import { createLocalD1 } from '../src/db/localD1.js';
import { handleAuthRequest } from '../src/services/authService.js';
import { handleSyncRequest } from '../src/services/syncService.js';
import { dbQueries } from '../src/db/queries.js';

async function runTests() {
  console.log('🛡️  INICIANDO SUÍTE DE TESTES: CONFIGURAÇÕES & GOVERNANÇA DA CAMPANHA\n');

  const db = createLocalD1(':memory:');
  const env = {
    DB: db,
    JWT_SECRET: 'test-campaign-config-secret-2026',
    ENVIRONMENT: 'test'
  };
  const ip = '127.0.0.1';

  let userCounter = 1;
  async function criarUsuario(email, name, nick, role = 'jogador') {
    const userIp = `127.0.0.${userCounter}`;
    const deviceId = `dev_fingerprint_camp_test_${userCounter++}`;

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
    const setupRes = await handleSyncRequest(setupReq, env, ip);
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
      const loginRes = await handleAuthRequest(loginReq, env, ip);
      cookie = loginRes.headers.get('Set-Cookie');
    }

    return { userId, email, name, role, cookie };
  }

  // Helper para chamar sync
  async function callSync(user, action, data) {
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': user?.cookie || ''
      },
      body: JSON.stringify({ action, data })
    });
    const res = await handleSyncRequest(req, env, ip);
    return await res.json();
  }

  // 1. Criar usuários (Mestre, Jogador 1, Jogador Infrator)
  console.log('1. Criando Mestre e Jogadores...');
  const uMestre = await criarUsuario('mestre@arcana.vtt', 'Mestre Gandalf', 'gandalf_gm', 'mestre');
  const uJogador1 = await criarUsuario('aragorn@arcana.vtt', 'Aragorn', 'passolargo', 'jogador');
  const uJogador2 = await criarUsuario('grima@arcana.vtt', 'Gríma Língua de Cobra', 'grima_infrator', 'jogador');
  console.log('   ✓ Usuários criados com sucesso.');

  // 2. Mestre cria uma campanha
  console.log('\n2. Mestre criando campanha...');
  const createRes = await callSync(uMestre, 'campaigns.create', {
    name: 'A Sociedade do Anel',
    systemId: 'alphad6',
    themeId: 'high-fantasy',
    description: 'Campanha épica de fantasia.',
    maxPlayers: 6,
    isPublic: 1
  });
  if (!createRes.sucesso || !createRes.dados) {
    throw new Error(`Falha ao criar campanha: ${JSON.stringify(createRes)}`);
  }
  const campaignId = createRes.dados.id;
  console.log(`   ✓ Campanha criada com ID: ${campaignId} (Simple ID: ${createRes.dados.simple_id})`);

  // 3. Atualizar configurações da campanha (campaigns.settings.update)
  console.log('\n3. Testando campaigns.settings.update...');
  const updateSettingsRes = await callSync(uMestre, 'campaigns.settings.update', {
    campaignId,
    name: 'A Sociedade do Anel - Edição Estendida',
    systemId: 'alphad6',
    themeId: 'dark-fantasy',
    notices: 'Sessão 1 marcada para sábado às 20h.',
    isPublic: 1,
    maxPlayers: 8,
    autoApproveActions: 1,
    sceneAccessMode: 'approval_required',
    xpMultiplier: 1.5,
    discordVoiceUrl: 'https://discord.gg/sociedade-anel',
    discordWebhookUrl: 'https://discord.com/api/webhooks/12345/abcdef',
    soundEffectsVolume: 75
  });

  if (!updateSettingsRes.sucesso) {
    throw new Error(`Falha ao atualizar settings: ${JSON.stringify(updateSettingsRes)}`);
  }
  console.log('   ✓ Configurações salvas com sucesso.');

  // Validar leitura da campanha
  const getCampRes = await callSync(uMestre, 'campaigns.get', { campaignId });
  const campData = getCampRes.dados;
  if (
    campData.name !== 'A Sociedade do Anel - Edição Estendida' ||
    campData.settings?.auto_approve_actions !== 1 ||
    campData.settings?.scene_access_mode !== 'approval_required' ||
    campData.settings?.xp_multiplier !== 1.5 ||
    campData.settings?.discord_voice_url !== 'https://discord.gg/sociedade-anel' ||
    campData.settings?.sound_effects_volume !== 75
  ) {
    throw new Error(`Dados de configuração salvos não conferem: ${JSON.stringify(campData)}`);
  }
  console.log('   ✓ Leitura dos campos de settings confirmada no banco.');

  // 4. Jogador 1 solicita entrada (campaigns.request)
  console.log('\n4. Jogador 1 solicitando entrada na campanha...');
  const req1Res = await callSync(uJogador1, 'campaigns.request', {
    campaignId,
    message: 'Gostaria de jogar com meu Guardião do Norte.'
  });
  if (!req1Res.sucesso) {
    throw new Error(`Falha na solicitação de entrada: ${JSON.stringify(req1Res)}`);
  }
  console.log('   ✓ Solicitação enviada.');

  // 5. Mestre lista solicitações e aprova Jogador 1
  console.log('\n5. Mestre listando e aprovando solicitação de entrada...');
  const listReqsRes = await callSync(uMestre, 'campaigns.requests.list', { campaignId });
  if (!listReqsRes.sucesso || !Array.isArray(listReqsRes.dados) || listReqsRes.dados.length === 0) {
    throw new Error(`Solicitação não encontrada: ${JSON.stringify(listReqsRes)}`);
  }
  const reqObj = listReqsRes.dados[0];
  console.log(`   ✓ Solicitação pendente localizada de: ${reqObj.display_name} (ID: ${reqObj.id})`);

  const respondReqRes = await callSync(uMestre, 'campaigns.requests.respond', {
    campaignId,
    requestId: reqObj.id,
    status: 'approved'
  });
  if (!respondReqRes.sucesso) {
    throw new Error(`Falha ao responder solicitação: ${JSON.stringify(respondReqRes)}`);
  }
  console.log('   ✓ Solicitação aprovada com sucesso.');

  // 6. Promover Jogador 1 para Assistente de Mestre (campaigns.players.setRole)
  console.log('\n6. Promovendo Jogador 1 para Assistente de Mestre...');
  const setRoleRes = await callSync(uMestre, 'campaigns.players.setRole', {
    campaignId,
    userId: uJogador1.userId,
    role: 'assistente'
  });
  if (!setRoleRes.sucesso) {
    throw new Error(`Falha ao promover assistente: ${JSON.stringify(setRoleRes)}`);
  }

  const campAfterRole = (await callSync(uMestre, 'campaigns.get', { campaignId })).dados;
  const p1 = campAfterRole.players.find(p => p.user_id === uJogador1.userId);
  if (!p1 || p1.role.toLowerCase() !== 'assistente de mestre') {
    throw new Error(`Cargo do jogador não é assistente: ${JSON.stringify(p1)}`);
  }
  console.log('   ✓ Jogador 1 promovido para "assistente de mestre".');

  // Rebaixar de volta para jogador
  await callSync(uMestre, 'campaigns.players.setRole', {
    campaignId,
    userId: uJogador1.userId,
    role: 'jogador'
  });
  console.log('   ✓ Cargo rebaixado de volta para "jogador".');

  // 7. Jogador 2 solicita entrada e é aceito
  console.log('\n7. Jogador 2 solicitando entrada...');
  await callSync(uJogador2, 'campaigns.request', {
    campaignId,
    message: 'Posso entrar?'
  });
  const listReqs2 = await callSync(uMestre, 'campaigns.requests.list', { campaignId });
  const req2Obj = listReqs2.dados.find(r => r.user_id === uJogador2.userId);
  await callSync(uMestre, 'campaigns.requests.respond', {
    campaignId,
    requestId: req2Obj.id,
    status: 'approved'
  });
  console.log('   ✓ Jogador 2 ingressou na mesa.');

  // 8. Mestre expulsa Jogador 2 da mesa (campaigns.players.kick)
  console.log('\n8. Testando expulsão (campaigns.players.kick)...');
  const kickRes = await callSync(uMestre, 'campaigns.players.kick', {
    campaignId,
    userId: uJogador2.userId
  });
  if (!kickRes.sucesso) {
    throw new Error(`Falha ao expulsar jogador: ${JSON.stringify(kickRes)}`);
  }
  const campAfterKick = (await callSync(uMestre, 'campaigns.get', { campaignId })).dados;
  if (campAfterKick.players.some(p => p.user_id === uJogador2.userId)) {
    throw new Error(`Jogador expulso ainda consta na campanha!`);
  }
  console.log('   ✓ Jogador 2 expulso da mesa com sucesso.');

  // 9. Mestre bane Jogador 2 em nível de Mestre (campaigns.players.ban)
  console.log('\n9. Testando banimento no nível de Mestre (campaigns.players.ban)...');
  const banRes = await callSync(uMestre, 'campaigns.players.ban', {
    campaignId,
    playerId: uJogador2.userId,
    reason: 'Comportamento tóxico nas sessões'
  });
  if (!banRes.sucesso) {
    throw new Error(`Falha ao banir jogador: ${JSON.stringify(banRes)}`);
  }
  console.log('   ✓ Jogador 2 banido de todas as mesas do Mestre.');

  // 10. Listar banidos pelo Mestre (campaigns.players.listBanned)
  console.log('\n10. Listando jogadores banidos pelo Mestre...');
  const listBannedRes = await callSync(uMestre, 'campaigns.players.listBanned', { campaignId });
  if (!listBannedRes.sucesso || !Array.isArray(listBannedRes.dados) || listBannedRes.dados.length === 0) {
    throw new Error(`Jogador banido não encontrado na lista: ${JSON.stringify(listBannedRes)}`);
  }
  const bannedRecord = listBannedRes.dados.find(b => b.player_id === uJogador2.userId);
  if (!bannedRecord || bannedRecord.reason !== 'Comportamento tóxico nas sessões') {
    throw new Error(`Registro de banimento inválido: ${JSON.stringify(bannedRecord)}`);
  }
  console.log(`   ✓ Banimento verificado: ${bannedRecord.display_name} - Motivo: ${bannedRecord.reason}`);

  // 11. Jogador 2 tenta solicitar entrada de novo na campanha do Mestre e deve receber 403
  console.log('\n11. Verificando bloqueio de entrada para jogador banido...');
  const bannedTryReq = await callSync(uJogador2, 'campaigns.request', {
    campaignId,
    message: 'Por favor, me deixa entrar de novo!'
  });
  if (bannedTryReq.sucesso) {
    throw new Error(`Jogador banido conseguiu solicitar entrada indevidamente!`);
  }
  console.log(`   ✓ Bloqueio confirmado com erro esperado: "${bannedTryReq.erro}"`);

  // 12. Mestre desbane Jogador 2 (campaigns.players.unban)
  console.log('\n12. Testando desbanimento (campaigns.players.unban)...');
  const unbanRes = await callSync(uMestre, 'campaigns.players.unban', {
    playerId: uJogador2.userId
  });
  if (!unbanRes.sucesso) {
    throw new Error(`Falha ao desbanir jogador: ${JSON.stringify(unbanRes)}`);
  }
  console.log('   ✓ Jogador 2 desbanido com sucesso.');

  // Agora Jogador 2 deve conseguir solicitar entrada
  const tryAgainReq = await callSync(uJogador2, 'campaigns.request', {
    campaignId,
    message: 'Prometo me comportar agora.'
  });
  if (!tryAgainReq.sucesso) {
    throw new Error(`Jogador desbanido não conseguiu solicitar entrada: ${JSON.stringify(tryAgainReq)}`);
  }
  console.log('   ✓ Jogador desbanido conseguiu solicitar entrada novamente com sucesso.');

  // 13. Excluir campanha (campaigns.delete)
  console.log('\n13. Testando exclusão de campanha (campaigns.delete)...');
  const deleteRes = await callSync(uMestre, 'campaigns.delete', { campaignId });
  if (!deleteRes.sucesso) {
    throw new Error(`Falha ao excluir campanha: ${JSON.stringify(deleteRes)}`);
  }
  console.log('   ✓ Campanha excluída com sucesso.');

  const checkDeleted = await callSync(uMestre, 'campaigns.get', { campaignId });
  if (checkDeleted.sucesso && checkDeleted.dados) {
    throw new Error(`Campanha excluída ainda existe no banco!`);
  }
  console.log('   ✓ Confirmação de que a campanha não existe mais.');

  console.log('\n======================================================');
  console.log('🎉 TODOS OS TESTES DE CONFIGURAÇÃO E GOVERNANÇA PASSARAM COM SUCESSO!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES:', err);
  process.exit(1);
});
