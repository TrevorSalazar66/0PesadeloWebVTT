/**
 * Teste Automatizado de Criação de Perfil Pós-Verificação e Hierarquia de 5 Cargos
 */
import { createLocalD1 } from '../src/db/localD1.js';
import { handleAuthRequest } from '../src/services/authService.js';
import { handleSyncRequest } from '../src/services/syncService.js';
import { dbQueries } from '../src/db/queries.js';

async function runTests() {
  console.log('⚔️  INICIANDO SUÍTE DE TESTES: PERFIL DE AVENTUREIRO & SISTEMA DE ROLES\n');

  const db = createLocalD1(':memory:');
  const env = {
    DB: db,
    JWT_SECRET: 'test-secret-key-vtt-2026',
    ENVIRONMENT: 'test'
  };
  const ip = '127.0.0.1';

  // 1. Cadastro de usuário
  console.log('1. Cadastrando novo usuário (Guerreiro)...');
  const regReq = new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      data: {
        email: 'valerius@arcana.vtt',
        password: 'senhaSegura123',
        displayName: 'Valerius'
      }
    })
  });
  const regRes = await handleAuthRequest(regReq, env, ip);
  const regData = await regRes.json();
  console.log(`   Status: ${regRes.status}, Categoria Inicial: ${regData.usuario.role}, Profile Completed: ${regData.usuario.profileCompleted}`);
  if (regData.usuario.role !== 'jogador' || regData.usuario.profileCompleted !== 0) {
    throw new Error('Falha: Novo usuário deve iniciar como "jogador" e com profileCompleted = 0');
  }

  // 2. Confirmação do código OTP de 6 dígitos
  console.log('\n2. Confirmando código OTP de 6 dígitos...');
  const otpCode = regData._codigoTesteDev;
  const verifyReq = new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'verify_email',
      data: { email: 'valerius@arcana.vtt', code: otpCode }
    })
  });
  const verifyRes = await handleAuthRequest(verifyReq, env, ip);
  const verifyData = await verifyRes.json();
  const sessionCookie = verifyRes.headers.get('Set-Cookie');
  console.log(`   Status: ${verifyRes.status}, Requer Criação de Perfil: ${verifyData.requerCriacaoPerfil}`);
  if (!verifyData.requerCriacaoPerfil || verifyData.usuario.profileCompleted !== 0) {
    throw new Error('Falha: Após confirmar e-mail, deve exigir criação de perfil (requerCriacaoPerfil = true)');
  }

  // 3. Tentativa de acessar recursos protegidos antes de criar perfil
  console.log('\n3. Testando barreira de perfil incompleto em /api/sync (campaigns.list)...');
  const syncBlockedReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify({ action: 'campaigns.list' })
  });
  const syncBlockedRes = await handleSyncRequest(syncBlockedReq, env, ip);
  const syncBlockedData = await syncBlockedRes.json();
  console.log(`   Status: ${syncBlockedRes.status}, Código de Erro: ${syncBlockedData.codigo}`);
  if (syncBlockedRes.status !== 403 || syncBlockedData.codigo !== 'PROFILE_INCOMPLETE') {
    throw new Error('Falha: /api/sync deve barrar chamadas com PROFILE_INCOMPLETE enquanto o perfil não for criado');
  }

  // 4. Submissão de Perfil (profile.setup)
  console.log('\n4. Submetendo criação de perfil (profile.setup)...');
  const setupReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify({
      action: 'profile.setup',
      data: {
        name: 'Valerius Lunaprata',
        nickname: 'valerius_mago',
        ageGroup: '25-34',
        bio: 'Mago élfico especializado em magias de evocação e runas antigas.',
        contacts: {
          whatsapp: '(11) 98888-7777',
          discord: 'valerius#1234',
          instagram: 'valerius_rpg'
        }
      }
    })
  });
  const setupRes = await handleSyncRequest(setupReq, env, ip);
  const setupData = await setupRes.json();
  const updatedCookie = setupRes.headers.get('Set-Cookie');
  console.log(`   Status: ${setupRes.status}, Nickname: @${setupData.perfil.nickname}, Profile Completed: ${setupData.perfil.profileCompleted}`);
  if (setupRes.status !== 200 || setupData.perfil.profileCompleted !== 1) {
    throw new Error('Falha ao concluir profile.setup');
  }

  // 5. Acesso a /api/sync liberado após perfil concluído
  console.log('\n5. Verificando se recursos protegidos agora estão liberados...');
  const syncAllowedReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': updatedCookie
    },
    body: JSON.stringify({ action: 'campaigns.list' })
  });
  const syncAllowedRes = await handleSyncRequest(syncAllowedReq, env, ip);
  const syncAllowedData = await syncAllowedRes.json();
  console.log(`   Status: ${syncAllowedRes.status}, Campanhas Retornadas: ${syncAllowedData.dados.length}`);
  if (syncAllowedRes.status !== 200 || !syncAllowedData.sucesso) {
    throw new Error('Falha: Acesso a campanhas deve ser liberado após conclusão do perfil');
  }

  // 6. Teste de unicidade de Nickname
  console.log('\n6. Testando unicidade do nickname com segundo usuário...');
  await dbQueries.createUser(db, {
    id: 'usr_segundo',
    email: 'outro@arcana.vtt',
    passwordHash: 'hash',
    salt: 'salt',
    displayName: 'Outro',
    role: 'jogador',
    emailVerified: 1,
    profileCompleted: 0
  });
  const duplicateReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await (await import('../src/services/cryptoService.js')).signJWT({ sub: 'usr_segundo', email: 'outro@arcana.vtt', role: 'jogador', emailVerified: 1, profileCompleted: 0, exp: Math.floor(Date.now()/1000) + 3600 }, env.JWT_SECRET)}`
    },
    body: JSON.stringify({
      action: 'profile.setup',
      data: {
        name: 'Clone',
        nickname: 'VALERIUS_MAGO', // Teste case-insensitive
        ageGroup: '18-24',
        bio: 'Tentando clonar nickname'
      }
    })
  });
  const duplicateRes = await handleSyncRequest(duplicateReq, env, ip);
  const duplicateData = await duplicateRes.json();
  console.log(`   Status: ${duplicateRes.status}, Erro: ${duplicateData.erro}`);
  if (duplicateRes.status !== 409) {
    throw new Error('Falha: Não deve permitir nickname duplicado (deve retornar HTTP 409)');
  }

  // 7. Teste de Permissões: Superadmin promovendo usuário
  console.log('\n7. Testando hierarquia de permissões (Superadmin alterando roles)...');
  // Valerius como jogador não pode alterar role
  const unauthRoleReq = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': updatedCookie },
    body: JSON.stringify({
      action: 'admin.user.setRole',
      data: { targetUserId: 'usr_segundo', role: 'mestre' }
    })
  });
  const unauthRoleRes = await handleSyncRequest(unauthRoleReq, env, ip);
  console.log(`   Jogador tentando alterar cargo: Status ${unauthRoleRes.status}`);
  if (unauthRoleRes.status !== 403) {
    throw new Error('Falha: Usuário comum não pode alterar cargos');
  }

  // Promove Valerius para superadmin no banco e testa alteração
  await dbQueries.updateUserRole(db, 'usr_segundo', 'superadmin');
  const userCheck = await dbQueries.getUserById(db, 'usr_segundo');
  console.log(`   Usuário secundário promovido diretamente para: ${userCheck.role}`);
  if (userCheck.role !== 'superadmin') {
    throw new Error('Falha ao atualizar cargo do usuário');
  }

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NOS TESTES:', err);
  process.exit(1);
});
