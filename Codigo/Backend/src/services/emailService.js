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

  // 1. Detecção de caracteres excessivamente repetidos (ex: 2222, 1111, aaaa)
  if (/([a-zA-Z0-9])\1{3,}/.test(user)) {
    return { valid: false, reason: 'O e-mail contém caracteres repetidos em sequência (ex: 2222), indicando um endereço fictício.' };
  }

  // 2. Detecção de prefixos fictícios ou de teste óbvios
  if (/^(teste|test|fake|falso|ficticio|asdf|qwerty|temp|lixo|naoexiste|invalido|random|exemplo|example|anonimo)/i.test(user)) {
    return { valid: false, reason: 'Endereços fictícios ou de teste não são permitidos. Utilize seu e-mail real.' };
  }

  // 3. Regras para provedores de grande escala
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    if (/^\d+$/.test(user)) {
      return { valid: false, reason: 'E-mails do Gmail não podem ser compostos apenas por números.' };
    }
    if (user.length < 6 || user.length > 30) {
      return { valid: false, reason: 'O nome de usuário do Gmail deve ter entre 6 e 30 caracteres.' };
    }
  }

  if (['outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.com.br', 'live.com'].includes(domain)) {
    if (/^\d{6,}$/.test(user)) {
      return { valid: false, reason: 'Endereços puramente numéricos não são aceitos neste provedor.' };
    }
  }

  return { valid: true, cleanEmail: clean };
}

/**
 * Verifica se o domínio possui servidores MX ativos através de DNS over HTTPS (Cloudflare DoH)
 * @param {string} domain 
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
export async function verifyDomainMX(domain) {
  if (!domain) return { valid: false, reason: 'Domínio ausente.' };
  const cleanDomain = domain.trim().toLowerCase();

  // Domínios de teste local/ambiente fechado
  if (cleanDomain.endsWith('.vtt') || cleanDomain.endsWith('.test') || cleanDomain.endsWith('.local') || cleanDomain === 'localhost') {
    return { valid: true };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=MX`, {
      headers: { 'accept': 'application/dns-json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { valid: true };
    }

    const data = await res.json();
    if (data.Status === 3) {
      return { valid: false, reason: `O domínio "@${cleanDomain}" não existe na internet. Verifique se digitou corretamente.` };
    }

    const hasMx = Array.isArray(data.Answer) && data.Answer.some(a => a.type === 15);
    if (!hasMx && (!data.Answer || data.Answer.length === 0)) {
      return { valid: false, reason: `O domínio "@${cleanDomain}" não possui servidores válidos para recebimento de mensagens (registro MX inexistente).` };
    }

    return { valid: true };
  } catch (e) {
    return { valid: true };
  }
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
