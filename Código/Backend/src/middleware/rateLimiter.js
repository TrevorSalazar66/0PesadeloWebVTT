/**
 * Rate Limiting em memória / Edge para proteção contra abuso e força bruta
 */

const ipRequestMap = new Map();

// Limpeza periódica de entradas expiradas a cada 2 minutos
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipRequestMap.entries()) {
    if (now - record.resetTime > 60000) {
      ipRequestMap.delete(key);
    }
  }
}, 120000);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

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
