/**
 * Teste Automatizado do Painel de Administração e Governança RBAC
 * Testa admin.stats, admin.users.list, admin.user.setRole, admin.campaigns.list, admin.audit.logs, admin.devices
 */
import { createLocalD1 } from '../src/db/localD1.js';
import { handleAuthRequest } from '../src/services/authService.js';
import { handleSyncRequest } from '../src/services/syncService.js';
import { dbQueries } from '../src/db/queries.js';
import { adminService } from '../src/services/adminService.js';

async function runTests() {
  console.log('🛡️  INICIANDO SUÍTE DE TESTES: PAINEL DE ADMINISTRAÇÃO & GOVERNANÇA (RBAC)\n');

  const db = createLocalD1(':memory:');
  const env = {
    DB: db,
    JWT_SECRET: 'test-admin-secret-key-vtt-2026',
    ENVIRONMENT: 'test'
  };
  const ip = '127.0.0.1';

  let userCounter = 1;
  // Helper para criar e logar usuário com perfil completo
  async function criarUsuario(email, name, nick, role = 'jogador') {
    const userIp = `127.0.0.${userCounter}`;
    const deviceId = `dev_fingerprint_test_user_${userCounter++}`;

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

    // Completar perfil
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

    // Se o papel for diferente de jogador, atualiza no banco
    if (role !== 'jogador') {
      await dbQueries.updateUserRole(db, userId, role);
      // Re-login para pegar token atualizado com nova role
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

  // 1. Criar usuários de diferentes cargos
  console.log('1. Criando usuários para os testes (Jogador, Mestre, Admin, Superadmin)...');
  const uJogador = await criarUsuario('jogador@arcana.vtt', 'Guerreiro João', 'joao_guerreiro', 'jogador');
  const uMestre = await criarUsuario('mestre@arcana.vtt', 'Mestre Gandalf', 'gandalf_gm', 'mestre');
  const uAdmin = await criarUsuario('admin@arcana.vtt', 'Admin Thorin', 'thorin_adm', 'admin');
  const uSuperadmin = await criarUsuario('super@arcana.vtt', 'Superadmin Elrond', 'elrond_super', 'superadmin');

  console.log('   ✅ Usuários criados com sucesso.');

  // 2. Criar uma campanha e um personagem para gerar métricas
  console.log('\n2. Criando campanha e personagem para alimentar estatísticas...');
  const campReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uMestre.cookie },
    body: JSON.stringify({
      action: 'campaigns.create',
      data: {
        name: 'A Queda de Khazad-dûm',
        systemId: 'AlphaD6',
        loreDescription: 'Uma jornada pelas profundezas das minas antigas.',
        maxPlayers: 5
      }
    })
  });
  const campRes = await handleSyncRequest(campReq, env, ip);
  const campData = await campRes.json();
  const campId = campData.dados.id;
  console.log(`   ✅ Campanha criada: ${campData.dados.name} (${campData.dados.simple_id})`);

  const charReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uJogador.cookie },
    body: JSON.stringify({
      action: 'characters.create',
      data: {
        name: 'Gimli Filho de Gloin',
        campaignId: campId,
        arquetipo: 'Guerreiro Anão',
        raca: 'Anão',
        sexo: 'M',
        idade: 140,
        atributos: { corpo: 4, mente: 3, social: 1, espirito: 2 },
        especializacoes: ['Machados', 'Ferreiro', 'Estratégia'],
        nivelMonetario: 'Abastado'
      }
    })
  });
  const charRes = await handleSyncRequest(charReq, env, ip);
  const charData = await charRes.json();
  if (!charData.dados) {
    throw new Error(`Erro ao criar personagem: ${JSON.stringify(charData)}`);
  }
  console.log(`   ✅ Personagem criado: ${charData.dados.name}`);

  // 3. Teste RBAC em admin.stats
  console.log('\n3. Testando RBAC em admin.stats...');
  
  // 3.1 Jogador tenta acessar stats -> DEVE FALHAR (403)
  const statsJogReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uJogador.cookie },
    body: JSON.stringify({ action: 'admin.stats' })
  });
  const statsJogRes = await handleSyncRequest(statsJogReq, env, ip);
  if (statsJogRes.status !== 403) {
    throw new Error(`Falha: Jogador deveria receber 403 em admin.stats, recebeu ${statsJogRes.status}`);
  }
  console.log('   ✅ Jogador bloqueado corretamente com 403');

  // 3.2 Mestre tenta acessar stats -> DEVE FALHAR (403)
  const statsMestreReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uMestre.cookie },
    body: JSON.stringify({ action: 'admin.stats' })
  });
  const statsMestreRes = await handleSyncRequest(statsMestreReq, env, ip);
  if (statsMestreRes.status !== 403) {
    throw new Error(`Falha: Mestre deveria receber 403 em admin.stats, recebeu ${statsMestreRes.status}`);
  }
  console.log('   ✅ Mestre bloqueado corretamente com 403');

  // 3.3 Admin acessa stats -> DEVE SUCEDER (200)
  const statsAdminReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uAdmin.cookie },
    body: JSON.stringify({ action: 'admin.stats' })
  });
  const statsAdminRes = await handleSyncRequest(statsAdminReq, env, ip);
  const statsAdminData = await statsAdminRes.json();
  if (statsAdminRes.status !== 200 || !statsAdminData.dados) {
    throw new Error(`Falha: Admin deveria acessar admin.stats com 200`);
  }
  console.log('   ✅ Admin acessou métricas:', statsAdminData.dados);
  if (statsAdminData.dados.totalUsers < 4 || statsAdminData.dados.totalCampaigns < 1 || statsAdminData.dados.totalCharacters < 1) {
    throw new Error('Falha: Métricas globais retornaram contagem inconsistente');
  }

  // 4. Teste em admin.users.list
  console.log('\n4. Testando listagem e filtros em admin.users.list...');
  const usersReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uAdmin.cookie },
    body: JSON.stringify({
      action: 'admin.users.list',
      data: { search: 'gandalf' }
    })
  });
  const usersRes = await handleSyncRequest(usersReq, env, ip);
  const usersData = await usersRes.json();
  if (usersRes.status !== 200 || usersData.dados.length !== 1 || usersData.dados[0].email !== 'mestre@arcana.vtt') {
    throw new Error('Falha: Busca de usuário em admin.users.list não retornou o resultado esperado');
  }
  console.log(`   ✅ Busca de usuário retornou: ${usersData.dados[0].display_name} (Role: ${usersData.dados[0].role})`);

  // 5. Teste de Alteração de Cargo (admin.user.setRole)
  console.log('\n5. Testando governança de cargos (admin.user.setRole)...');

  // 5.1 Admin normal tenta alterar cargo -> DEVE FALHAR (403, exclusivo para superadmin)
  const setRoleAdminReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uAdmin.cookie },
    body: JSON.stringify({
      action: 'admin.user.setRole',
      data: { targetUserId: uJogador.userId, role: 'mestre' }
    })
  });
  const setRoleAdminRes = await handleSyncRequest(setRoleAdminReq, env, ip);
  if (setRoleAdminRes.status !== 403) {
    throw new Error(`Falha: Admin comum não pode alterar cargos. Status esperado 403, obtido: ${setRoleAdminRes.status}`);
  }
  console.log('   ✅ Admin comum impedido de alterar cargo com 403');

  // 5.2 Superadmin tenta alterar para cargo inválido -> DEVE FALHAR (400)
  const setRoleInvalidReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uSuperadmin.cookie },
    body: JSON.stringify({
      action: 'admin.user.setRole',
      data: { targetUserId: uJogador.userId, role: 'rei_do_universo' }
    })
  });
  const setRoleInvalidRes = await handleSyncRequest(setRoleInvalidReq, env, ip);
  if (setRoleInvalidRes.status !== 400) {
    throw new Error(`Falha: Cargo inválido deveria retornar 400, obteve: ${setRoleInvalidRes.status}`);
  }
  console.log('   ✅ Cargo inválido rejeitado com 400');

  // 5.3 Superadmin promove Jogador para Mestre -> DEVE SUCEDER (200)
  const setRoleValidReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uSuperadmin.cookie },
    body: JSON.stringify({
      action: 'admin.user.setRole',
      data: { targetUserId: uJogador.userId, role: 'mestre' }
    })
  });
  const setRoleValidRes = await handleSyncRequest(setRoleValidReq, env, ip);
  const setRoleValidData = await setRoleValidRes.json();
  if (setRoleValidRes.status !== 200 || !setRoleValidData.sucesso) {
    throw new Error(`Falha: Superadmin não conseguiu alterar cargo: ${setRoleValidData.erro}`);
  }
  console.log('   ✅ Superadmin promoveu usuário com sucesso:', setRoleValidData.mensagem);

  // 6. Teste de Auditoria (admin.audit.logs)
  console.log('\n6. Testando trilha de auditoria administrativa (admin.audit.logs)...');
  const auditReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uAdmin.cookie },
    body: JSON.stringify({ action: 'admin.audit.logs', data: { limit: 10 } })
  });
  const auditRes = await handleSyncRequest(auditReq, env, ip);
  const auditData = await auditRes.json();
  if (auditRes.status !== 200 || !auditData.dados || auditData.dados.length === 0) {
    throw new Error('Falha: Trilha de auditoria não registrou a ação de alteração de cargo');
  }
  const lastAudit = auditData.dados[0];
  console.log(`   ✅ Log de auditoria registrado: Ação=${lastAudit.action}, Alvo=${lastAudit.target_id}, Admin=${lastAudit.admin_name}`);
  if (lastAudit.action !== 'ROLE_CHANGE' || lastAudit.target_id !== uJogador.userId) {
    throw new Error('Falha: Detalhes do log de auditoria divergentes do executado');
  }

  // 7. Teste de Campanhas Globais (admin.campaigns.list)
  console.log('\n7. Testando moderação de campanhas globais (admin.campaigns.list)...');
  const campListReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uAdmin.cookie },
    body: JSON.stringify({ action: 'admin.campaigns.list' })
  });
  const campListRes = await handleSyncRequest(campListReq, env, ip);
  const campListData = await campListRes.json();
  if (campListRes.status !== 200 || campListData.dados.length === 0) {
    throw new Error('Falha: Listagem global de campanhas não retornou mesas');
  }
  console.log(`   ✅ Campanhas encontradas: ${campListData.dados.length} mesa(s), Mestre: ${campListData.dados[0].owner_name}`);

  // 8. Teste de Desbloqueio de Dispositivo com Auditoria (admin.devices.unblock)
  console.log('\n8. Testando desbloqueio de dispositivo e log de auditoria...');
  const fakeDevice = 'fingerprint_test_99999_hash';
  await dbQueries.blockDevicePermanently(db, fakeDevice, 'Teste de trava anti-abuso');

  const unblockReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uAdmin.cookie },
    body: JSON.stringify({
      action: 'admin.devices.unblock',
      data: { deviceHash: fakeDevice }
    })
  });
  const unblockRes = await handleSyncRequest(unblockReq, env, ip);
  const unblockData = await unblockRes.json();
  if (unblockRes.status !== 200 || !unblockData.sucesso) {
    throw new Error(`Falha ao desbloquear dispositivo: ${unblockData.erro}`);
  }
  console.log('   ✅ Dispositivo liberado com sucesso');

  // Verifica se gerou o log de auditoria do desbloqueio
  const auditReq2 = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': uAdmin.cookie },
    body: JSON.stringify({ action: 'admin.audit.logs', data: { limit: 10 } })
  });
  const auditRes2 = await handleSyncRequest(auditReq2, env, ip);
  const auditData2 = await auditRes2.json();
  const unblockAudit = (auditData2.dados || []).find(a => a.action === 'DEVICE_UNBLOCK' && a.target_id === fakeDevice);
  if (!unblockAudit) {
    throw new Error('Falha: Desbloqueio de dispositivo não gravou log de auditoria');
  }
  console.log(`   ✅ Log de auditoria de desbloqueio verificado com sucesso: Admin=${unblockAudit.admin_name}`);

  console.log('\n🎉 TODOS OS TESTES DO PAINEL DE ADMINISTRAÇÃO E GOVERNANÇA PASSARAM COM SUCESSO!\n');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NA SUÍTE DE TESTES:', err);
  process.exit(1);
});
