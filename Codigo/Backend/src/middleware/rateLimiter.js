/**
 * Rate Limiting em memória / Edge para proteção contra abuso e força bruta
 */

const ipRequestMap = new Map();

// O timer contínuo não é suportado pelo Cloudflare Workers no escopo global.
// A limpeza acontecerá naturalmente a cada "Cold Start" ou podemos usar uma checagem reativa.

export function checkRateLimit(ip, maxRequestsPerMinute, bucket = 'default') {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const record = ipRequestMap.get(key) || { count: 0, resetTime: now };

  // Se passou mais de 1 minuto, reinicia a janela
  if (now - record.resetTime > 60000) {
    record.count = 0;
    record.resetTime = now;
  }

  record.count++;
  ipRequestMap.set(key, record);

  return {
    allowed: record.count <= maxRequestsPerMinute,
    remaining: Math.max(0, maxRequestsPerMinute - record.count),
    resetTime: record.resetTime + 60000
  };
}
