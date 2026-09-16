/**
 * Serviço de Autenticação para o Endpoint /api/auth
 * Suporte a PBKDF2, Validação Real de E-mail (RFC 5322), Verificação OTP (6 dígitos), Trava Permanente de Dispositivo (Anti-Sybil)
 */
import { generateSalt, hashPassword, verifyPassword, signJWT, createAuthCookie, createClearCookie, randomUUID } from './cryptoService.js';
import { dbQueries } from '../db/queries.js';
import { LIMITS } from '../config/limits.js';
import { checkRateLimit } from '../middleware/rateLimiter.js';
import { applySecurityHeaders } from '../config/securityHeaders.js';
import { extractDeviceHash, assertDeviceNotBlocked, registerDeviceAccount } from './deviceSecurityService.js';
import { sendEmailVerificationCode, hashVerificationCode, validateEmailFormat, verifyDomainMX } from './emailService.js';

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
      codigo: 'DEVICE_BLOCKED',
      deviceHash,
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
  // AÇÃO: CADASTRO DE NOVO USUÁRIO (COM VALIDAÇÃO DE E-MAIL E CÓDIGO OTP)
  // ----------------------------------------------------
  if (action === 'register') {
    const { email, password, displayName } = data;

    if (!email || !password || !displayName) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Preencha email, senha e nome de exibição' }), { status: 400, headers });
    }

    // Validação estrita de formato e veracidade de e-mail (RFC 5322)
    const emailVal = validateEmailFormat(email);
    if (!emailVal.valid) {
      return new Response(JSON.stringify({ sucesso: false, erro: emailVal.reason }), { status: 400, headers });
    }
    const cleanEmail = emailVal.cleanEmail;
    const domain = cleanEmail.split('@')[1];

    // Validação de MX do domínio
    const mxCheck = await verifyDomainMX(domain);
    if (!mxCheck.valid) {
      return new Response(JSON.stringify({ sucesso: false, erro: mxCheck.reason }), { status: 400, headers });
    }

    if (password.length < LIMITS.MIN_PASSWORD_LENGTH || password.length > LIMITS.MAX_PASSWORD_LENGTH) {
      return new Response(JSON.stringify({ sucesso: false, erro: `A senha deve ter entre ${LIMITS.MIN_PASSWORD_LENGTH} e ${LIMITS.MAX_PASSWORD_LENGTH} caracteres` }), { status: 400, headers });
    }

    const existing = await dbQueries.getUserByEmail(db, cleanEmail);
    if (existing) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Este e-mail já está cadastrado na taverna' }), { status: 409, headers });
    }

    // Validação de Trava de Dispositivo
    const devReg = await registerDeviceAccount(db, deviceHash, clientIp);
    if (devReg.status === 'BLOCKED_PERMANENT') {
      return new Response(JSON.stringify({
        sucesso: false,
        bloqueado: true,
        codigo: 'DEVICE_BLOCKED',
        deviceHash,
        erro: 'Limite de criação de contas excedido para este dispositivo. O dispositivo recebeu uma trava permanente de segurança.'
      }), { status: 403, headers });
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const userId = `usr_${randomUUID().replace(/-/g, '').substring(0, 12)}`;

    // Cria a conta com e-mail pendente de verificação (email_verified = 0)
    await dbQueries.createUser(db, {
      id: userId,
      email: cleanEmail,
      passwordHash,
      salt,
      displayName: displayName.trim(),
      role: 'Jogador',
      emailVerified: 0,
      authProvider: 'email'
    });

    // Despacha código OTP de 6 dígitos
    const { code } = await sendEmailVerificationCode(db, cleanEmail, env);

    // O acesso à plataforma permanece ESTRITAMENTE bloqueado. Não emitimos cookie de sessão aqui.
    return new Response(JSON.stringify({
      sucesso: true,
      requerVerificacao: true,
      mensagem: 'Conta criada! Digite o código de 6 dígitos enviado para seu e-mail para ativar sua conta e liberar o acesso.',
      email: cleanEmail,
      usuario: { id: userId, email: cleanEmail, displayName: displayName.trim(), role: 'Jogador', emailVerified: 0 },
      _codigoTesteDev: env?.ENVIRONMENT === 'test' ? code : undefined
    }), { status: 201, headers });
  }

  // ----------------------------------------------------
  // AÇÃO: VALIDAÇÃO DO CÓDIGO DE 6 DÍGITOS (VERIFY_EMAIL)
  // ----------------------------------------------------
  if (action === 'verify_email') {
    const { email, code } = data;
    if (!email || !code || String(code).trim().length !== 6) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Informe o e-mail e o código numérico de 6 dígitos' }), { status: 400, headers });
    }

    const emailVal = validateEmailFormat(email);
    const cleanEmail = emailVal.valid ? emailVal.cleanEmail : String(email).trim().toLowerCase();

    const record = await dbQueries.getEmailVerification(db, cleanEmail);
    if (!record) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Código expirado ou não encontrado. Solicite um novo código.' }), { status: 400, headers });
    }

    // Verifica expiração
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await dbQueries.deleteEmailVerification(db, cleanEmail);
      return new Response(JSON.stringify({ sucesso: false, erro: 'O código de 6 dígitos expirou (limite de 10 minutos). Solicite um novo código.' }), { status: 400, headers });
    }

    // Verifica hash do código digitado
    const inputHash = await hashVerificationCode(String(code).trim());
    if (inputHash !== record.code_hash) {
      await dbQueries.incrementVerificationAttempts(db, cleanEmail);
      return new Response(JSON.stringify({ sucesso: false, erro: 'Código de verificação incorreto' }), { status: 400, headers });
    }

    // Ativa a conta no D1 e apaga o código usado
    await dbQueries.markEmailVerified(db, cleanEmail);
    await dbQueries.deleteEmailVerification(db, cleanEmail);

    const user = await dbQueries.getUserByEmail(db, cleanEmail);
    const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
    const token = await signJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      emailVerified: 1,
      exp
    }, jwtSecret);

    // SOMENTE AGORA EMITIMOS O COOKIE SEGURO DE SESSÃO
    headers.set('Set-Cookie', createAuthCookie(token, LIMITS.JWT_EXPIRATION_SECONDS));
    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: 'E-mail confirmado com sucesso! Acesso à taverna liberado.',
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

    const emailVal = validateEmailFormat(email);
    const cleanEmail = emailVal.valid ? emailVal.cleanEmail : String(email).trim().toLowerCase();

    const user = await dbQueries.getUserByEmail(db, cleanEmail);
    if (!user) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Usuário não encontrado' }), { status: 404, headers });
    }

    if (user.email_verified === 1) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Este e-mail já foi confirmado anteriormente. Faça login normalmente.' }), { status: 400, headers });
    }

    await sendEmailVerificationCode(db, cleanEmail, env);
    return new Response(JSON.stringify({
      sucesso: true,
      mensagem: 'Novo código de 6 dígitos enviado para seu e-mail!'
    }), { status: 200, headers });
  }

  // ----------------------------------------------------
  // AÇÃO: LOGIN NA TAVERNA (COM TRAVA DE E-MAIL NÃO VERIFICADO)
  // ----------------------------------------------------
  if (action === 'login') {
    const { email, password } = data;

    if (!email || !password) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Informe e-mail e senha' }), { status: 400, headers });
    }

    const emailVal = validateEmailFormat(email);
    if (!emailVal.valid) {
      return new Response(JSON.stringify({ sucesso: false, erro: emailVal.reason }), { status: 400, headers });
    }
    const cleanEmail = emailVal.cleanEmail;

    const user = await dbQueries.getUserByEmail(db, cleanEmail);
    if (!user || !user.password_hash) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Credenciais inválidas' }), { status: 401, headers });
    }

    const isMatch = await verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'Credenciais inválidas' }), { status: 401, headers });
    }

    // BLOQUEIO RIGOROSO: Contas não ativadas são impedidas de entrar e redirecionadas para validação OTP
    if (!user.email_verified || user.email_verified === 0) {
      const existingVer = await dbQueries.getEmailVerification(db, user.email);
      if (!existingVer || new Date(existingVer.expires_at).getTime() < Date.now()) {
        await sendEmailVerificationCode(db, user.email, env);
      }
      return new Response(JSON.stringify({
        sucesso: false,
        codigo: 'EMAIL_NOT_VERIFIED',
        requerVerificacao: true,
        email: user.email,
        erro: 'Esta conta ainda não foi ativada. Digite o código de 6 dígitos enviado para seu e-mail para liberar o acesso.'
      }), { status: 403, headers });
    }

    // Emissão do Token JWT para contas validadas
    const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
    const token = await signJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      emailVerified: 1,
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
        emailVerified: 1
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
