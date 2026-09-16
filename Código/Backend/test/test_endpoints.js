/**
 * SUITE COMPLETA DE TESTES: FUNCIONAMENTO, SEGURANÇA AVANÇADA E SOBRECARGA (STRESS TEST)
 * Executa as 3 etapas solicitadas pelo autor com medições precisas.
 */
import worker from '../src/index.js';
import { createLocalD1 } from '../src/db/localD1.js';
import { signJWT } from '../src/services/cryptoService.js';

let testesPassados = 0;
let testesFalhos = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASSOU] ${message}`);
    testesPassados++;
  } else {
    console.error(`  ❌ [FALHOU] ${message}`);
    testesFalhos++;
  }
}

async function runAllTests() {
  console.log('\n================================================================');
  console.log('🛡️  BATERIA COMPLETA DE TESTES DE INTEGRAÇÃO — ARCANA VTT');
  console.log('    Etapa 1: Funcionamento Básico dos Endpoints');
  console.log('    Etapa 2: Limites de Segurança (SQLi, IDOR, Forjamento de JWT)');
  console.log('    Etapa 3: Teste de Sobrecarga e Negação de Serviço (Rate Limiting / DoS)');
  console.log('================================================================\n');

  const db = createLocalD1(':memory:');
  const JWT_SECRET = 'arcana-super-secret-key-development-local-2026-vtt';
  const env = {
    ENVIRONMENT: 'development',
    ALLOWED_ORIGINS: 'http://localhost:5500,http://127.0.0.1:5500,https://arcana.pages.dev',
    JWT_SECRET,
    DB: db
  };

  const VALID_ORIGIN = 'http://localhost:5500';
  const FAKE_ORIGIN = 'http://site-hacker-invasor.com';

  // ============================================================================
  // ETAPA 1: TESTES DE FUNCIONAMENTO BÁSICO
  // ============================================================================
  console.log('📋 ─── ETAPA 1: TESTES DE FUNCIONAMENTO BÁSICO ───────────────────');

  // 1.1 Health Check
  const resHealth = await worker.fetch(new Request('http://localhost:8787/health', {
    method: 'GET',
    headers: { 'Origin': VALID_ORIGIN }
  }), env, {});
  const jsonHealth = await resHealth.json();
  assert(resHealth.status === 200 && jsonHealth.status === 'online', 'Health check ativo respondendo online');

  // 1.2 Cadastro de Usuário
  const resReg = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      data: { email: 'jogador1@arcana.vtt', password: 'senhaForte123@', displayName: 'Geralt de Rivia' }
    })
  }), env, {});
  assert(resReg.status === 201, 'Cadastro de novo usuário (/api/auth register) retornou HTTP 201');

  // 1.3 Login e Obtenção de Cookie
  const resLogin = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      data: { email: 'jogador1@arcana.vtt', password: 'senhaForte123@' }
    })
  }), env, {});
  const cookieJogador1 = resLogin.headers.get('Set-Cookie')?.split(';')[0];
  const jsonLogin = await resLogin.json();
  assert(resLogin.status === 200, 'Login (/api/auth login) retornou HTTP 200 OK');
  assert(jsonLogin.usuario.displayName === 'Geralt de Rivia', 'Nome de exibição retornado corretamente');
  assert(cookieJogador1 && cookieJogador1.includes('arcana_session'), 'Cookie seguro emitido na sessão');

  // 1.4 Criar Campanha pelo Gateway /api/sync
  const resCreateCamp = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador1 },
    body: JSON.stringify({
      action: 'campaigns.create',
      data: { name: 'A Busca pelo Cálice', systemId: 'tormenta20', description: 'Campanha de testes' }
    })
  }), env, {});
  const jsonCreateCamp = await resCreateCamp.json();
  assert(resCreateCamp.status === 201, 'Criação de campanha (/api/sync campaigns.create) retornou HTTP 201');
  const campId = jsonCreateCamp.dados.id;

  // 1.5 Listar Campanhas
  const resListCamp = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador1 },
    body: JSON.stringify({ action: 'campaigns.list' })
  }), env, {});
  const jsonListCamp = await resListCamp.json();
  assert(jsonListCamp.dados.length === 1 && jsonListCamp.dados[0].id === campId, 'Listagem de campanhas (/api/sync campaigns.list) recuperou registro');

  // 1.6 Criar Personagem
  const resCreateChar = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador1 },
    body: JSON.stringify({
      action: 'characters.create',
      data: { name: 'Jaskier o Bardo', sheetData: { carisma: 18, pv: 24 } }
    })
  }), env, {});
  assert(resCreateChar.status === 201, 'Criação de personagem (/api/sync characters.create) retornou HTTP 201');


  // ============================================================================
  // ETAPA 2: TESTES DOS LIMITES DE SEGURANÇA
  // ============================================================================
  console.log('\n🔒 ─── ETAPA 2: TESTES DE LIMITES DE SEGURANÇA ───────────────────');

  // 2.1 Bloqueio de Origem Não Autorizada (CORS Bypass Attempt)
  const resBadOrigin = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': FAKE_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', data: { email: 'a@a.com', password: '123' } })
  }), env, {});
  assert(resBadOrigin.status === 403, 'Bloqueio de CORS: Rejeitou origem não autorizada com HTTP 403 Forbidden');

  // 2.2 Tentativa de Injeção de SQL (SQL Injection - Bypass de Login)
  const resSqlInvalido = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      data: { email: "admin@arcana.vtt' OR '1'='1", password: "' OR 1=1 --" }
    })
  }), env, {});
  assert(resSqlInvalido.status === 401, 'Imunidade a SQL Injection: Prepared Statements neutralizaram string maliciosa');

  // 2.3 Tentativa de Injeção de SQL destrutivo em campos de campanha
  const resSqlDestrutivo = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador1 },
    body: JSON.stringify({
      action: 'campaigns.create',
      data: { name: "Campanha'; DROP TABLE users; --" }
    })
  }), env, {});
  assert(resSqlDestrutivo.status === 201, 'Imunidade a SQL DDL: SQL escapado com bind() — banco não sofreu DROP TABLE');
  // Verifica se a tabela users ainda existe e está intacta
  const checkTable = await db.prepare('SELECT count(*) as total FROM users').first();
  assert(checkTable.total > 0, 'Integridade confirmada: Tabela users continua íntegra e acessível');

  // 2.4 Tentativa de Falsificação de Assinatura JWT (Token Forjado)
  const tokenFalso = await signJWT({ sub: 'usr_hacker', email: 'hacker@dark.net', role: 'Admin', exp: Math.floor(Date.now() / 1000) + 3600 }, 'chave-totalmente-errada');
  const resTokenFalso = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: {
      'Origin': VALID_ORIGIN,
      'Content-Type': 'application/json',
      'Cookie': `arcana_session=${tokenFalso}`
    },
    body: JSON.stringify({ action: 'campaigns.list' })
  }), env, {});
  assert(resTokenFalso.status === 401, 'Validação Criptográfica: Rejeitou token forjado com chave falsa (HTTP 401)');

  // 2.5 Tentativa de Token Expirado
  const tokenExpirado = await signJWT({ sub: 'usr_expirado', exp: Math.floor(Date.now() / 1000) - 300 }, JWT_SECRET);
  const resTokenExpirado = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: {
      'Origin': VALID_ORIGIN,
      'Content-Type': 'application/json',
      'Cookie': `arcana_session=${tokenExpirado}`
    },
    body: JSON.stringify({ action: 'campaigns.list' })
  }), env, {});
  assert(resTokenExpirado.status === 401, 'Validação Temporal: Rejeitou token expirado com HTTP 401');

  // 2.6 Teste de IDOR (Isolamento RLS entre Jogadores)
  // Criar Jogador 2
  const resReg2 = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      data: { email: 'jogador2@arcana.vtt', password: 'senhaForte123@', displayName: 'Yennefer de Vengerberg' }
    })
  }), env, {});
  const cookieJogador2 = resReg2.headers.get('Set-Cookie')?.split(';')[0];

  // Jogador 2 tenta listar campanhas (não deve ver a campanha criada pelo Jogador 1)
  const resListCamp2 = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador2 },
    body: JSON.stringify({ action: 'campaigns.list' })
  }), env, {});
  const jsonListCamp2 = await resListCamp2.json();
  assert(jsonListCamp2.dados.length === 0, 'Isolamento RLS: Jogador 2 não consegue enxergar campanhas privadas do Jogador 1');


  // ============================================================================
  // ETAPA 3: TESTES DE SOBRECARGA E ESTRESSE (RATE LIMITING & DoS)
  // ============================================================================
  console.log('\n⚡ ─── ETAPA 3: TESTES DE SOBRECARGA E RATE LIMITING (DoS) ────────');

  // 3.1 Exaustão de Tamanho de Payload (> 64KB)
  const payloadGigante = JSON.stringify({ action: 'test', data: 'X'.repeat(70000) });
  const resExaustao = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: {
      'Origin': VALID_ORIGIN,
      'Content-Type': 'application/json',
      'Content-Length': String(payloadGigante.length)
    },
    body: payloadGigante
  }), env, {});
  assert(resExaustao.status === 413, 'Proteção contra Payload Gigante: Bloqueou com HTTP 413 Payload Too Large');

  // 3.2 Rajada de Requisições de Força Bruta em /api/auth (Burst Stress)
  console.log('  ⚡ Disparando rajada de 20 requisições simultâneas em /api/auth para testar Rate Limiting...');
  const IP_ATACANTE = '198.51.100.42';
  let bloqueiosAuth = 0;
  let aceitosAuth = 0;

  for (let i = 0; i < 20; i++) {
    const reqBurst = new Request('http://localhost:8787/api/auth', {
      method: 'POST',
      headers: {
        'Origin': VALID_ORIGIN,
        'Content-Type': 'application/json',
        'CF-Connecting-IP': IP_ATACANTE
      },
      body: JSON.stringify({
        action: 'login',
        data: { email: 'alvo@arcana.vtt', password: `tentativa_${i}` }
      })
    });
    const res = await worker.fetch(reqBurst, env, {});
    if (res.status === 429) {
      bloqueiosAuth++;
    } else {
      aceitosAuth++;
    }
  }
  assert(bloqueiosAuth > 0, `Rate Limiting Ativo em /api/auth: ${bloqueiosAuth} requisições barradas com HTTP 429 Too Many Requests`);
  assert(aceitosAuth <= 10, `Teto de segurança respeitado: Máximo de ${aceitosAuth} tentativas permitidas dentro da janela de 1 minuto`);

  // 3.3 Rajada de Carga em /api/sync
  console.log('  ⚡ Disparando teste de carga com 140 requisições consecutivas no Gateway /api/sync...');
  const IP_SYNC_BURST = '198.51.100.99';
  let bloqueiosSync = 0;
  let aceitosSync = 0;

  for (let i = 0; i < 140; i++) {
    const reqSync = new Request('http://localhost:8787/api/sync', {
      method: 'POST',
      headers: {
        'Origin': VALID_ORIGIN,
        'Content-Type': 'application/json',
        'Cookie': cookieJogador1,
        'CF-Connecting-IP': IP_SYNC_BURST
      },
      body: JSON.stringify({ action: 'profile.get' })
    });
    const res = await worker.fetch(reqSync, env, {});
    if (res.status === 429) {
      bloqueiosSync++;
    } else if (res.status === 200) {
      aceitosSync++;
    }
  }
  assert(bloqueiosSync > 0, `Throttling Ativo em /api/sync: ${bloqueiosSync} requisições excedentes bloqueadas com HTTP 429`);
  assert(aceitosSync <= 120, `Teto de vazão respeitado: ${aceitosSync} requisições atendidas com sucesso antes da restrição`);

  // ============================================================================
  // ETAPA 4: GOOGLE OAUTH, VERIFICAÇÃO OTP, TRAVA DE DISPOSITIVO E ADMIN
  // ============================================================================
  console.log('\n🔑 ─── ETAPA 4: GOOGLE OAUTH, VERIFICAÇÃO OTP, TRAVA SYBIL E ADMIN ─');

  // 4.1 Cadastro com OTP de 6 dígitos
  const resOtpReg = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
    body: JSON.stringify({
      action: 'register',
      data: { email: 'jogador_otp@arcana.vtt', password: 'senhaSegura123!', displayName: 'Aventureiro OTP' }
    })
  }), env, {});
  const jsonOtpReg = await resOtpReg.json();
  assert(resOtpReg.status === 201 && jsonOtpReg.requerVerificacao === true, 'Cadastro com e-mail gera solicitação de verificação OTP (HTTP 201)');
  assert(jsonOtpReg.usuario.emailVerified === 0, 'Usuário registrado com status de e-mail pendente (emailVerified === 0)');
  const devCode = jsonOtpReg._codigoTesteDev;
  assert(typeof devCode === 'string' && devCode.length === 6, 'Código OTP gerado possui exatamente 6 dígitos numéricos');

  // 4.2 Rejeição de Código OTP Incorreto
  const resWrongOtp = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
    body: JSON.stringify({
      action: 'verify_email',
      data: { email: 'jogador_otp@arcana.vtt', code: '000000' }
    })
  }), env, {});
  assert(resWrongOtp.status === 400, 'Rejeição de OTP incorreto com HTTP 400');

  // 4.3 Sucesso na Validação do Código OTP Correto
  const resCorrectOtp = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
    body: JSON.stringify({
      action: 'verify_email',
      data: { email: 'jogador_otp@arcana.vtt', code: devCode }
    })
  }), env, {});
  const jsonCorrectOtp = await resCorrectOtp.json();
  assert(resCorrectOtp.status === 200 && jsonCorrectOtp.sucesso === true, 'Validação de código OTP correto respondendo HTTP 200');
  assert(jsonCorrectOtp.usuario.emailVerified === 1, 'Conta ativada com sucesso (emailVerified === 1)');

  // 4.4 Google OAuth: Redirecionamento para o Provedor
  const resGoogleRedirect = await worker.fetch(new Request('http://localhost:8787/api/auth/google/redirect', {
    method: 'GET',
    headers: { 'Origin': VALID_ORIGIN }
  }), env, {});
  assert(resGoogleRedirect.status === 302, 'Google OAuth: Endpoint de redirect responde HTTP 302');
  const redirectLocation = resGoogleRedirect.headers.get('Location');
  assert(redirectLocation && redirectLocation.includes('accounts.google.com'), 'Redirecionamento aponta para os servidores oficiais do Google Accounts');

  // 4.5 Google OAuth: Callback e Criação de Conta Pré-verificada
  const resGoogleCallback = await worker.fetch(new Request('http://localhost:8787/api/auth/google/callback?code=mock_google_hero_777&mock_email=heroi.google@gmail.com', {
    method: 'GET',
    headers: { 'Origin': VALID_ORIGIN }
  }), env, {});
  assert(resGoogleCallback.status === 302, 'Google OAuth Callback responde HTTP 302 redirecionando para frontend');
  const googleCookie = resGoogleCallback.headers.get('Set-Cookie');
  assert(googleCookie && googleCookie.includes('arcana_session'), 'Google OAuth: Emissão de cookie seguro HttpOnly na sessão');
  const googleUserInDb = await db.prepare('SELECT * FROM users WHERE email = ?').bind('heroi.google@gmail.com').first();
  assert(googleUserInDb && googleUserInDb.email_verified === 1 && googleUserInDb.auth_provider === 'google', 'Usuário Google persistido no D1 com email_verified = 1');

  // 4.6 Google OAuth: Unificação Automática de Contas com mesmo E-mail
  // Cadastra usuário local primeiro
  await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.2' },
    body: JSON.stringify({
      action: 'register',
      data: { email: 'unificado@arcana.vtt', password: 'senhaUnificada123!', displayName: 'Gimli Anão' }
    })
  }), env, {});
  // Entra com Google usando o mesmo e-mail
  await worker.fetch(new Request('http://localhost:8787/api/auth/google/callback?code=mock_google_gimli_888&mock_email=unificado@arcana.vtt', {
    method: 'GET',
    headers: { 'Origin': VALID_ORIGIN }
  }), env, {});
  const userUnificado = await db.prepare('SELECT * FROM users WHERE email = ?').bind('unificado@arcana.vtt').first();
  const totalContasEmail = await db.prepare('SELECT count(*) as total FROM users WHERE email = ?').bind('unificado@arcana.vtt').first();
  assert(totalContasEmail.total === 1 && userUnificado.google_id === 'g_mock_google_gimli_888', 'Unificação de Conta: Mesclou Google ID na conta existente sem duplicar registros');

  // 4.7 Trava Permanente de Dispositivo Anti-Sybil (> 3 contas em 24h)
  console.log('  🛡️ Testando trava anti-Sybil de dispositivo por Device Fingerprint...');
  const FINGERPRINT_ATACANTE = 'dev_sybil_test_fingerprint_abc123';
  const IP_ATACANTE_SYBIL = '198.51.100.77';

  // Criação de 3 contas pelo mesmo dispositivo (limite tolerado)
  for (let c = 1; c <= 3; c++) {
    await worker.fetch(new Request('http://localhost:8787/api/auth', {
      method: 'POST',
      headers: {
        'Origin': VALID_ORIGIN,
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': FINGERPRINT_ATACANTE,
        'CF-Connecting-IP': IP_ATACANTE_SYBIL
      },
      body: JSON.stringify({
        action: 'register',
        data: { email: `sybil_bot_${c}@ataque.vtt`, password: 'senhaSybil123!', displayName: `Bot ${c}` }
      })
    }), env, {});
  }

  // 4ª tentativa de criação de conta: Deve disparar a trava permanente e retornar HTTP 403
  const resQuartaConta = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: {
      'Origin': VALID_ORIGIN,
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': FINGERPRINT_ATACANTE,
      'CF-Connecting-IP': IP_ATACANTE_SYBIL
    },
    body: JSON.stringify({
      action: 'register',
      data: { email: 'sybil_bot_4@ataque.vtt', password: 'senhaSybil123!', displayName: 'Bot 4' }
    })
  }), env, {});
  const jsonQuartaConta = await resQuartaConta.json();
  assert(resQuartaConta.status === 403 && jsonQuartaConta.bloqueado === true, 'Trava Permanente Ativada: 4ª criação de conta no mesmo dispositivo bloqueada com HTTP 403');

  // Tentativa subsequente de acesso/login pelo mesmo dispositivo travado
  const resDispositivoTravado = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: {
      'Origin': VALID_ORIGIN,
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': FINGERPRINT_ATACANTE,
      'CF-Connecting-IP': IP_ATACANTE_SYBIL
    },
    body: JSON.stringify({
      action: 'login',
      data: { email: 'qualquer@arcana.vtt', password: 'senha' }
    })
  }), env, {});
  assert(resDispositivoTravado.status === 403, 'Acesso Negado: Dispositivo permanentemente bloqueado rejeitado imediatamente em qualquer ação');

  // 4.8 Painel de Administração e Liberação de Dispositivo Bloqueado
  // Jogador comum tenta listar dispositivos bloqueados (deve receber 403)
  const resListBloqueadosJogador = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador1 },
    body: JSON.stringify({ action: 'admin.devices.list' })
  }), env, {});
  assert(resListBloqueadosJogador.status === 403, 'Proteção RBAC: Usuário comum não pode acessar lista de dispositivos bloqueados (HTTP 403)');

  // Promove jogador1 para Admin no D1 para testar operações de governança
  await db.prepare("UPDATE users SET role = 'Admin' WHERE email = 'jogador1@arcana.vtt'").run();
  const tokenAdmin = await signJWT({ sub: 'usr_admin_test', email: 'jogador1@arcana.vtt', role: 'Admin', exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
  const cookieAdmin = `arcana_session=${tokenAdmin}`;

  // Admin lista dispositivos bloqueados
  const resListBloqueadosAdmin = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieAdmin },
    body: JSON.stringify({ action: 'admin.devices.list' })
  }), env, {});
  const jsonListBloqueados = await resListBloqueadosAdmin.json();
  assert(resListBloqueadosAdmin.status === 200, 'Painel Admin: Listagem de dispositivos bloqueados retornou HTTP 200');
  const dispositivoEncontrado = jsonListBloqueados.dados.find(d => d.device_hash === FINGERPRINT_ATACANTE);
  assert(dispositivoEncontrado && dispositivoEncontrado.status === 'BLOCKED_PERMANENT', 'Dispositivo atacante consta na lista com status BLOCKED_PERMANENT');

  // Admin libera dispositivo bloqueado (1-clique)
  const resDesbloqueio = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieAdmin },
    body: JSON.stringify({
      action: 'admin.devices.unblock',
      data: { deviceHash: FINGERPRINT_ATACANTE }
    })
  }), env, {});
  const jsonDesbloqueio = await resDesbloqueio.json();
  assert(resDesbloqueio.status === 200 && jsonDesbloqueio.sucesso === true, 'Painel Admin: Desbloqueio de dispositivo em 1-clique concluído com sucesso');

  // Dispositivo liberado agora consegue autenticar normalmente
  const resDispositivoLiberado = await worker.fetch(new Request('http://localhost:8787/api/auth', {
    method: 'POST',
    headers: {
      'Origin': VALID_ORIGIN,
      'Content-Type': 'application/json',
      'X-Device-Fingerprint': FINGERPRINT_ATACANTE,
      'CF-Connecting-IP': IP_ATACANTE_SYBIL
    },
    body: JSON.stringify({
      action: 'login',
      data: { email: 'sybil_bot_1@ataque.vtt', password: 'senhaSybil123!' }
    })
  }), env, {});
  assert(resDispositivoLiberado.status === 200, 'Restauração de Acesso: Dispositivo liberado pelo admin volta a operar normalmente');

  // ============================================================================
  // RELATÓRIO E CONCLUSÃO
  // ============================================================================
  console.log('\n================================================================');
  console.log(`📊 RESUMO DA BATERIA DE TESTES:`);
  console.log(`   Total de Testes Realizados: ${testesPassados + testesFalhos}`);
  console.log(`   ✅ Sucessos: ${testesPassados}`);
  console.log(`   ❌ Falhas:   ${testesFalhos}`);
  console.log('================================================================\n');

  if (testesFalhos > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Falha crítica na suíte de testes:', err);
  process.exit(1);
});
