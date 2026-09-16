/**
 * Validação rigorosa de Origem, Segurança de Payload e Headers de Requisição
 */
import { isOriginAllowed, applySecurityHeaders } from '../config/securityHeaders.js';
import { LIMITS } from '../config/limits.js';

export async function validateRequestSecurity(request, env) {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);

  // 1. Tratamento de Requisições Preflight (CORS OPTIONS)
  if (request.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin, env)) {
      return new Response('Origem não autorizada', { status: 403 });
    }
    const preflightHeaders = new Headers();
    applySecurityHeaders(preflightHeaders, origin, env);
    return new Response(null, { status: 204, headers: preflightHeaders });
  }

  // 2. Validação Rígida de Origem (Apenas para requisições com header Origin presente)
  if (origin && !isOriginAllowed(origin, env)) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: 'Acesso negado: Origem não autorizada pelas políticas de segurança'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. Validação do Tamanho do Payload (Content-Length)
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > LIMITS.MAX_BODY_SIZE_BYTES) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: `Tamanho de payload excedido (Máximo ${LIMITS.MAX_BODY_SIZE_BYTES / 1024}KB)`
    }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return null; // Validação passou sem erros
}

/**
 * Faz a leitura segura do JSON com verificação de tamanho em bytes
 */
export async function parseSecureJson(request) {
  try {
    const text = await request.text();
    if (!text || !text.trim()) {
      return { data: {}, rawText: '' };
    }

    if (text.length > LIMITS.MAX_BODY_SIZE_BYTES) {
      return { error: 'Payload excede o limite máximo permitido', status: 413 };
    }

    const data = JSON.parse(text);
    return { data, rawText: text };
  } catch (err) {
    return { error: 'Formato JSON inválido ou corrompido', status: 400 };
  }
}
