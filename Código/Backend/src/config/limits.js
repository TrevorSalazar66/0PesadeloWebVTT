/**
 * Limites operacionais e de segurança do sistema
 */

export const LIMITS = {
  // Tamanho máximo do corpo da requisição JSON (64 KB para evitar estouro de memória)
  MAX_BODY_SIZE_BYTES: 64 * 1024,

  // Rate Limiting (tentativas por minuto)
  AUTH_RATE_LIMIT_PER_MINUTE: 10,
  SYNC_RATE_LIMIT_PER_MINUTE: 120,

  // Sessões e Tokens
  JWT_EXPIRATION_SECONDS: 15 * 60, // 15 minutos
  REFRESH_TOKEN_EXPIRATION_DAYS: 7, // 7 dias

  // Validação de Entidades
  MAX_CAMPAIGN_NAME_LENGTH: 80,
  MAX_CHARACTER_NAME_LENGTH: 80,
  MAX_PASSWORD_LENGTH: 128,
  MIN_PASSWORD_LENGTH: 6
};
