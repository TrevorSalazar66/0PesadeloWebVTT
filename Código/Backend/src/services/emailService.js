/**
 * Serviço de Envio e Verificação de E-mails Transacionais com Códigos OTP de 6 Dígitos
 * Validação de formato de e-mail real e bloqueio de domínios temporários
 */
import { randomUUID } from './cryptoService.js';
import { dbQueries } from '../db/queries.js';

// Lista de domínios descartáveis / temporários / fictícios que devem ser bloqueados
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'throwawaymail.com', 'yopmail.com', 'sharklasers.com', 'dispostable.com',
  'trashmail.com', 'fake.com', 'test.com', 'teste.com', 'invalid.com',
  'example.com', 'exemplo.com'
]);

/**
 * Valida se um e-mail é real, possui sintaxe RFC 5322 e domínio válido
 * @param {string} email
 * @returns {{ valid: boolean, cleanEmail?: string, reason?: string }}
 */
export function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Por favor, informe um endereço de e-mail.' };
  }

  const clean = email.trim().toLowerCase();

  if (clean.length > 254 || clean.length < 5) {
    return { valid: false, reason: 'O e-mail deve ter entre 5 e 254 caracteres.' };
  }

  // Sintaxe padrão RFC 5322
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, reason: 'Formato de e-mail inválido. Digite um e-mail com estrutura nome@dominio.extensao.' };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { valid: false, reason: 'O e-mail deve conter exatamente um símbolo "@".' };
  }

  const [user, domain] = parts;

  if (user.length === 0 || domain.length === 0) {
    return { valid: false, reason: 'E-mail não pode ter nome de usuário ou domínio vazios.' };
  }

  if (user.startsWith('.') || user.endsWith('.') || user.includes('..')) {
    return { valid: false, reason: 'O e-mail não pode começar, terminar ou conter pontos consecutivos no nome.' };
  }

  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    return { valid: false, reason: 'O domínio do e-mail deve conter uma extensão válida (ex: .com, .com.br).' };
  }

  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return { valid: false, reason: 'A extensão final do domínio do e-mail é inválida.' };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Provedores de e-mail descartáveis ou temporários não são aceitos. Use seu e-mail real.' };
  }

  return { valid: true, cleanEmail: clean };
}

/**
 * Gera código numérico de 6 dígitos criptograficamente seguro (100000 a 999999)
 */
export function generate6DigitCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return String(code);
}

/**
 * Gera hash SHA-256 do código de verificação para armazenamento seguro no D1
 */
export async function hashVerificationCode(code) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(code));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cria e despacha o código de verificação para o e-mail
 */
export async function sendEmailVerificationCode(db, email, env) {
  const code = generate6DigitCode();
  const codeHash = await hashVerificationCode(code);
  const id = `ver_${randomUUID().replace(/-/g, '').substring(0, 12)}`;

  // Validade de 10 minutos
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await dbQueries.createEmailVerification(db, {
    id,
    email,
    codeHash,
    expiresAt
  });

  // Disparo de E-mail via Resend (Se a chave estiver configurada em produção)
  const resendApiKey = env?.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Arcana VTT <taverna@arcana.pages.dev>',
          to: [email],
          subject: `${code} é o seu código de confirmação na Taverna Arcana`,
          html: `
            <div style="font-family: sans-serif; background: #0b0b14; color: #f5f5f7; padding: 24px; border-radius: 12px;">
              <h2 style="color: #d4a34b;">Saudações, aventureiro!</h2>
              <p>Seu código de ativação na Taverna Arcana VTT é:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #e5b758; margin: 20px 0;">${code}</div>
              <p style="color: #8e8ea6; font-size: 13px;">Este código expira em 10 minutos. Se você não solicitou esta conta, ignore este e-mail.</p>
            </div>
          `
        })
      });
    } catch (e) {
      console.warn('[EmailService] Falha ao enviar via Resend:', e.message);
    }
  } else {
    // Modo Desenvolvimento / Teste Local: Registro transparente no console
    console.log(`\n📧 [EMAIL SIMULADO] Para: ${email}`);
    console.log(`🔑 CÓDIGO DE VERIFICAÇÃO OTP (6 DÍGITOS): [ ${code} ] (Válido por 10 min)\n`);
  }

  return { code, expiresAt };
}
