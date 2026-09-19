/**
 * Bateria de Testes: Sistema de Criação e Listagem de Campanhas (Fase 07)
 */
import assert from 'node:assert';
import worker from '../src/index.js';
import { createLocalD1 } from '../src/db/localD1.js';
import { signJWT } from '../src/services/cryptoService.js';

const JWT_SECRET = 'arcana-super-secret-key-development-local-2026-vtt';
const VALID_ORIGIN = 'http://localhost:5500';

async function runCampaignTests() {
  console.log('⚔️  INICIANDO BATERIA DE TESTES DE CAMPANHAS (FASE 07)\n');

  const db = createLocalD1(':memory:');
  const env = {
    ENVIRONMENT: 'development',
    ALLOWED_ORIGINS: VALID_ORIGIN,
    JWT_SECRET,
    DB: db
  };

  // 1. Cria dois usuários: um Jogador e um Mestre
  await db.prepare(`
    INSERT INTO users (id, email, display_name, role, email_verified, profile_completed)
    VALUES 
      ('usr_jogador_teste', 'jogador@arcana.vtt', 'Aventureiro Simples', 'jogador', 1, 1),
      ('usr_mestre_teste', 'mestre@arcana.vtt', 'Grande Mestre', 'mestre', 1, 1);
  `).run();

  const tokenJogador = await signJWT({
    sub: 'usr_jogador_teste',
    email: 'jogador@arcana.vtt',
    role: 'jogador',
    emailVerified: 1,
    profileCompleted: 1,
    exp: Math.floor(Date.now() / 1000) + 3600
  }, JWT_SECRET);
  const cookieJogador = `arcana_session=${tokenJogador}`;

  const tokenMestre = await signJWT({
    sub: 'usr_mestre_teste',
    email: 'mestre@arcana.vtt',
    role: 'mestre',
    emailVerified: 1,
    profileCompleted: 1,
    exp: Math.floor(Date.now() / 1000) + 3600
  }, JWT_SECRET);
  const cookieMestre = `arcana_session=${tokenMestre}`;

  // ----------------------------------------------------
  // TESTE 1: JOGADOR TENTA CRIAR CAMPANHA (DEVE SER BARRADO COM 403)
  // ----------------------------------------------------
  console.log('1. Testando restrição de criação por cargo (Jogador comum)...');
  const resCriarJogador = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador },
    body: JSON.stringify({
      action: 'campaigns.create',
      data: { name: 'Mesa Não Autorizada', maxPlayers: 5 }
    })
  }), env, {});

  assert.strictEqual(resCriarJogador.status, 403, 'Jogador comum não pode criar campanhas (HTTP 403 esperado)');
  const jsonCriarJogador = await resCriarJogador.json();
  console.log(`   Status: ${resCriarJogador.status}, Mensagem: "${jsonCriarJogador.erro}"`);

  // ----------------------------------------------------
  // TESTE 2: VALIDAÇÃO DO LIMITE MÁXIMO GLOBAL DE 12 JOGADORES
  // ----------------------------------------------------
  console.log('\n2. Testando teto global de 12 jogadores...');
  const resTetoExcedido = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieMestre },
    body: JSON.stringify({
      action: 'campaigns.create',
      data: { name: 'Mesa Hiper Lotada', maxPlayers: 15 }
    })
  }), env, {});

  assert.strictEqual(resTetoExcedido.status, 400, 'Tentativa de criar com mais de 12 jogadores deve retornar HTTP 400');
  const jsonTeto = await resTetoExcedido.json();
  console.log(`   Status: ${resTetoExcedido.status}, Erro: "${jsonTeto.erro}"`);

  // ----------------------------------------------------
  // TESTE 3: MESTRE CRIA CAMPANHA VÁLIDA
  // ----------------------------------------------------
  console.log('\n3. Mestre forjando campanha com todos os metadados e pools...');
  const resCriarMestre = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieMestre },
    body: JSON.stringify({
      action: 'campaigns.create',
      data: {
        name: 'O Labirinto da Lua Negra',
        systemId: 'dnd5e',
        themeId: 'dark-fantasy',
        loreDescription: 'Nas catacumbas do reino esquecido, antigas criaturas arcanas despertam.',
        imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150',
        bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800',
        maxPlayers: 6
      }
    })
  }), env, {});

  assert.strictEqual(resCriarMestre.status, 201, 'Criação de campanha deve retornar HTTP 201');
  const jsonCriarMestre = await resCriarMestre.json();
  assert(jsonCriarMestre.sucesso === true, 'Criação deve ser bem-sucedida');
  assert(Boolean(jsonCriarMestre.dados.simple_id), 'Campanha deve conter simple_id');
  assert(jsonCriarMestre.dados.simple_id.includes('-'), 'simple_id deve seguir formato PALAVRA-NUMERO');
  assert.strictEqual(jsonCriarMestre.dados.max_players, 6, 'max_players deve ser 6');
  console.log(`   Status: 201, ID Interno: ${jsonCriarMestre.dados.id}, ID Simples: ${jsonCriarMestre.dados.simple_id}`);

  const campaignId = jsonCriarMestre.dados.id;
  const simpleId = jsonCriarMestre.dados.simple_id;

  // ----------------------------------------------------
  // TESTE 4: LISTAGEM DE CAMPANHAS COM CONTAGEM DE VAGAS
  // ----------------------------------------------------
  console.log('\n4. Testando listagem de campanhas (/api/sync campaigns.list)...');
  const resList = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieMestre },
    body: JSON.stringify({ action: 'campaigns.list' })
  }), env, {});

  assert.strictEqual(resList.status, 200);
  const jsonList = await resList.json();
  assert(Array.isArray(jsonList.dados), 'dados deve ser um array');
  assert.strictEqual(jsonList.dados.length, 1, 'Deve retornar 1 campanha vinculada');
  const campRetornada = jsonList.dados[0];
  assert.strictEqual(campRetornada.current_players, 1, 'Criador deve constar automaticamente como 1 jogador ativo');
  assert.strictEqual(campRetornada.max_players, 6, 'Capacidade máxima deve ser 6');
  console.log(`   Campanha listada com sucesso! Vagas: ${campRetornada.current_players}/${campRetornada.max_players}`);

  // ----------------------------------------------------
  // TESTE 5: BUSCA DE CAMPANHA POR ID SIMPLES (campaigns.get)
  // ----------------------------------------------------
  console.log('\n5. Testando busca detalhada por Simple ID (/api/sync campaigns.get)...');
  const resGet = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador },
    body: JSON.stringify({
      action: 'campaigns.get',
      data: { simpleId }
    })
  }), env, {});

  assert.strictEqual(resGet.status, 200);
  const jsonGet = await resGet.json();
  assert.strictEqual(jsonGet.dados.id, campaignId);
  assert.strictEqual(jsonGet.dados.players.length, 1);
  assert.strictEqual(jsonGet.dados.players[0].role, 'Mestre');
  console.log(`   Detalhes recuperados! Mestre da mesa: ${jsonGet.dados.owner_name}`);

  // ----------------------------------------------------
  // TESTE 6: POOLS OFICIAIS DE SISTEMAS E TEMAS (campaigns.options)
  // ----------------------------------------------------
  console.log('\n6. Testando endpoint de opções de campanha (/api/sync campaigns.options)...');
  const resOptions = await worker.fetch(new Request('http://localhost:8787/api/sync', {
    method: 'POST',
    headers: { 'Origin': VALID_ORIGIN, 'Content-Type': 'application/json', 'Cookie': cookieJogador },
    body: JSON.stringify({ action: 'campaigns.options' })
  }), env, {});

  assert.strictEqual(resOptions.status, 200);
  const jsonOptions = await resOptions.json();
  assert(jsonOptions.dados.systems.some(s => s.id === 'alphad6'), 'Deve conter o sistema AlphaD6');
  assert(jsonOptions.dados.themes.length >= 1, 'Deve conter temas disponíveis');
  assert.strictEqual(jsonOptions.dados.limits.MAX_PLAYERS_GLOBAL, 12, 'Teto global deve ser 12');
  console.log(`   Sistemas disponíveis: ${jsonOptions.dados.systems.map(s => s.badge).join(', ')}`);

  console.log('\n🎉 TODOS OS TESTES DE CAMPANHA PASSARAM COM 100% DE SUCESSO!\n');
}

runCampaignTests().catch(err => {
  console.error('❌ Falha nos testes de campanhas:', err);
  process.exit(1);
});
