/**
 * Serviço de Autenticação para o Endpoint /api/auth
 */
import { generateSalt, hashPassword, verifyPassword, signJWT, createAuthCookie, createClearCookie, randomUUID } from './cryptoService.js';
import { dbQueries } from '../db/queries.js';
import { LIMITS } from '../config/limits.js';
import { checkRateLimit } from '../middleware/rateLimiter.js';
import { applySecurityHeaders } from '../config/securityHeaders.js';

export async function handleAuthRequest(request, env, clientIp) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Content-Type': 'application/json' });
  applySecurityHeaders(headers, origin, env);

  // 1. Rate Limiting para Autenticação (Proteção de Força Bruta)
  const rateLimit = checkRateLimit(clientIp, LIMITS.AUTH_RATE_LIMIT_PER_MINUTE, 'auth');
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: 'Muitas tentativas de autenticação. Tente novamente em um minuto.'
    }), { status: 429, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ sucesso: false, erro: 'Corpo JSON inválido' }), { status: 400, headers });
  }

  const { action, data = {} } = body;
  const db = env.DB;
  const jwtSecret = env?.JWT_SECRET || 'arcana-super-secret-key-development-local-2026-vtt';

  // ----------------------------------------------------
  // AÇÃO: CADASTRO DE NOVO USUÁRIO
  // ----------------------------------------------------
  if (action === 'register') {
    const { email, password, displayName } = data;

    if (!email || !password || !displayName) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Preencha email, senha e nome de exibição' }), { status: 400, headers });
    }

    if (password.length < LIMITS.MIN_PASSWORD_LENGTH || password.length > LIMITS.MAX_PASSWORD_LENGTH) {
      return new Response(JSON.stringify({ sucesso: false, erro: `A senha deve ter entre ${LIMITS.MIN_PASSWORD_LENGTH} e ${LIMITS.MAX_PASSWORD_LENGTH} caracteres` }), { status: 400, headers });
    }

    const existing = await dbQueries.getUserByEmail(db, email);
    if (existing) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Este e-mail já está cadastrado na taverna' }), { status: 409, headers });
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const userId = `usr_${randomUUID().replace(/-/g, '').substring(0, 12)}`;

    await dbQueries.createUser(db, {
      id: userId,
      email,
      passwordHash,
      salt,
      displayName,
      role: 'Jogador'
    });

    // Emissão do Token JWT
    const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
    const token = await signJWT({ sub: userId, email, role: 'Jogador', displayName, exp }, jwtSecret);

    headers.set('Set-Cookie', createAuthCookie(token, LIMITS.JWT_EXPIRATION_SECONDS));
    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: 'Aventureiro cadastrado com sucesso!',
      usuario: { id: userId, email, displayName, role: 'Jogador' }
    }), { status: 201, headers });
  }

  // ----------------------------------------------------
  // AÇÃO: LOGIN NA TAVERNA
  // ----------------------------------------------------
  if (action === 'login') {
    const { email, password } = data;

    if (!email || !password) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Informe e-mail e senha' }), { status: 400, headers });
    }

    const user = await dbQueries.getUserByEmail(db, email);
    if (!user) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Credenciais inválidas' }), { status: 401, headers });
    }

    const isMatch = await verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Credenciais inválidas' }), { status: 401, headers });
    }

    // Emissão do Token JWT
    const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
    const token = await signJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      exp
    }, jwtSecret);

    headers.set('Set-Cookie', createAuthCookie(token, LIMITS.JWT_EXPIRATION_SECONDS));
    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: 'Login realizado com sucesso!',
      usuario: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    }), { status: 200, headers });
  }

  // ----------------------------------------------------
  // AÇÃO: LOGOUT DA TAVERNA
  // ----------------------------------------------------
  if (action === 'logout') {
    headers.set('Set-Cookie', createClearCookie());
    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: 'Sessão encerrada com sucesso'
    }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ sucesso: false, erro: `Ação '${action}' desconhecida para /api/auth` }), { status: 400, headers });
}
