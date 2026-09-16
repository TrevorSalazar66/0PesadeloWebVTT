/**
 * Middleware de Autenticação JWT via Cookie HttpOnly ou Header de Autorização
 */
import { parseCookies, verifyJWT } from '../services/cryptoService.js';

export async function authenticateRequest(request, env) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  let token = cookies.arcana_session;

  // Suporte alternativo a header Authorization: Bearer <token>
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return null;
  }

  const secret = env?.JWT_SECRET || 'arcana-super-secret-key-development-local-2026-vtt';
  const decoded = await verifyJWT(token, secret);

  if (!decoded || !decoded.sub) {
    return null;
  }

  return {
    userId: decoded.sub,
    email: decoded.email,
    role: decoded.role || 'Jogador',
    displayName: decoded.displayName || 'Aventureiro'
  };
}
