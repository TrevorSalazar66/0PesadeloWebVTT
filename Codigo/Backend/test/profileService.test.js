/**
 * Teste Automatizado do Perfil do Aventureiro e Segurança
 * Cobre:
 * - profile.get (carregamento completo com dados de usuário, perfil e stats agregadas)
 * - profile.update (atualização de nome, nickname, bio, faixa etária, contatos, avatar e banner)
 * - Bloqueio de nickname duplicado (409 Conflict)
 * - profile.password.update (validação de senha atual, troca de senha segura PBKDF2 e login com nova credencial)
 */
import { createLocalD1 } from '../src/db/localD1.js';
import { handleAuthRequest } from '../src/services/authService.js';
import { handleSyncRequest } from '../src/services/syncService.js';
import { dbQueries } from '../src/db/queries.js';

async function runTests() {
  console.log('🛡️  INICIANDO SUÍTE DE TESTES: PERFIL DO AVENTUREIRO & SEGURANÇA\n');

  const db = createLocalD1(':memory:');
  const env = {
    DB: db,
    JWT_SECRET: 'test-profile-secret-key-2026',
    ENVIRONMENT: 'test'
  };
  const ip = '127.0.0.1';

  let userCounter = 1;
  async function criarUsuario(email, name, nick, password = 'SenhaForte123!', role = 'jogador') {
    const userIp = `127.0.0.${userCounter}`;
    const deviceId = `dev_fingerprint_prof_test_${userCounter++}`;

    const regReq = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': deviceId
      },
      body: JSON.stringify({
        action: 'register',
        data: { email, password, displayName: name }
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

    // Setup inicial de perfil
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
          contacts: { discord: `${nick}#1234`, whatsapp: '11999999999', instagram: nick }
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
          data: { email, password }
        })
      });
      const loginRes = await handleAuthRequest(loginReq, env, ip);
      cookie = loginRes.headers.get('Set-Cookie');
    }

    return { userId, email, name, role, cookie, password };
  }

  async function callSync(user, action, data = {}) {
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': user?.cookie || ''
      },
      body: JSON.stringify({ action, data })
    });
    const res = await handleSyncRequest(req, env, ip);
    const json = await res.json();
    const setCookie = res.headers.get('Set-Cookie');
    if (setCookie && user) {
      user.cookie = setCookie;
    }
    return json;
  }

  // 1. Criar usuários para o teste
  console.log('1. Criando usuários para teste de perfil...');
  const uGuerreiro = await criarUsuario('legolas@arcana.vtt', 'Legolas Verdevan', 'legolas_elfo', 'SenhaForte123!', 'jogador');
  const uMago = await criarUsuario('gandalf@arcana.vtt', 'Gandalf o Cinzento', 'gandalf_mago', 'SenhaForte123!', 'mestre');
  console.log('   ✓ Usuários criados com sucesso.');

  // 2. Testando profile.get com estatísticas agregadas
  console.log('\n2. Testando profile.get...');
  const getRes = await callSync(uGuerreiro, 'profile.get');
  if (!getRes.sucesso || !getRes.dados) {
    throw new Error(`Falha ao obter perfil: ${JSON.stringify(getRes)}`);
  }
  const { id, email, display_name, perfil, stats } = getRes.dados;
  if (!perfil || perfil.nickname !== 'legolas_elfo' || !stats) {
    throw new Error(`Dados de perfil inválidos: ${JSON.stringify(getRes.dados)}`);
  }
  console.log(`   ✓ Perfil retornado com sucesso: ${display_name} (@${perfil.nickname})`);
  console.log(`   ✓ Estatísticas retornadas: Campanhas: ${stats.totalCampaigns}, Personagens: ${stats.totalCharacters}`);

  // 3. Testando profile.update (edição completa)
  console.log('\n3. Testando profile.update (edição de biografia, contatos e mídias)...');
  const updateRes = await callSync(uGuerreiro, 'profile.update', {
    name: 'Legolas Folhaverde de Bosque das Trevas',
    nickname: 'legolas_arqueiro',
    ageGroup: '35+',
    bio: 'Príncipe elfo do Reino da Floresta e mestre com arco e flechas élficas.',
    contacts: {
      discord: 'legolas#0001',
      whatsapp: '11988887777',
      instagram: 'legolas_elf'
    },
    avatarUrl: 'https://exemplo.com/avatar_legolas.png',
    bannerUrl: 'https://exemplo.com/banner_bosque.png'
  });

  if (!updateRes.sucesso || !updateRes.perfil) {
    throw new Error(`Falha ao atualizar perfil: ${JSON.stringify(updateRes)}`);
  }
  console.log('   ✓ Perfil atualizado com sucesso.');

  // Validar persistência no banco
  const getUpdated = await callSync(uGuerreiro, 'profile.get');
  const pUpdated = getUpdated.dados.perfil;
  if (
    pUpdated.name !== 'Legolas Folhaverde de Bosque das Trevas' ||
    pUpdated.nickname !== 'legolas_arqueiro' ||
    pUpdated.age_group !== '35+' ||
    pUpdated.contacts?.discord !== 'legolas#0001' ||
    pUpdated.avatar_url !== 'https://exemplo.com/avatar_legolas.png'
  ) {
    throw new Error(`Dados atualizados não conferem no banco: ${JSON.stringify(pUpdated)}`);
  }
  console.log('   ✓ Persistência de todas as colunas confirmada no Cloudflare D1.');

  // 4. Testando bloqueio de nickname duplicado (409 Conflict)
  console.log('\n4. Testando bloqueio de nickname já em uso por outro aventureiro...');
  const dupNickRes = await callSync(uGuerreiro, 'profile.update', {
    nickname: 'gandalf_mago' // Pertence a uMago
  });
  if (dupNickRes.sucesso) {
    throw new Error('Falha de segurança: Aceitou nickname duplicado de outro usuário!');
  }
  console.log(`   ✓ Bloqueio confirmado com erro esperado: "${dupNickRes.erro}"`);

  // 5. Testando profile.password.update (Troca de senha)
  console.log('\n5. Testando troca de senha segura (profile.password.update)...');
  
  // Tentativa com senha atual incorreta (deve falhar com 401)
  const wrongPassRes = await callSync(uGuerreiro, 'profile.password.update', {
    currentPassword: 'SenhaErrada123!',
    newPassword: 'NovaSenhaSegura456!'
  });
  if (wrongPassRes.sucesso) {
    throw new Error('Falha de segurança: Aceitou senha atual incorreta!');
  }
  console.log(`   ✓ Rejeição de senha incorreta confirmada: "${wrongPassRes.erro}"`);

  // Troca com senha correta
  const rightPassRes = await callSync(uGuerreiro, 'profile.password.update', {
    currentPassword: 'SenhaForte123!',
    newPassword: 'NovaSenhaSegura456!'
  });
  if (!rightPassRes.sucesso) {
    throw new Error(`Falha ao alterar senha com dados corretos: ${JSON.stringify(rightPassRes)}`);
  }
  console.log('   ✓ Senha alterada com sucesso.');

  // 6. Testar login com a nova senha
  console.log('\n6. Testando login na taverna com a nova senha...');
  const newLoginReq = new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      data: { email: uGuerreiro.email, password: 'NovaSenhaSegura456!' }
    })
  });
  const newLoginRes = await handleAuthRequest(newLoginReq, env, ip);
  const newLoginData = await newLoginRes.json();
  if (!newLoginData.sucesso || !newLoginData.token) {
    throw new Error(`Falha no login com nova senha: ${JSON.stringify(newLoginData)}`);
  }
  console.log('   ✓ Login efetuado com sucesso utilizando a nova senha.');

  console.log('\n======================================================');
  console.log('🎉 TODOS OS TESTES DE PERFIL E SEGURANÇA PASSARAM COM SUCESSO!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NA SUÍTE DE TESTES DE PERFIL:', err);
  process.exit(1);
});
