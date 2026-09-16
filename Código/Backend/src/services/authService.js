/**
 * Serviço de Autenticação para o Endpoint /api/auth
 * Suporte a PBKDF2, Verificação de E-mail OTP (6 dígitos), Trava Permanente de Dispositivo (Anti-Sybil)
 */
import { generateSalt, hashPassword, verifyPassword, signJWT, createAuthCookie, createClearCookie, randomUUID } from './cryptoService.js';
import { dbQueries } from '../db/queries.js';
import { LIMITS } from '../config/limits.js';
import { checkRateLimit } from '../middleware/rateLimiter.js';
import { applySecurityHeaders } from '../config/securityHeaders.js';
import { extractDeviceHash, assertDeviceNotBlocked, registerDeviceAccount } from './deviceSecurityService.js';
import { sendEmailVerificationCode, hashVerificationCode } from './emailService.js';

export async function handleAuthRequest(request, env, clientIp) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Content-Type': 'application/json' });
  applySecurityHeaders(headers, origin, env);

  const db = env.DB;
  const jwtSecret = env?.JWT_SECRET || 'arcana-super-secret-key-development-local-2026-vtt';

  // 1. Rate Limiting por IP (Proteção de Força Bruta)
  const rateLimit = checkRateLimit(clientIp, LIMITS.AUTH_RATE_LIMIT_PER_MINUTE, 'auth');
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: 'Muitas tentativas de autenticação. Tente novamente em um minuto.'
    }), { status: 429, headers });
  }

  // 2. Verificação de Trava Permanente no Dispositivo (Anti-Sybil)
  const deviceHash = await extractDeviceHash(request, clientIp);
  const deviceCheck = await assertDeviceNotBlocked(db, deviceHash);
  if (deviceCheck.blocked) {
    return new Response(JSON.stringify({
      sucesso: false,
      bloqueado: true,
      erro: deviceCheck.motivo
    }), { status: 403, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ sucesso: false, erro: 'Corpo JSON inválido' }), { status: 400, headers });
  }

  const { action, data = {} } = body;

  // ----------------------------------------------------
  // AÇÃO: CADASTRO DE NOVO USUÁRIO (COM CÓDIGO OTP)
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

    // Registra tentativa no dispositivo e aciona trava permanente se exceder 3 contas
    const devReg = await registerDeviceAccount(db, deviceHash, clientIp);
    if (devReg.status === 'BLOCKED_PERMANENT') {
      return new Response(JSON.stringify({
        sucesso: false,
        bloqueado: true,
        erro: 'Limite de criação de contas excedido para este dispositivo. O dispositivo recebeu uma trava permanente de segurança.'
      }), { status: 403, headers });
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const userId = `usr_${randomUUID().replace(/-/g, '').substring(0, 12)}`;

    // Cria a conta com e-mail pendente de verificação (email_verified = 0)
    await dbQueries.createUser(db, {
      id: userId,
      email,
      passwordHash,
      salt,
      displayName,
      role: 'Jogador',
      emailVerified: 0,
      authProvider: 'email'
    });

    // Despacha código OTP de 6 dígitos
    const { code, expiresAt } = await sendEmailVerificationCode(db, email, env);

    // Emite cookie temporário ou aguarda confirmação
    const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
    const token = await signJWT({ sub: userId, email, role: 'Jogador', displayName, emailVerified: 0, exp }, jwtSecret);
    headers.set('Set-Cookie', createAuthCookie(token, LIMITS.JWT_EXPIRATION_SECONDS));

    return new Response(JSON.stringify({
      sucesso: true,
      requerVerificacao: true,
      mensagem: 'Aventureiro cadastrado! Digite o código de 6 dígitos enviado para ativar sua conta.',
      usuario: { id: userId, email, displayName, role: 'Jogador', emailVerified: 0 },
      // Para ambiente local de desenvolvimento/teste facilitado
      _codigoTesteDev: env?.ENVIRONMENT === 'development' ? code : undefined
    }), { status: 201, headers });
  }

  // ----------------------------------------------------
  // AÇÃO: VALIDAÇÃO DO CÓDIGO DE 6 DÍGITOS (VERIFY_EMAIL)
  // ----------------------------------------------------
  if (action === 'verify_email') {
    const { email, code } = data;
    if (!email || !code || String(code).trim().length !== 6) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Informe o e-mail e o código de 6 dígitos' }), { status: 400, headers });
    }

    const record = await dbQueries.getEmailVerification(db, email);
    if (!record) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Código expirado ou não encontrado. Solicite um novo código.' }), { status: 400, headers });
    }

    // Verifica expiração
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await dbQueries.deleteEmailVerification(db, email);
      return new Response(JSON.stringify({ sucesso: false, erro: 'O código de 6 dígitos expirou (limite de 10 minutos)' }), { status: 400, headers });
    }

    // Verifica hash do código digitado
    const inputHash = await hashVerificationCode(String(code).trim());
    if (inputHash !== record.code_hash) {
      await dbQueries.incrementVerificationAttempts(db, email);
      return new Response(JSON.stringify({ sucesso: false, erro: 'Código de verificação incorreto' }), { status: 400, headers });
    }

    // Ativa a conta no D1 e apaga o código usado
    await dbQueries.markEmailVerified(db, email);
    await dbQueries.deleteEmailVerification(db, email);

    const user = await dbQueries.getUserByEmail(db, email);
    const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
    const token = await signJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      emailVerified: 1,
      exp
    }, jwtSecret);

    headers.set('Set-Cookie', createAuthCookie(token, LIMITS.JWT_EXPIRATION_SECONDS));
    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: 'E-mail confirmado com sucesso! Bem-vindo à taverna.',
      usuario: { id: user.id, email: user.email, displayName: user.display_name, role: user.role, emailVerified: 1 }
    }), { status: 200, headers });
  }

  // ----------------------------------------------------
  // AÇÃO: REENVIAR CÓDIGO (RESEND_CODE)
  // ----------------------------------------------------
  if (action === 'resend_code') {
    const { email } = data;
    if (!email) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Informe o e-mail' }), { status: 400, headers });
    }

    const user = await dbQueries.getUserByEmail(db, email);
    if (!user) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Usuário não encontrado' }), { status: 404, headers });
    }

    const { code } = await sendEmailVerificationCode(db, email, env);
    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: 'Novo código de 6 dígitos enviado!',
      _codigoTesteDev: env?.ENVIRONMENT === 'development' ? code : undefined
    }), { status: 200, headers });
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
    if (!user || !user.password_hash) {
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
      avatarUrl: user.avatar_url,
      emailVerified: user.email_verified,
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
        role: user.role,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified
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
