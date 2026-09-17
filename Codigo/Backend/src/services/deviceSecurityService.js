/**
 * Serviço de Segurança e Fingerprint de Dispositivo (Defesa Anti-Sybil e Trava Permanente)
 */
import { dbQueries } from '../db/queries.js';

export async function extractDeviceHash(request, clientIp) {
  const headerFingerprint = request.headers.get('X-Device-Fingerprint');
  if (headerFingerprint && headerFingerprint.trim().length >= 8) {
    return headerFingerprint.trim();
  }

  // Fallback seguro: Hash SHA-256 de IP + User-Agent
  const userAgent = request.headers.get('User-Agent') || 'unknown-client';
  const rawData = `${clientIp}::${userAgent}`;
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(rawData));
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `dev_${hex.substring(0, 24)}`;
}

/**
 * Verifica se o dispositivo está com a trava permanente ativa
 */
export async function assertDeviceNotBlocked(db, deviceHash) {
  const record = await dbQueries.getDeviceSecurity(db, deviceHash);
  if (record && record.status === 'BLOCKED_PERMANENT') {
    return {
      blocked: true,
      motivo: record.reason || 'Este dispositivo foi bloqueado por atividades suspeitas. Contate um Administrador para liberação.'
    };
  }
  return { blocked: false };
}

/**
 * Registra a criação de uma conta pelo dispositivo e aplica trava se ultrapassar o teto
 */
export async function registerDeviceAccount(db, deviceHash, clientIp) {
  return await dbQueries.registerDeviceAttempt(db, deviceHash, clientIp);
}
