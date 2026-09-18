/**
 * Configuração e injeção de Cabeçalhos de Segurança e Política Restritiva de CORS
 */

export function getAllowedOrigins(env) {
  const configured = env?.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,https://0pesadelo-frontend.trevorrot.workers.dev';
  return configured.split(',').map(o => o.trim()).filter(Boolean);
}

export function isOriginAllowed(origin, env) {
  if (!origin) return false;
  // No ambiente de desenvolvimento, aceita conexões locais de qualquer porta (ex: Live Server 5500, 5501, 3000, etc.)
  if (env?.ENVIRONMENT === 'development' || !env?.ENVIRONMENT) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return true;
    }
  }
  const allowed = getAllowedOrigins(env);
  return allowed.includes(origin);
}

export function applySecurityHeaders(headers, requestOrigin, env) {
  // 1. Cabeçalhos de Segurança Rígidos (OWASP Top 10)
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none';");

  // 2. CORS Estrito (Apenas origens autorizadas com credenciais ativadas)
  if (requestOrigin && isOriginAllowed(requestOrigin, env)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Device-Fingerprint');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
  }

  return headers;
}
