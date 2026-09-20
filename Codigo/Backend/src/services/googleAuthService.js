/**
 * Serviço de Autenticação com Google OAuth 2.0 (OpenID Connect nativo no Cloudflare Worker)
 * 100% gratuito e sem intermediários
 */
import { randomUUID, signJWT, createAuthCookie } from './cryptoService.js';
import { dbQueries } from '../db/queries.js';
import { LIMITS } from '../config/limits.js';

export function getGoogleOAuthUrl(env, requestUrl) {
  const clientId = env?.GOOGLE_CLIENT_ID || 'mock-google-client-id-local';
  const url = new URL(requestUrl);
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const state = `st_${randomUUID().replace(/-/g, '').substring(0, 16)}`;

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('access_type', 'online');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  return { url: googleAuthUrl.toString(), state, redirectUri };
}

export async function processGoogleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const frontendBase = env?.FRONTEND_URL || 'https://0pesadelo-frontend.trevorrot.workers.dev';

  if (error || !code) {
    return Response.redirect(`${frontendBase}?auth_error=${encodeURIComponent(error || 'Código de autorização não fornecido')}`, 302);
  }

  let googleUser;

  // Suporte a modo de simulação / teste automatizado
  if (code.startsWith('mock_')) {
    const mockEmail = url.searchParams.get('mock_email') || 'aventureiro.google@gmail.com';
    googleUser = {
      sub: `g_${code}`,
      email: mockEmail,
      name: 'Aventureiro Google',
      picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
    };
  } else {
    // Troca de Código Real com a API do Google
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${url.origin}/api/auth/google/callback`,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || 'Falha ao obter token do Google');
      }

      // Busca dados do Perfil
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      googleUser = await userRes.json();
    } catch (err) {
      return Response.redirect(`${frontendBase}?auth_error=${encodeURIComponent('Falha na comunicação com o Google')}`, 302);
    }
  }

  if (!googleUser || !googleUser.email) {
    return Response.redirect(`${frontendBase}?auth_error=${encodeURIComponent('Não foi possível obter o e-mail do Google')}`, 302);
  }

  const db = env.DB;
  const jwtSecret = env?.JWT_SECRET || 'arcana-super-secret-key-development-local-2026-vtt';

  // 1. Verifica se já existe conta pelo Google ID
  let user = await dbQueries.getUserByGoogleId(db, googleUser.sub);

  // 2. Se não encontrou por google_id, verifica por e-mail para UNIFICAÇÃO AUTOMÁTICA
  if (!user) {
    const existingByEmail = await dbQueries.getUserByEmail(db, googleUser.email);
    if (existingByEmail) {
      // Unifica a conta existente
      await dbQueries.linkGoogleAccount(db, existingByEmail.id, googleUser.sub, googleUser.picture || '');
      user = await dbQueries.getUserById(db, existingByEmail.id);
    } else {
      // Cria nova conta com e-mail já verificado pelo Google e perfil pendente
      const newUserId = `usr_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
      await dbQueries.createUser(db, {
        id: newUserId,
        email: googleUser.email,
        passwordHash: null,
        salt: null,
        displayName: googleUser.name || 'Aventureiro',
        role: 'jogador',
        emailVerified: 1, // Pré-verificado pelo Google
        profileCompleted: 0,
        authProvider: 'google',
        googleId: googleUser.sub,
        avatarUrl: googleUser.picture || ''
      });
      user = await dbQueries.getUserById(db, newUserId);
    }
  }

  // 3. Emite Cookie Seguro de Sessão e Token para o Frontend
  const isProfileCompleted = user.profile_completed === 1;
  const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
  const token = await signJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    emailVerified: 1,
    profileCompleted: isProfileCompleted ? 1 : 0,
    exp
  }, jwtSecret);

  const userPayload = {
    id: user.id,
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    name: user.display_name,
    nickname: user.nickname || '',
    role: user.role,
    avatarUrl: user.avatar_url,
    emailVerified: 1,
    profileCompleted: isProfileCompleted ? 1 : 0
  };

  const headers = new Headers();
  headers.set('Set-Cookie', createAuthCookie(token, LIMITS.JWT_EXPIRATION_SECONDS));
  const loginStatus = isProfileCompleted ? 'google_success' : 'google_profile_setup';

  // Redireciona com token e dados do usuário serializados para o frontend salvar em localStorage
  const redirectUrl = new URL(frontendBase);
  redirectUrl.searchParams.set('login', loginStatus);
  redirectUrl.searchParams.set('token', token);
  redirectUrl.searchParams.set('user', JSON.stringify(userPayload));

  headers.set('Location', redirectUrl.toString());
  return new Response(null, { status: 302, headers });
}
