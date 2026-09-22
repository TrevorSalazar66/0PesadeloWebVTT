/**
 * Gateway Unificado de Sincronização e Comandos (/api/sync)
 * Roteamento interno blindado com RLS lógico e despacho desacoplado
 */
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { dbQueries } from '../db/queries.js';
import { LIMITS } from '../config/limits.js';
import { checkRateLimit } from '../middleware/rateLimiter.js';
import { applySecurityHeaders } from '../config/securityHeaders.js';
import { randomUUID, signJWT, createAuthCookie, generateSalt, hashPassword, verifyPassword } from './cryptoService.js';
import { adminService } from './adminService.js';
import { generateUniqueSimpleId, OFFICIAL_SYSTEMS, OFFICIAL_THEMES, CAMPAIGN_LIMITS, sanitizeText } from './campaignService.js';
import { rpgEngineService } from './rpgEngineService.js';


export async function handleSyncRequest(request, env, clientIp) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Content-Type': 'application/json' });
  applySecurityHeaders(headers, origin, env);

  // 1. Rate Limiting de Sincronização
  const rateLimit = checkRateLimit(clientIp, LIMITS.SYNC_RATE_LIMIT_PER_MINUTE, 'sync');
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: 'Limite de requisições excedido. Aguarde alguns instantes.'
    }), { status: 429, headers });
  }

  // 2. Autenticação Rígida Obrigatória
  const user = await authenticateRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: 'Não autorizado: É necessário estar autenticado na taverna'
    }), { status: 401, headers });
  }

  // 2.1 Verificação de E-mail Obrigatória para qualquer ação no Gateway
  if (!user.emailVerified || user.emailVerified === 0) {
    return new Response(JSON.stringify({
      sucesso: false,
      codigo: 'EMAIL_NOT_VERIFIED',
      erro: 'Acesso bloqueado: confirme seu endereço de e-mail com o código de 6 dígitos para liberar o acesso aos recursos da taverna.'
    }), { status: 403, headers });
  }

  // 2.2 Verificação de Conta Suspensa/Bloqueada pela Administração
  const dbUser = await dbQueries.getUserById(env.DB, user.userId);
  if (dbUser && dbUser.is_blocked === 1) {
    return new Response(JSON.stringify({
      sucesso: false,
      bloqueado: true,
      codigo: 'ACCOUNT_BLOCKED',
      erro: 'Esta conta foi suspensa/bloqueada permanentemente pela administração da taverna. O acesso está proibido.'
    }), { status: 403, headers });
  }

  // 3. Leitura e Sanitização do Payload
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ sucesso: false, erro: 'Formato JSON inválido' }), { status: 400, headers });
  }

  const { action, data = {} } = body;
  const db = env.DB;

  if (!action || typeof action !== 'string') {
    return new Response(JSON.stringify({ sucesso: false, erro: 'Campo "action" é obrigatório no gateway' }), { status: 400, headers });
  }

  // 2.2 Interceptação de Conclusão Obrigatória de Perfil (Onboarding)
  if (!user.profileCompleted || user.profileCompleted === 0) {
    if (action !== 'profile.setup' && action !== 'profile.get') {
      return new Response(JSON.stringify({
        sucesso: false,
        codigo: 'PROFILE_INCOMPLETE',
        requerCriacaoPerfil: true,
        erro: 'Criação de perfil pendente. Conclua seu perfil de aventureiro para liberar o acesso à Taverna.'
      }), { status: 403, headers });
    }
  }

  // ----------------------------------------------------
  // DESPACHO INTERNO POR NAMESPACE
  // ----------------------------------------------------
  try {
    switch (action) {
      // ----------------------------------------------------
      // WEBRTC SIGNALING & LEADER ELECTION
      // ----------------------------------------------------
      case 'sync.presence': {
        const { campaignId, isLeader = 0 } = data;
        if (!campaignId) return new Response(JSON.stringify({ sucesso: false, erro: 'campaignId ausente' }), { status: 400, headers });
        
        // Atualiza a presença do usuário atual
        await dbQueries.updatePresence(db, campaignId, user.userId, isLeader);
        
        // Retorna todos os ativos (últimos 15 segundos)
        const activeUsers = await dbQueries.getActivePresence(db, campaignId, 15);
        
        // O líder é o cara com o menor user_id (ordem alfabética/numérica do UUID/ID)
        let leaderId = null;
        if (activeUsers.length > 0) {
          leaderId = activeUsers[0].user_id; // Já vem ordenado pelo ASC do dbQueries
        }

        return new Response(JSON.stringify({
          sucesso: true,
          ativos: activeUsers,
          liderId: leaderId,
          meuId: user.userId
        }), { status: 200, headers });
      }

      case 'sync.signal': {
        const { campaignId, targetId, type, payload } = data;
        if (!campaignId || !targetId || !type || !payload) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados de sinalização incompletos' }), { status: 400, headers });
        }

        await dbQueries.insertSignal(db, campaignId, user.userId, targetId, type, payload);
        return new Response(JSON.stringify({ sucesso: true }), { status: 200, headers });
      }

      case 'sync.consumeSignals': {
        const { campaignId } = data;
        if (!campaignId) return new Response(JSON.stringify({ sucesso: false, erro: 'campaignId ausente' }), { status: 400, headers });

        const signals = await dbQueries.consumeSignals(db, campaignId, user.userId);
        return new Response(JSON.stringify({ sucesso: true, signals }), { status: 200, headers });
      }

      // PERFIL & ONBOARDING
      case 'profile.get': {
        const userBasic = await dbQueries.getUserById(db, user.userId);
        const profile = await dbQueries.getUserProfile(db, user.userId);
        const stats = await dbQueries.getUserStats(db, user.userId);

        const structuredUser = {
          id: userBasic?.id,
          name: userBasic?.display_name || userBasic?.name || '',
          displayName: userBasic?.display_name || userBasic?.name || '',
          email: userBasic?.email || '',
          role: userBasic?.role || 'jogador',
          avatar_url: userBasic?.avatar_url || '',
          avatarUrl: userBasic?.avatar_url || '',
          email_verified: userBasic?.email_verified || 0,
          auth_provider: userBasic?.auth_provider || 'email',
          created_at: userBasic?.created_at || ''
        };

        const structuredProfile = profile ? {
          name: profile.name || userBasic?.display_name || '',
          displayName: profile.name || userBasic?.display_name || '',
          nickname: profile.nickname || '',
          ageGroup: profile.age_group || '18-24',
          ageRange: profile.age_group || '18-24',
          bio: profile.bio || '',
          avatarUrl: profile.avatar_url || userBasic?.avatar_url || '',
          bannerUrl: profile.banner_url || '',
          contactWhatsapp: profile.contacts?.whatsapp || '',
          contactDiscord: profile.contacts?.discord || '',
          contactInstagram: profile.contacts?.instagram || '',
          contacts: profile.contacts || {}
        } : null;

        const structuredStats = {
          ...(stats || {}),
          totalCampaigns: stats?.totalCampaigns || 0,
          totalCreatedCampaigns: stats?.totalCreatedCampaigns || 0,
          totalCharacters: stats?.totalCharacters || 0,
          participatingCampaigns: stats?.totalCampaigns || 0,
          masterCampaigns: stats?.totalCreatedCampaigns || 0,
          charactersCreated: stats?.totalCharacters || 0
        };

        return new Response(JSON.stringify({
          sucesso: true,
          dados: {
            ...userBasic,
            user: structuredUser,
            perfil: profile || null,
            profile: structuredProfile,
            stats: structuredStats
          }
        }), { status: 200, headers });
      }

      case 'profile.setup': {
        const { name, nickname, ageGroup, bio, contacts = {}, avatarUrl = '', bannerUrl = '' } = data;

        // 1. Validação de Nome
        if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'O nome deve ter entre 2 e 60 caracteres' }), { status: 400, headers });
        }

        // 2. Validação de Nickname
        if (!nickname || typeof nickname !== 'string') {
          return new Response(JSON.stringify({ sucesso: false, erro: 'O nickname é obrigatório' }), { status: 400, headers });
        }
        const cleanNick = nickname.trim().replace(/^@+/, '');
        if (!/^[a-zA-Z0-9_]{3,25}$/.test(cleanNick)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'O nickname deve ter entre 3 e 25 caracteres (apenas letras, números e underlines)' }), { status: 400, headers });
        }

        // Verifica unicidade do Nickname
        const existingNick = await dbQueries.getProfileByNickname(db, cleanNick);
        if (existingNick && existingNick.user_id !== user.userId) {
          return new Response(JSON.stringify({ sucesso: false, erro: `O nickname @${cleanNick} já está sendo utilizado por outro aventureiro` }), { status: 409, headers });
        }

        // 3. Validação de Faixa Etária
        const validAgeGroups = new Set(['-14', '14-17', '18-24', '25-34', '35+', '+18', '18+']);
        if (!ageGroup || !validAgeGroups.has(String(ageGroup).trim())) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Selecione uma faixa etária válida' }), { status: 400, headers });
        }

        // 4. Validação e Sanitização da Bio (limite de 500 caracteres e escape HTML)
        if (!bio || typeof bio !== 'string' || bio.trim().length === 0) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'A biografia de aventureiro é obrigatória' }), { status: 400, headers });
        }
        if (bio.trim().length > 500) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'A biografia não pode exceder 500 caracteres' }), { status: 400, headers });
        }
        const cleanBio = bio.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 5. Sanitização de Contatos Opcionais
        const cleanContacts = {
          whatsapp: typeof contacts?.whatsapp === 'string' ? contacts.whatsapp.trim().substring(0, 30) : '',
          discord: typeof contacts?.discord === 'string' ? contacts.discord.trim().substring(0, 50) : '',
          instagram: typeof contacts?.instagram === 'string' ? contacts.instagram.trim().replace(/^@+/, '').substring(0, 50) : ''
        };

        // 6. Persistência Atômica no Cloudflare D1
        await dbQueries.saveUserProfile(db, {
          userId: user.userId,
          name: name.trim(),
          nickname: cleanNick,
          ageGroup: String(ageGroup).trim(),
          bio: cleanBio,
          contacts: cleanContacts,
          avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
          bannerUrl: typeof bannerUrl === 'string' ? bannerUrl.trim() : ''
        });

        // 7. Reemite Token JWT atualizado com profileCompleted: 1
        const jwtSecret = env?.JWT_SECRET || 'arcana-super-secret-key-development-local-2026-vtt';
        const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
        const updatedToken = await signJWT({
          sub: user.userId,
          email: user.email,
          role: user.role,
          displayName: name.trim(),
          avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
          emailVerified: 1,
          profileCompleted: 1,
          exp
        }, jwtSecret);

        headers.set('Set-Cookie', createAuthCookie(updatedToken, LIMITS.JWT_EXPIRATION_SECONDS));
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Perfil forjado com sucesso! Bem-vindo à Taverna.',
          token: updatedToken,
          perfil: {
            userId: user.userId,
            name: name.trim(),
            nickname: cleanNick,
            ageGroup: String(ageGroup).trim(),
            bio: cleanBio,
            contacts: cleanContacts,
            avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
            bannerUrl: typeof bannerUrl === 'string' ? bannerUrl.trim() : '',
            role: user.role,
            profileCompleted: 1
          }
        }), { status: 200, headers });
      }

      case 'profile.update': {
        const currentProfile = await dbQueries.getUserProfile(db, user.userId) || {};
        const currentUser = await dbQueries.getUserById(db, user.userId) || {};

        const name = (data.name !== undefined ? data.name : (data.displayName !== undefined ? data.displayName : (currentProfile.name || currentUser.display_name))) || '';
        const nickname = (data.nickname !== undefined ? data.nickname : (currentProfile.nickname || '')).trim().replace(/^@+/, '');
        const ageGroup = data.ageGroup !== undefined ? data.ageGroup : (data.ageRange !== undefined ? data.ageRange : (currentProfile.age_group || '18-24'));
        const bio = data.bio !== undefined ? data.bio : (currentProfile.bio || '');
        const contacts = data.contacts !== undefined ? data.contacts : {
          whatsapp: data.contactWhatsapp !== undefined ? data.contactWhatsapp : (currentProfile.contacts?.whatsapp || ''),
          discord: data.contactDiscord !== undefined ? data.contactDiscord : (currentProfile.contacts?.discord || ''),
          instagram: data.contactInstagram !== undefined ? data.contactInstagram : (currentProfile.contacts?.instagram || '')
        };
        const avatarUrl = data.avatarUrl !== undefined ? data.avatarUrl : (currentProfile.avatar_url || currentUser.avatar_url || '');
        const bannerUrl = data.bannerUrl !== undefined ? data.bannerUrl : (currentProfile.banner_url || '');

        // 1. Validação de Nome
        if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'O nome deve ter entre 2 e 60 caracteres' }), { status: 400, headers });
        }

        // 2. Validação de Nickname
        if (!nickname) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'O nickname é obrigatório' }), { status: 400, headers });
        }
        if (!/^[a-zA-Z0-9_]{3,25}$/.test(nickname)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'O nickname deve ter entre 3 e 25 caracteres (apenas letras, números e underlines)' }), { status: 400, headers });
        }

        // Verifica unicidade de nickname se foi alterado
        const existingNick = await dbQueries.getProfileByNickname(db, nickname);
        if (existingNick && existingNick.user_id !== user.userId) {
          return new Response(JSON.stringify({ sucesso: false, erro: `O nickname @${nickname} já está sendo utilizado por outro aventureiro` }), { status: 409, headers });
        }

        // 3. Validação de Faixa Etária
        const validAgeGroups = new Set(['-14', '14-17', '18-24', '25-34', '35+', '+18', '18+']);
        if (ageGroup && !validAgeGroups.has(String(ageGroup).trim())) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Selecione uma faixa etária válida' }), { status: 400, headers });
        }

        // 4. Sanitização da Bio
        const cleanBio = typeof bio === 'string' ? bio.trim().substring(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

        // 5. Sanitização de Contatos Opcionais
        const cleanContacts = {
          whatsapp: typeof contacts?.whatsapp === 'string' ? contacts.whatsapp.trim().substring(0, 30) : '',
          discord: typeof contacts?.discord === 'string' ? contacts.discord.trim().substring(0, 50) : '',
          instagram: typeof contacts?.instagram === 'string' ? contacts.instagram.trim().replace(/^@+/, '').substring(0, 50) : ''
        };

        await dbQueries.saveUserProfile(db, {
          userId: user.userId,
          name: name.trim(),
          nickname,
          ageGroup: String(ageGroup || '18-24').trim(),
          bio: cleanBio,
          contacts: cleanContacts,
          avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
          bannerUrl: typeof bannerUrl === 'string' ? bannerUrl.trim() : ''
        });

        // Reemite Token JWT com novos displayName e avatarUrl
        const jwtSecret = env?.JWT_SECRET || 'arcana-super-secret-key-development-local-2026-vtt';
        const exp = Math.floor(Date.now() / 1000) + LIMITS.JWT_EXPIRATION_SECONDS;
        const updatedToken = await signJWT({
          sub: user.userId,
          email: user.email,
          role: user.role,
          displayName: name.trim(),
          avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
          emailVerified: 1,
          profileCompleted: 1,
          exp
        }, jwtSecret);

        headers.set('Set-Cookie', createAuthCookie(updatedToken, LIMITS.JWT_EXPIRATION_SECONDS));

        const updatedStats = await dbQueries.getUserStats(db, user.userId);
        const structuredProfile = {
          userId: user.userId,
          name: name.trim(),
          displayName: name.trim(),
          nickname,
          ageGroup: String(ageGroup || '18-24').trim(),
          ageRange: String(ageGroup || '18-24').trim(),
          bio: cleanBio,
          contacts: cleanContacts,
          contactWhatsapp: cleanContacts.whatsapp || '',
          contactDiscord: cleanContacts.discord || '',
          contactInstagram: cleanContacts.instagram || '',
          avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
          bannerUrl: typeof bannerUrl === 'string' ? bannerUrl.trim() : '',
          role: user.role,
          profileCompleted: 1
        };

        const structuredStats = {
          ...(updatedStats || {}),
          totalCampaigns: updatedStats?.totalCampaigns || 0,
          totalCreatedCampaigns: updatedStats?.totalCreatedCampaigns || 0,
          totalCharacters: updatedStats?.totalCharacters || 0,
          participatingCampaigns: updatedStats?.totalCampaigns || 0,
          masterCampaigns: updatedStats?.totalCreatedCampaigns || 0,
          charactersCreated: updatedStats?.totalCharacters || 0
        };

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Perfil do aventureiro atualizado com sucesso!',
          token: updatedToken,
          perfil: structuredProfile,
          profile: structuredProfile,
          dados: {
            perfil: structuredProfile,
            profile: structuredProfile,
            stats: structuredStats
          },
          stats: structuredStats
        }), { status: 200, headers });
      }

      case 'profile.password.update':
      case 'profile.changePassword': {
        const { currentPassword, newPassword } = data;

        if (!newPassword || typeof newPassword !== 'string') {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Informe a nova senha' }), { status: 400, headers });
        }

        if (newPassword.length < LIMITS.MIN_PASSWORD_LENGTH || newPassword.length > LIMITS.MAX_PASSWORD_LENGTH) {
          return new Response(JSON.stringify({ sucesso: false, erro: `A nova senha deve ter entre ${LIMITS.MIN_PASSWORD_LENGTH} e ${LIMITS.MAX_PASSWORD_LENGTH} caracteres` }), { status: 400, headers });
        }

        const userAuth = await dbQueries.getUserWithAuth(db, user.userId);
        if (!userAuth) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Usuário não encontrado' }), { status: 404, headers });
        }

        // Se o usuário já possui senha cadastrada, valida a senha atual
        if (userAuth.password_hash) {
          if (!currentPassword) {
            return new Response(JSON.stringify({ sucesso: false, erro: 'Informe sua senha atual para autorizar a alteração' }), { status: 400, headers });
          }
          const isMatch = await verifyPassword(currentPassword, userAuth.password_hash, userAuth.salt);
          if (!isMatch) {
            return new Response(JSON.stringify({ sucesso: false, erro: 'A senha atual informada está incorreta' }), { status: 401, headers });
          }
        }

        const salt = generateSalt();
        const passwordHash = await hashPassword(newPassword, salt);
        await dbQueries.updateUserPassword(db, user.userId, passwordHash, salt);

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Senha alterada com sucesso! Suas credenciais foram atualizadas com segurança.'
        }), { status: 200, headers });
      }

      // CAMPANHAS (RLS: O usuário só enxerga/cria sob seu ID)
      case 'campaign.list':
      case 'campaigns.list': {
        const campaigns = await dbQueries.getCampaignsByUser(db, user.userId);
        return new Response(JSON.stringify({ sucesso: true, dados: campaigns }), { status: 200, headers });
      }

      case 'campaigns.options': {
        return new Response(JSON.stringify({
          sucesso: true,
          dados: {
            systems: OFFICIAL_SYSTEMS,
            themes: OFFICIAL_THEMES,
            limits: CAMPAIGN_LIMITS
          }
        }), { status: 200, headers });
      }

      case 'campaign.get':
      case 'campaigns.get': {
        const { campaignId, simpleId } = data;
        let campaign = null;
        if (campaignId) {
          campaign = await dbQueries.getCampaignById(db, campaignId);
        } else if (simpleId) {
          campaign = await dbQueries.getCampaignBySimpleId(db, simpleId);
        }
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada' }), { status: 404, headers });
        }
        let parsedSettings = {};
        try {
          parsedSettings = typeof campaign.settings === 'string' ? JSON.parse(campaign.settings || '{}') : (campaign.settings || {});
        } catch (_) {}
        let parsedClock = {};
        try {
          parsedClock = typeof campaign.clock_data === 'string' ? JSON.parse(campaign.clock_data || '{}') : (campaign.clock_data || {});
        } catch (_) {}

        const players = await dbQueries.getCampaignPlayers(db, campaign.id);
        return new Response(JSON.stringify({
          sucesso: true,
          dados: {
            ...campaign,
            settings: parsedSettings,
            clock_data: parsedClock,
            players
          }
        }), { status: 200, headers });
      }

      case 'campaigns.create': {
        // 1. Verificação Estrita de Permissão RBAC (Mestre, Admin ou Superadmin)
        const userRole = String(user.role || '').toLowerCase();
        const allowedRoles = ['mestre', 'admin', 'superadmin'];
        if (!allowedRoles.includes(userRole)) {
          return new Response(JSON.stringify({
            sucesso: false,
            erro: 'Apenas Mestres e Administradores possuem autorização para criar campanhas na Taverna.'
          }), { status: 403, headers });
        }

        const {
          name,
          systemId = 'custom',
          themeId = 'dark-fantasy',
          loreDescription = '',
          imageUrl = '',
          bannerUrl = '',
          maxPlayers = 5
        } = data;

        if (!name || name.trim().length < CAMPAIGN_LIMITS.MIN_NAME_LENGTH) {
          return new Response(JSON.stringify({
            sucesso: false,
            erro: `O nome da campanha deve ter pelo menos ${CAMPAIGN_LIMITS.MIN_NAME_LENGTH} caracteres`
          }), { status: 400, headers });
        }
        if (name.trim().length > CAMPAIGN_LIMITS.MAX_NAME_LENGTH) {
          return new Response(JSON.stringify({
            sucesso: false,
            erro: `O nome da campanha deve ter no máximo ${CAMPAIGN_LIMITS.MAX_NAME_LENGTH} caracteres`
          }), { status: 400, headers });
        }

        // Validação do teto de jogadores (1 a 12)
        const numPlayers = parseInt(maxPlayers, 10) || CAMPAIGN_LIMITS.DEFAULT_PLAYERS;
        if (numPlayers < CAMPAIGN_LIMITS.MIN_PLAYERS || numPlayers > CAMPAIGN_LIMITS.MAX_PLAYERS_GLOBAL) {
          return new Response(JSON.stringify({
            sucesso: false,
            erro: `O limite de jogadores deve ser entre ${CAMPAIGN_LIMITS.MIN_PLAYERS} e ${CAMPAIGN_LIMITS.MAX_PLAYERS_GLOBAL}`
          }), { status: 400, headers });
        }

        const cleanLore = sanitizeText(loreDescription).substring(0, CAMPAIGN_LIMITS.MAX_LORE_LENGTH);
        const cleanName = sanitizeText(name);

        // Geração do ID simples místico único (Opção B: ex: TAVERNA-42)
        const simpleId = await generateUniqueSimpleId(db);
        const campaignId = `cmp_${randomUUID().replace(/-/g, '').substring(0, 12)}`;

        await dbQueries.createCampaign(db, {
          id: campaignId,
          simpleId,
          name: cleanName,
          ownerId: user.userId,
          systemId: typeof systemId === 'string' ? systemId.trim() : 'custom',
          themeId: typeof themeId === 'string' ? themeId.trim() : 'dark-fantasy',
          loreDescription: cleanLore,
          imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() : '',
          bannerUrl: typeof bannerUrl === 'string' ? bannerUrl.trim() : '',
          maxPlayers: numPlayers
        });

        const createdCampaign = await dbQueries.getCampaignById(db, campaignId);

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Campanha forjada com sucesso!',
          dados: createdCampaign
        }), { status: 201, headers });
      }

      case 'campaigns.update': {
        const { campaignId, name, systemId, themeId, sessions, nextSession, description, notices } = data;
        
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha ausente.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o mestre da campanha pode editá-la.' }), { status: 403, headers });
        }

        // Clean text
        const cleanName = name ? sanitizeText(name) : undefined;
        const cleanLore = description ? sanitizeText(description).substring(0, CAMPAIGN_LIMITS.MAX_LORE_LENGTH) : undefined;
        const cleanNextSession = nextSession ? sanitizeText(nextSession) : undefined;
        const cleanNotices = notices ? sanitizeText(notices) : undefined;
        const cleanSystem = systemId ? sanitizeText(systemId).toLowerCase() : undefined;
        const cleanTheme = themeId ? sanitizeText(themeId).toLowerCase() : undefined;

        await dbQueries.updateCampaign(db, campaignId, { 
          name: cleanName, 
          systemId: cleanSystem,
          themeId: cleanTheme,
          sessions, 
          nextSession: cleanNextSession, 
          loreDescription: cleanLore, 
          notices: cleanNotices 
        });

        const updatedCampaign = await dbQueries.getCampaignById(db, campaignId);
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Campanha atualizada com sucesso.', dados: updatedCampaign }), { status: 200, headers });
      }

      case 'campaigns.public': {
        const publicCampaigns = await dbQueries.getPublicCampaigns(db, user.userId);
        return new Response(JSON.stringify({ sucesso: true, dados: publicCampaigns }), { status: 200, headers });
      }

      case 'campaigns.request': {
        if (!data || !data.campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha ausente.' }), { status: 400, headers });
        }

        const targetCampaign = await dbQueries.getCampaignById(db, data.campaignId);
        if (!targetCampaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        // 1. Verificação Estrita de Banimento pelo Mestre da Mesa
        const isBanned = await dbQueries.isPlayerBannedByGM(db, targetCampaign.owner_id, user.userId);
        if (isBanned) {
          return new Response(JSON.stringify({
            sucesso: false,
            erro: 'Você foi banido pelo Mestre desta mesa e não pode se candidatar ou ingressar nas campanhas dele.'
          }), { status: 403, headers });
        }
        
        const requestId = `req_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
        await dbQueries.createCampaignRequest(db, { id: requestId, campaignId: data.campaignId, userId: user.userId });
        
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Solicitação enviada com sucesso!' }), { status: 201, headers });
      }

      case 'campaigns.requests.list': {
        const { campaignId } = data;
        if (!campaignId) return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha ausente.' }), { status: 400, headers });
        
        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        
        // Verificar se é Mestre, Assistente de Mestre ou Admin
        const players = await dbQueries.getCampaignPlayers(db, campaignId);
        const myPlayerRecord = players.find(p => p.user_id === user.userId);
        const isAssistant = myPlayerRecord && myPlayerRecord.role === 'assistente de mestre';
        const isGM = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);

        if (!isGM && !isAssistant && !isAdmin) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre ou Assistente pode visualizar solicitações.' }), { status: 403, headers });
        }
        
        const requests = await dbQueries.getCampaignRequests(db, campaignId);
        return new Response(JSON.stringify({ sucesso: true, dados: requests }), { status: 200, headers });
      }

      case 'campaigns.requests.update':
      case 'campaigns.requests.respond': {
        const { requestId, status, reason = '' } = data;
        const normalizedStatus = status === 'approved' ? 'aceito' : (status === 'rejected' ? 'recusado' : (status === 'banned' ? 'banido' : status));
        if (!requestId || !['aceito', 'recusado', 'banido'].includes(normalizedStatus)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Status de solicitação inválido.' }), { status: 400, headers });
        }
        
        const req = await dbQueries.getCampaignRequestById(db, requestId);
        if (!req) return new Response(JSON.stringify({ sucesso: false, erro: 'Solicitação não encontrada.' }), { status: 404, headers });
        
        const campaign = await dbQueries.getCampaignById(db, req.campaign_id);
        if (!campaign) return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });

        const players = await dbQueries.getCampaignPlayers(db, req.campaign_id);
        const myPlayerRecord = players.find(p => p.user_id === user.userId);
        const isAssistant = myPlayerRecord && myPlayerRecord.role === 'assistente de mestre';
        const isGM = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);

        if (!isGM && !isAssistant && !isAdmin) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não autorizado.' }), { status: 403, headers });
        }
        
        if (normalizedStatus === 'banido') {
          // Apenas o GM dono da mesa ou Admin pode banir em nível de Mestre
          if (!isGM && !isAdmin) {
            return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre da mesa pode banir jogadores.' }), { status: 403, headers });
          }
          await dbQueries.banPlayerFromGM(db, campaign.owner_id, req.user_id, reason || 'Banido ao responder solicitação');
          return new Response(JSON.stringify({ sucesso: true, mensagem: 'Jogador banido de todas as suas mesas com sucesso.' }), { status: 200, headers });
        }

        await dbQueries.updateCampaignRequestStatus(db, requestId, normalizedStatus);
        
        // Se aceito, adiciona o jogador na tabela campaign_players
        if (normalizedStatus === 'aceito') {
          try {
            const stmtPlayer = db.prepare(`
              INSERT OR IGNORE INTO campaign_players (campaign_id, user_id, role)
              VALUES (?, ?, 'jogador')
            `);
            await stmtPlayer.bind(req.campaign_id, req.user_id).run();
          } catch (_) {}
        }
        
        return new Response(JSON.stringify({ sucesso: true, mensagem: `Solicitação ${status === 'aceito' ? 'aceita' : 'recusada'} com sucesso.` }), { status: 200, headers });
      }

      case 'campaigns.players.updateRole':
      case 'campaigns.players.setRole': {
        const { campaignId } = data;
        const targetUserId = data.targetUserId || data.userId || data.playerId;
        const rawRole = String(data.newRole || data.role || '').toLowerCase();
        const newRole = (rawRole === 'assistente' || rawRole === 'assistente de mestre') ? 'assistente de mestre' : (rawRole === 'jogador' ? 'jogador' : null);

        if (!campaignId || !targetUserId || !newRole) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados inválidos para alteração de cargo.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        // Apenas o Mestre (owner) ou Admin/Superadmin pode alterar cargos na campanha
        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o mestre da campanha pode alterar cargos.' }), { status: 403, headers });
        }

        if (targetUserId === campaign.owner_id) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não é possível alterar o cargo do Mestre criador da mesa.' }), { status: 400, headers });
        }

        await dbQueries.updateCampaignPlayerRole(db, campaignId, targetUserId, newRole);
        return new Response(JSON.stringify({ sucesso: true, mensagem: `Cargo do aventureiro atualizado para ${newRole}.` }), { status: 200, headers });
      }

      case 'campaigns.players.kick': {
        const { campaignId } = data;
        const targetUserId = data.targetUserId || data.userId || data.playerId;
        if (!campaignId || !targetUserId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha e usuário alvo são obrigatórios.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const players = await dbQueries.getCampaignPlayers(db, campaignId);
        const myPlayerRecord = players.find(p => p.user_id === user.userId);
        const isAssistant = myPlayerRecord && myPlayerRecord.role === 'assistente de mestre';
        const isGM = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);

        if (!isGM && !isAssistant && !isAdmin) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre ou Assistente pode remover jogadores.' }), { status: 403, headers });
        }

        if (targetUserId === campaign.owner_id) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não é possível expulsar o Mestre da mesa.' }), { status: 400, headers });
        }

        await dbQueries.kickPlayerFromCampaign(db, campaignId, targetUserId);
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Jogador removido da campanha com sucesso.' }), { status: 200, headers });
      }

      case 'campaigns.players.ban': {
        const { campaignId, reason = 'Banido pelo Mestre' } = data;
        const targetUserId = data.targetUserId || data.userId || data.playerId;
        if (!targetUserId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Usuário alvo obrigatório.' }), { status: 400, headers });
        }

        let gmId = user.userId;
        if (campaignId) {
          const campaign = await dbQueries.getCampaignById(db, campaignId);
          if (campaign) {
            if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
              return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre da mesa pode banir jogadores.' }), { status: 403, headers });
            }
            gmId = campaign.owner_id;
          }
        }

        if (targetUserId === gmId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não é possível banir a si mesmo.' }), { status: 400, headers });
        }

        await dbQueries.banPlayerFromGM(db, gmId, targetUserId, reason);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Jogador banido com sucesso de todas as suas mesas (atuais e futuras).'
        }), { status: 200, headers });
      }

      case 'campaigns.players.unban': {
        const targetUserId = data.targetUserId || data.userId || data.playerId;
        if (!targetUserId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Usuário alvo obrigatório.' }), { status: 400, headers });
        }

        await dbQueries.unbanPlayerFromGM(db, user.userId, targetUserId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Banimento revogado com sucesso. O jogador poderá ingressar nas suas mesas novamente.'
        }), { status: 200, headers });
      }

      case 'campaigns.players.listBanned': {
        const bannedList = await dbQueries.listGMBannedPlayers(db, user.userId);
        return new Response(JSON.stringify({
          sucesso: true,
          dados: bannedList
        }), { status: 200, headers });
      }

      case 'campaigns.delete': {
        const { campaignId } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre criador da campanha pode excluí-la.' }), { status: 403, headers });
        }

        await dbQueries.deleteCampaign(db, campaignId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Campanha expurgada permanentemente com sucesso.'
        }), { status: 200, headers });
      }

      // ==========================================
      // CENAS DA CAMPANHA (MODULARES & INTERATIVAS)
      // ==========================================

      case 'campaigns.scenes.list': {
        const { campaignId } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }

        const scenes = await dbQueries.getScenesByCampaign(db, campaignId);
        return new Response(JSON.stringify({
          sucesso: true,
          cenas: scenes,
          dados: scenes
        }), { status: 200, headers });
      }

      case 'campaigns.scenes.get': {
        const { sceneId } = data;
        if (!sceneId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da cena obrigatório.' }), { status: 400, headers });
        }

        const scene = await dbQueries.getSceneById(db, sceneId);
        if (!scene) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Cena não encontrada.' }), { status: 404, headers });
        }

        return new Response(JSON.stringify({
          sucesso: true,
          cena: scene,
          dados: scene
        }), { status: 200, headers });
      }

      case 'campaigns.scenes.create': {
        const {
          campaignId,
          name,
          description = '',
          imageUrl = '',
          model = 'tactical_grid',
          modelData = {},
          rulesData = [],
          styleData = {},
          stateData = {},
          maxPlayers = 12,
          xpTriggers = [],
          isActive = 0
        } = data;

        if (!campaignId || !name || !name.trim()) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha e Nome da cena são obrigatórios.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const currentUid = user.userId || user.id;
        const isOwner = campaign.owner_id === currentUid || String(campaign.owner_id) === String(currentUid) || campaign.created_by === currentUid || String(campaign.created_by) === String(currentUid);
        const isAdmin = ['admin', 'superadmin'].includes(String(user.role || '').toLowerCase());
        const isMasterRole = String(user.role || '').toLowerCase() === 'mestre';
        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, campaignId, currentUid) || 'jogador');
        const isGm = isOwner || isAdmin || isMasterRole || String(playerRole).toLowerCase().includes('mestre') || String(playerRole).toLowerCase().includes('assistente') || String(playerRole).toLowerCase().includes('gm');

        if (!isGm) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre pode criar cenas nesta campanha.' }), { status: 403, headers });
        }

        const sceneId = randomUUID();
        await dbQueries.createScene(db, {
          id: sceneId,
          campaignId,
          name: name.trim(),
          description: description ? description.trim() : '',
          imageUrl: imageUrl ? imageUrl.trim() : '',
          model: model ? model.trim() : 'tactical_grid',
          modelData,
          rulesData,
          styleData,
          stateData,
          maxPlayers: maxPlayers || 12,
          xpTriggers,
          isActive: isActive ? 1 : 0
        });

        const createdScene = await dbQueries.getSceneById(db, sceneId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Cena criada com sucesso!',
          cenaId: sceneId,
          cena: createdScene,
          dados: createdScene
        }), { status: 200, headers });
      }

      case 'campaigns.scenes.update': {
        const {
          sceneId,
          name,
          description,
          imageUrl,
          model,
          modelData,
          rulesData,
          styleData,
          stateData,
          maxPlayers,
          xpTriggers,
          isActive
        } = data;

        if (!sceneId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da cena obrigatório.' }), { status: 400, headers });
        }

        const scene = await dbQueries.getSceneById(db, sceneId);
        if (!scene) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Cena não encontrada.' }), { status: 404, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, scene.campaign_id);
        const currentUid = user.userId || user.id;
        const isOwner = campaign && (campaign.owner_id === currentUid || String(campaign.owner_id) === String(currentUid) || campaign.created_by === currentUid || String(campaign.created_by) === String(currentUid));
        const isAdmin = ['admin', 'superadmin'].includes(String(user.role || '').toLowerCase());
        const isMasterRole = String(user.role || '').toLowerCase() === 'mestre';
        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, scene.campaign_id, currentUid) || 'jogador');
        const isGm = isOwner || isAdmin || isMasterRole || String(playerRole).toLowerCase().includes('mestre') || String(playerRole).toLowerCase().includes('assistente') || String(playerRole).toLowerCase().includes('gm');

        if (!isGm) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre pode editar esta cena.' }), { status: 403, headers });
        }

        await dbQueries.updateScene(db, sceneId, {
          name,
          description,
          imageUrl,
          model,
          modelData,
          rulesData,
          styleData,
          stateData,
          maxPlayers,
          xpTriggers,
          isActive
        });

        const updatedScene = await dbQueries.getSceneById(db, sceneId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Cena atualizada com sucesso!',
          dados: updatedScene
        }), { status: 200, headers });
      }

      case 'campaigns.scenes.delete': {
        const { sceneId } = data;
        if (!sceneId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da cena obrigatório.' }), { status: 400, headers });
        }

        const scene = await dbQueries.getSceneById(db, sceneId);
        if (!scene) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Cena não encontrada.' }), { status: 404, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, scene.campaign_id);
        const currentUid = user.userId || user.id;
        const isOwner = campaign && (campaign.owner_id === currentUid || String(campaign.owner_id) === String(currentUid) || campaign.created_by === currentUid || String(campaign.created_by) === String(currentUid));
        const isAdmin = ['admin', 'superadmin'].includes(String(user.role || '').toLowerCase());
        const isMasterRole = String(user.role || '').toLowerCase() === 'mestre';
        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, scene.campaign_id, currentUid) || 'jogador');
        const isGm = isOwner || isAdmin || isMasterRole || String(playerRole).toLowerCase().includes('mestre') || String(playerRole).toLowerCase().includes('assistente') || String(playerRole).toLowerCase().includes('gm');

        if (!isGm) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre pode excluir esta cena.' }), { status: 403, headers });
        }

        await dbQueries.deleteScene(db, sceneId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Cena excluída com sucesso.'
        }), { status: 200, headers });
      }

      case 'campaigns.scenes.setActive': {
        const { campaignId, sceneId } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const currentUid = user.userId || user.id;
        const isOwner = campaign.owner_id === currentUid || String(campaign.owner_id) === String(currentUid) || campaign.created_by === currentUid || String(campaign.created_by) === String(currentUid);
        const isAdmin = ['admin', 'superadmin'].includes(String(user.role || '').toLowerCase());
        const isMasterRole = String(user.role || '').toLowerCase() === 'mestre';
        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, campaignId, currentUid) || 'jogador');
        const isGm = isOwner || isAdmin || isMasterRole || String(playerRole).toLowerCase().includes('mestre') || String(playerRole).toLowerCase().includes('assistente') || String(playerRole).toLowerCase().includes('gm');

        if (!isGm) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre pode definir a cena ativa da mesa.' }), { status: 403, headers });
        }

        await dbQueries.setActiveScene(db, campaignId, sceneId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Cena ativa definida com sucesso!'
        }), { status: 200, headers });
      }

      case 'campaigns.scenes.updateState': {
        const { sceneId, stateData } = data;
        if (!sceneId || !stateData) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da cena e estado são obrigatórios.' }), { status: 400, headers });
        }

        await dbQueries.updateSceneState(db, sceneId, stateData);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Estado da cena sincronizado.'
        }), { status: 200, headers });
      }

      case 'campaigns.scenes.triggerAction': {
        const { sceneId, triggerType, triggerParams = {}, characterId } = data;
        if (!sceneId || !triggerType) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da cena e tipo de gatilho são obrigatórios.' }), { status: 400, headers });
        }

        const scene = await dbQueries.getSceneById(db, sceneId);
        if (!scene) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Cena não encontrada.' }), { status: 404, headers });
        }

        let rules = [];
        try {
          rules = typeof scene.rules_data === 'string' ? JSON.parse(scene.rules_data) : (scene.rules_data || []);
        } catch (_) {}

        // Encontra regras que combinam com o gatilho
        const matchingRules = rules.filter(r => {
          if (r.when !== triggerType) return false;
          if (triggerType === 'on_tile_click' || triggerType === 'on_tile_enter') {
            return (r.params?.x === triggerParams.x && r.params?.y === triggerParams.y) || (!r.params?.x && !r.params?.y);
          }
          return true;
        });

        const executedEffects = [];
        let updatedSheet = null;

        // Se houver personagem associado, podemos aplicar efeitos na ficha
        let char = null;
        if (characterId) {
          char = await dbQueries.getCharacterById(db, characterId);
        }

        for (const rule of matchingRules) {
          const effect = rule.then;
          const effectParams = rule.effectParams || {};

          // 1. Dano / Cura na Anima
          if (effect === 'apply_damage' || effect === 'heal_anima') {
            const amount = Number(effectParams.amount) || 1;
            if (char) {
              let sheet = {};
              try { sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data) : (char.sheet_data || {}); } catch(_) {}
              const curAnima = sheet.anima !== undefined ? sheet.anima : (sheet.max_anima || 10);
              const maxAnima = sheet.max_anima || 10;
              
              const newAnima = effect === 'apply_damage' 
                ? Math.max(0, curAnima - amount) 
                : Math.min(maxAnima, curAnima + amount);
              
              sheet.anima = newAnima;
              await dbQueries.updateCharacterSheet(db, char.id, sheet);
              updatedSheet = sheet;
              executedEffects.push({ effect, amount, newAnima });
            }
          }
          // 2. Concessão de XP
          else if (effect === 'award_xp') {
            const xpAmount = Number(effectParams.amount) || 1;
            if (char) {
              let sheet = {};
              try { sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data) : (char.sheet_data || {}); } catch(_) {}
              sheet.xp = (Number(sheet.xp) || 0) + xpAmount;
              await dbQueries.updateCharacterSheet(db, char.id, sheet);
              updatedSheet = sheet;
              executedEffects.push({ effect, amount: xpAmount, totalXp: sheet.xp });
            }
          }
          // 3. Concessão de Item
          else if (effect === 'award_item') {
            const itemName = effectParams.itemName || 'Item Encontrado';
            if (char) {
              let sheet = {};
              try { sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data) : (char.sheet_data || {}); } catch(_) {}
              sheet.inventario = Array.isArray(sheet.inventario) ? sheet.inventario : [];
              sheet.inventario.push({
                nome: itemName,
                descricao: effectParams.itemDesc || 'Item obtido em cena',
                quantidade: Number(effectParams.quantidade) || 1
              });
              await dbQueries.updateCharacterSheet(db, char.id, sheet);
              updatedSheet = sheet;
              executedEffects.push({ effect, itemName });
            }
          }
          // 4. Deletar ou Alterar Tile da Cena
          else if (effect === 'delete_tile' || effect === 'change_tile') {
            let modelData = {};
            try { modelData = typeof scene.model_data === 'string' ? JSON.parse(scene.model_data) : (scene.model_data || {}); } catch(_) {}
            const layer = effectParams.layer || 'layer2';
            const x = effectParams.x !== undefined ? effectParams.x : triggerParams.x;
            const y = effectParams.y !== undefined ? effectParams.y : triggerParams.y;
            const newTileVal = effect === 'delete_tile' ? 0 : (effectParams.newTileId || 0);

            if (modelData[layer] && Array.isArray(modelData[layer][y])) {
              modelData[layer][y][x] = newTileVal;
              await dbQueries.updateScene(db, sceneId, { modelData });
              executedEffects.push({ effect, layer, x, y, newTileVal });
            }
          }
          // 5. Transição / Teleporte para outra Cena
          else if (effect === 'transfer_scene') {
            const targetSceneId = effectParams.targetSceneId;
            executedEffects.push({ effect: 'transfer_scene', targetSceneId });
          }
          // 6. Registro no Diário
          else if (effect === 'log_diary') {
            const logText = effectParams.text || 'Acontecimento registrado na cena.';
            executedEffects.push({ effect: 'log_diary', text: logText });
          }
        }

        return new Response(JSON.stringify({
          sucesso: true,
          executedEffects,
          updatedSheet
        }), { status: 200, headers });
      }

      // PERSONAGENS: As ações 'characters.list', 'characters.create', 'characters.get', 'characters.listHierarchical'
      // e 'campaigns.characters.list' estão integradas na seção do AlphaD6 / Motor RPG abaixo.

      case 'characters.update': {
        const { characterId, sheetData } = data;
        if (!characterId || !sheetData) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados insuficientes para atualização' }), { status: 400, headers });
        }
        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado' }), { status: 404, headers });
        }
        // RLS: Apenas o dono ou admin pode alterar a ficha
        if (char.user_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o proprietário pode editar a ficha' }), { status: 403, headers });
        }
        await dbQueries.updateCharacterSheet(db, characterId, sheetData);
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Ficha atualizada com sucesso!' }), { status: 200, headers });
      }

      // MOTOR DE REGRAS E ROLAGEM DE DADOS RPG
      case 'rpg.rollPool': {
        const { dadosCount, dificuldade, atributo, especializacao, vantagens, ajudas } = data;
        const result = rpgEngineService.evaluateD6Pool({
          dadosCount,
          dificuldade,
          atributo,
          especializacao,
          vantagens,
          ajudas
        });
        return new Response(JSON.stringify({
          sucesso: true,
          autor: user.displayName || user.email,
          userId: user.userId,
          dados: result
        }), { status: 200, headers });
      }

      case 'rpg.rollFree': {
        const { expressao } = data;
        try {
          const result = rpgEngineService.parseAndRollFreeExpression(expressao);
          return new Response(JSON.stringify({
            sucesso: true,
            autor: user.displayName || user.email,
            userId: user.userId,
            dados: result
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'rpg.opposedRoll': {
        const { rollA, rollB, nomeA, nomeB } = data;
        try {
          const result = rpgEngineService.resolveOpposedRoll(rollA, rollB, nomeA, nomeB);
          return new Response(JSON.stringify({
            sucesso: true,
            dados: result
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      // ==========================================
      // CHAT DA CAMPANHA & PERSISTÊNCIA EM TEMPO REAL
      // ==========================================
      case 'chat.getHistory': {
        const { campaignId, limit = 50, beforeTimestamp = null } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha é obrigatório.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const isPlayer = await dbQueries.isUserInCampaign(db, campaignId, user.userId);
        const isOwner = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);

        if (!isPlayer && !isOwner && !isAdmin) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Você não participa desta campanha.' }), { status: 403, headers });
        }

        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, campaignId, user.userId) || 'jogador');
        const isGm = isOwner || isAdmin || playerRole.toLowerCase().includes('mestre') || playerRole.toLowerCase().includes('assistente');

        const messages = await dbQueries.getCampaignMessages(db, campaignId, {
          limit,
          beforeTimestamp,
          userId: user.userId,
          isGm
        });

        return new Response(JSON.stringify({
          sucesso: true,
          dados: messages,
          mensagens: messages,
          userRole: playerRole,
          isGm,
          campaignId
        }), { status: 200, headers });
      }

      case 'chat.send': {
        const {
          campaignId,
          content,
          msgType = 'ic',
          authorName = null,
          authorAvatar = null,
          authorRole = null,
          characterId = null,
          replyTo = null,
          whisperTarget = null,
          persona = null
        } = data;

        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha é obrigatório.' }), { status: 400, headers });
        }

        if (!content || typeof content !== 'string' || !content.trim()) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Mensagem vazia não pode ser enviada.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const isPlayer = await dbQueries.isUserInCampaign(db, campaignId, user.userId);
        const isOwner = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);

        if (!isPlayer && !isOwner && !isAdmin) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Você não tem permissão para falar nesta campanha.' }), { status: 403, headers });
        }

        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, campaignId, user.userId) || 'jogador');
        const isGm = isOwner || isAdmin || playerRole.toLowerCase().includes('mestre') || playerRole.toLowerCase().includes('assistente');

        let finalAuthorName = authorName || (persona?.name || null);
        let finalAuthorAvatar = authorAvatar || (persona?.avatar || '');
        let finalAuthorRole = authorRole || (isGm ? 'mestre' : 'jogador');
        let finalCharacterId = characterId;
        let finalMsgType = (persona?.type && persona.type !== 'ic' && msgType === 'ic') ? persona.type : msgType;
        let finalMetadata = replyTo ? { reply_to: replyTo } : {};
        let finalWhisperTargetId = null;
        let rawContent = content.trim();

        let charSheet = null;
        if (!finalCharacterId && !isGm) {
          const char = await dbQueries.getCharacterByUserAndCampaign(db, user.userId, campaignId);
          if (char) {
            finalCharacterId = char.id;
            if (!finalAuthorName) finalAuthorName = char.name;
            try {
              charSheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data) : char.sheet_data;
            } catch (_) {}
          }
        } else if (finalCharacterId) {
          const char = await dbQueries.getCharacterById(db, finalCharacterId);
          if (char) {
            if (!finalAuthorName) finalAuthorName = char.name;
            try {
              charSheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data) : char.sheet_data;
            } catch (_) {}
          }
        }

        if (!finalAuthorName) {
          finalAuthorName = isGm ? 'Mestre' : (user.displayName || user.email);
        }

        // --- PARSER DE COMANDOS DE CHAT ---

        // 1. Rolagens (/roll, /r, /gmroll, /gr)
        if (rawContent.startsWith('/roll') || rawContent.startsWith('/r ') || rawContent === '/r' || rawContent.startsWith('/gmroll') || rawContent.startsWith('/gr ') || rawContent === '/gr') {
          const rollResult = rpgEngineService.parseChatRollCommand(rawContent, charSheet);
          if (!rollResult) {
            return new Response(JSON.stringify({ sucesso: false, erro: 'Comando de rolagem inválido.' }), { status: 400, headers });
          }

          finalMsgType = 'roll';
          let textoFormatado = '';
          if (rollResult.tipo === 'rolagem_livre') {
            const modStr = rollResult.modificador !== 0 ? (rollResult.modificador > 0 ? ` + ${rollResult.modificador}` : ` - ${Math.abs(rollResult.modificador)}`) : '';
            textoFormatado = `🎲 Rolou ${rollResult.expressaoOriginal}: <strong>[ ${rollResult.dados.join(', ')} ]</strong>${modStr} = <strong>${rollResult.total}</strong>`;
          } else if (rollResult.tipo === 'pool_d6') {
            const vereditoLabel = rollResult.veredicto === 'SUCESSO_TOTAL' ? 'SUCESSO TOTAL' : (rollResult.veredicto === 'SUCESSO_PARCIAL' ? 'SUCESSO PARCIAL' : 'FALHA TOTAL');
            const attrLabel = rollResult.atributo ? ` (${rollResult.atributo.toUpperCase()})` : '';
            const qtdSucessos = rollResult.totalSucessos !== undefined ? rollResult.totalSucessos : (Array.isArray(rollResult.sucessos) ? rollResult.sucessos.length : 0);
            const sucessosStr = qtdSucessos > 0 ? ` (Dados $\\ge 4$: [ ${rollResult.sucessos.join(', ')} ])` : '';
            textoFormatado = `🎲 Teste AlphaD6${attrLabel} [${rollResult.dadosCount}d6]: <strong>[ ${rollResult.dados.join(', ')} ]</strong> ➔ <strong>${qtdSucessos} Sucesso(s)</strong>${sucessosStr} (${vereditoLabel})`;
          }


          finalMetadata = {
            ...finalMetadata,
            roll_data: rollResult
          };

          if (rollResult.isSecret) {
            finalWhisperTargetId = campaign.owner_id;
            finalMetadata.isSecret = true;
          }

          rawContent = textoFormatado;
        }
        // 2. Descanso (/descanso ou /rest)
        else if (rawContent.startsWith('/descanso') || rawContent.startsWith('/rest')) {
          const isLongo = rawContent.toLowerCase().includes('longo');
          const tipoDescanso = isLongo ? 'longo' : 'curto';

          let autoApprove = 1;
          if (campaign.settings) {
            try {
              const s = typeof campaign.settings === 'string' ? JSON.parse(campaign.settings) : campaign.settings;
              if (s.auto_approve_actions !== undefined) autoApprove = Number(s.auto_approve_actions);
            } catch (_) {}
          }

          if (autoApprove === 0 && !isGm) {
            finalMsgType = 'action_card';
            const duraHoras = isLongo ? 8 : 1;
            const curaPrevista = isLongo ? 6 : 2;
            finalMetadata = {
              ...finalMetadata,
              action_data: {
                tipo: 'descanso',
                tipoDescanso,
                status: 'pendente',
                duracaoHoras: duraHoras,
                curaAnima: curaPrevista,
                characterId: finalCharacterId,
                characterName: finalAuthorName,
                solicitanteUserId: user.userId
              }
            };
            rawContent = `🛌 <strong>${finalAuthorName}</strong> solicitou um <strong>Descanso ${tipoDescanso.toUpperCase()}</strong> (${duraHoras}h). Aguardando autorização do Mestre.`;
          } else {
            finalMsgType = 'roll';
            let currentAnima = 10;
            let maxAnima = 20;
            if (charSheet) {
              currentAnima = charSheet.anima !== undefined ? charSheet.anima : 10;
              maxAnima = charSheet.max_anima || 20;
            }
            const restResult = rpgEngineService.applyRest({ tipo: tipoDescanso, currentAnima, maxAnima });
            if (finalCharacterId && charSheet) {
              charSheet.anima = restResult.animaAtual;
              charSheet.passagem_para_o_vazio = false;
              await dbQueries.updateCharacterSheet(db, finalCharacterId, charSheet);
            }
            let clock = null;
            try {
              clock = typeof campaign.clock_data === 'string' ? JSON.parse(campaign.clock_data) : campaign.clock_data;
            } catch (_) {}
            const updatedClock = rpgEngineService.advanceWorldClock(clock, { hours: restResult.duracaoHoras });
            await dbQueries.updateCampaignClock(db, campaignId, updatedClock);

            finalMetadata = {
              ...finalMetadata,
              rest_result: restResult,
              clock: updatedClock
            };
            rawContent = `🛌 <strong>${finalAuthorName}</strong> concluiu um <strong>Descanso ${tipoDescanso.toUpperCase()}</strong>! (+${restResult.efetivamenteCurado} Anima). Relógio avançou ${restResult.duracaoHoras}h.`;
          }
        }
        // 3. Emotes / Ações (/me [ação])
        else if (rawContent.startsWith('/me ')) {
          finalMsgType = 'acao';
          rawContent = rawContent.substring(4).trim();
        }
        // 4. Fora do Jogo (/ooc [texto] ou // [texto])
        else if (rawContent.startsWith('/ooc ') || rawContent.startsWith('//')) {
          finalMsgType = 'ooc';
          rawContent = rawContent.startsWith('/ooc ') ? rawContent.substring(5).trim() : rawContent.substring(2).trim();
        }
        // 5. Narração do Mestre (/gm [texto] ou /nar [texto])
        else if (rawContent.startsWith('/gm ') || rawContent.startsWith('/nar ')) {
          if (isGm) {
            finalMsgType = 'narracao';
            finalAuthorName = 'Narrador';
            finalAuthorRole = 'mestre';
            rawContent = rawContent.startsWith('/gm ') ? rawContent.substring(4).trim() : rawContent.substring(5).trim();
          }
        }
        // 6. Fala de NPC (/npc [Nome] [texto])
        else if (rawContent.startsWith('/npc ') && isGm) {
          const afterNpc = rawContent.substring(5).trim();
          const firstSpace = afterNpc.indexOf(' ');
          if (firstSpace > 0) {
            const npcName = afterNpc.substring(0, firstSpace).trim();
            const npcSpeech = afterNpc.substring(firstSpace + 1).trim();
            finalAuthorName = npcName;
            finalAuthorRole = 'npc';
            finalMsgType = 'ic';
            rawContent = npcSpeech;
          }
        }
        // 7. Sussurro (/w [alvo] [mensagem] ou /whisper [alvo] [mensagem])
        else if (rawContent.startsWith('/w ') || rawContent.startsWith('/whisper ')) {
          const prefixLen = rawContent.startsWith('/whisper ') ? 9 : 3;
          const rest = rawContent.substring(prefixLen).trim();
          const firstSpace = rest.indexOf(' ');
          if (firstSpace > 0) {
            const targetName = rest.substring(0, firstSpace).trim().toLowerCase();
            const whisperMsg = rest.substring(firstSpace + 1).trim();

            if (targetName === 'mestre' || targetName === 'gm') {
              finalWhisperTargetId = campaign.owner_id;
              finalMetadata.targetName = 'Mestre';
            } else {
              const players = await dbQueries.getCampaignPlayers(db, campaignId);
              const matchPlayer = players.find(p => 
                (p.display_name && p.display_name.toLowerCase().includes(targetName)) ||
                (p.name && p.name.toLowerCase().includes(targetName)) ||
                (p.nickname && p.nickname.toLowerCase().includes(targetName))
              );
              if (matchPlayer) {
                finalWhisperTargetId = matchPlayer.user_id;
                finalMetadata.targetName = matchPlayer.display_name || matchPlayer.name || targetName;
              } else {
                finalWhisperTargetId = campaign.owner_id;
                finalMetadata.targetName = targetName;
              }
            }

            finalMsgType = 'whisper';
            rawContent = whisperMsg;
          }
        }

        // Se o autor selecionou explicitamente falar como Narrador, NPC ou OOC
        if (msgType === 'narracao' && isGm) {
          finalMsgType = 'narracao';
          finalAuthorName = authorName || 'Narrador';
          finalAuthorRole = 'mestre';
        } else if (msgType === 'ooc') {
          finalMsgType = 'ooc';
        } else if (msgType === 'acao') {
          finalMsgType = 'acao';
        }

        const savedMsg = await dbQueries.saveCampaignMessage(db, {
          campaignId,
          userId: user.userId,
          characterId: finalCharacterId,
          authorName: finalAuthorName,
          authorAvatar: finalAuthorAvatar,
          authorRole: finalAuthorRole,
          msgType: finalMsgType,
          content: rawContent,
          metadata: finalMetadata,
          whisperTargetId: finalWhisperTargetId
        });

        return new Response(JSON.stringify({
          sucesso: true,
          dados: savedMsg,
          mensagem: savedMsg
        }), { status: 200, headers });
      }

      case 'chat.editMessage': {
        const { campaignId, messageId, content } = data;
        if (!campaignId || !messageId || !content || !content.trim()) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha, da mensagem e conteúdo são obrigatórios.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const msg = await dbQueries.getCampaignMessageById(db, messageId);
        if (!msg || msg.campaign_id !== campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Mensagem não encontrada.' }), { status: 404, headers });
        }

        const isOwner = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);
        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, campaignId, user.userId) || 'jogador');
        const isGm = isOwner || isAdmin || playerRole.toLowerCase().includes('mestre') || playerRole.toLowerCase().includes('assistente');
        const isAuthor = msg.user_id === user.userId;

        if (!isAuthor && !isGm) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Você não tem permissão para editar esta mensagem.' }), { status: 403, headers });
        }

        // Não permite editar mensagens de dados ou cards de ação para preservar histórico íntegro
        if (msg.msg_type === 'roll' || msg.msg_type === 'action_card') {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Rolagens de dados e cartas de ação não podem ser editadas.' }), { status: 400, headers });
        }

        await dbQueries.updateCampaignMessageContent(db, messageId, campaignId, sanitizeText(content.trim(), 2000));
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Mensagem editada com sucesso.'
        }), { status: 200, headers });
      }

      case 'chat.deleteMessage': {
        const { campaignId, messageId } = data;
        if (!campaignId || !messageId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha e da mensagem são obrigatórios.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const msg = await dbQueries.getCampaignMessageById(db, messageId);
        if (!msg || msg.campaign_id !== campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Mensagem não encontrada.' }), { status: 404, headers });
        }

        const isOwner = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);
        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, campaignId, user.userId) || 'jogador');
        const isGm = isOwner || isAdmin || playerRole.toLowerCase().includes('mestre') || playerRole.toLowerCase().includes('assistente');
        const isAuthor = msg.user_id === user.userId;

        if (!isAuthor && !isGm) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Você não tem permissão para apagar esta mensagem.' }), { status: 403, headers });
        }

        await dbQueries.deleteCampaignMessage(db, messageId, campaignId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Mensagem apagada com sucesso.'
        }), { status: 200, headers });
      }

      case 'chat.clearHistory': {
        const { campaignId } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha é obrigatório.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const isOwner = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);

        if (!isOwner && !isAdmin) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre da campanha pode limpar o histórico do chat.' }), { status: 403, headers });
        }

        await dbQueries.clearAllCampaignMessages(db, campaignId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Histórico de chat da campanha limpo com sucesso.'
        }), { status: 200, headers });
      }

      case 'chat.respondActionCard': {
        const { campaignId, messageId, acao } = data;
        if (!campaignId || !messageId || !acao) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados incompletos para resposta da ação.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        const isOwner = campaign.owner_id === user.userId;
        const isAdmin = ['admin', 'superadmin'].includes(user.role);
        const playerRole = isOwner ? 'mestre' : (await dbQueries.getCampaignPlayerRole(db, campaignId, user.userId) || 'jogador');
        const isGm = isOwner || isAdmin || playerRole.toLowerCase().includes('mestre') || playerRole.toLowerCase().includes('assistente');

        if (!isGm) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre ou Assistente pode autorizar/recusar solicitações.' }), { status: 403, headers });
        }

        const msg = await dbQueries.getCampaignMessageById(db, messageId);
        if (!msg || msg.campaign_id !== campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Mensagem de ação não encontrada.' }), { status: 404, headers });
        }

        let metadata = msg.metadata || {};
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch (_) { metadata = {}; }
        }

        const actionData = metadata.action_data;
        if (!actionData) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Esta mensagem não possui uma ação pendente vinculada.' }), { status: 400, headers });
        }

        if (actionData.status !== 'pendente') {
          return new Response(JSON.stringify({ sucesso: false, erro: `Esta solicitação já foi respondida (${actionData.status}).` }), { status: 400, headers });
        }

        if (acao === 'aceitar') {
          actionData.status = 'aprovado';
          actionData.respondidoPor = user.displayName || 'Mestre';
          actionData.respondidoEm = new Date().toISOString();

          if (actionData.tipo === 'descanso' && actionData.characterId) {
            const char = await dbQueries.getCharacterById(db, actionData.characterId);
            if (char) {
              let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
              const maxAnima = sheet.max_anima || 20;
              const currentAnima = sheet.anima !== undefined ? sheet.anima : 10;
              const curaAnima = actionData.curaAnima || 2;
              sheet.anima = Math.min(maxAnima, currentAnima + curaAnima);
              sheet.passagem_para_o_vazio = false;
              await dbQueries.updateCharacterSheet(db, actionData.characterId, sheet);
            }

            let clock = null;
            try {
              clock = typeof campaign.clock_data === 'string' ? JSON.parse(campaign.clock_data) : campaign.clock_data;
            } catch (_) {}
            const updatedClock = rpgEngineService.advanceWorldClock(clock, { hours: actionData.duracaoHoras || 1 });
            await dbQueries.updateCampaignClock(db, campaignId, updatedClock);
            actionData.relogio = updatedClock;
          }
        } else {
          actionData.status = 'recusado';
          actionData.respondidoPor = user.displayName || 'Mestre';
          actionData.respondidoEm = new Date().toISOString();
        }

        metadata.action_data = actionData;
        await dbQueries.updateCampaignMessageMetadata(db, messageId, metadata);

        return new Response(JSON.stringify({
          sucesso: true,
          actionData,
          mensagem: `Solicitação ${acao === 'aceitar' ? 'aprovada' : 'recusada'} com sucesso.`
        }), { status: 200, headers });
      }

      case 'rpg.chatCommand': {

        const { comando, command, characterId, campaignId } = data;
        const cmd = comando || command;
        if (!cmd || typeof cmd !== 'string') {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Comando não fornecido' }), { status: 400, headers });
        }

        let characterSheet = null;
        let charId = characterId;

        // Se não foi passado characterId mas veio campaignId, busca o personagem do jogador na campanha
        if (!charId && campaignId) {
          const char = await dbQueries.getCharacterByUserAndCampaign(db, user.userId, campaignId);
          if (char) {
            charId = char.id;
            try {
              characterSheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data) : char.sheet_data;
            } catch (_) {}
          }
        } else if (charId) {
          const char = await dbQueries.getCharacterById(db, charId);
          if (char && char.sheet_data) {
            try {
              characterSheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data) : char.sheet_data;
            } catch (_) {}
          }
        }

        try {
          const result = rpgEngineService.parseChatRollCommand(cmd, characterSheet);
          if (!result) {
            return new Response(JSON.stringify({ sucesso: false, erro: 'Comando de rolagem não reconhecido' }), { status: 400, headers });
          }

          // Gera mensagem de texto humanizada para o chat
          let textoFormatado = '';
          if (result.tipo === 'rolagem_livre') {
            const modStr = result.modificador !== 0 ? (result.modificador > 0 ? ` + ${result.modificador}` : ` - ${Math.abs(result.modificador)}`) : '';
            textoFormatado = `🎲 Rolou ${result.expressaoOriginal}: <strong>[ ${result.dados.join(', ')} ]</strong>${modStr} = <strong>${result.total}</strong>`;
          } else if (result.tipo === 'pool_d6') {
            const vereditoLabel = result.veredicto === 'SUCESSO_TOTAL' ? 'SUCESSO TOTAL' : (result.veredicto === 'SUCESSO_PARCIAL' ? 'SUCESSO PARCIAL' : 'FALHA TOTAL');
            const attrLabel = result.atributo ? ` (${result.atributo.toUpperCase()})` : '';
            textoFormatado = `🎲 Teste AlphaD6${attrLabel} [${result.dadosCount}d6]: <strong>[ ${result.dados.join(', ')} ]</strong> ➔ <strong>${result.sucessos} Sucesso(s)</strong> (${vereditoLabel})`;
          }

          return new Response(JSON.stringify({
            sucesso: true,
            autor: user.displayName || user.email,
            userId: user.userId,
            characterId: charId || null,
            dados: {
              ...result,
              texto: textoFormatado
            }
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'rpg.damage': {
        const { characterId, dano } = data;
        if (!characterId || dano === undefined) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem e valor do dano são obrigatórios.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
        const currentAnima = sheet.anima !== undefined ? sheet.anima : 15;
        const damageResult = rpgEngineService.applyAnimaDamage({ currentAnima, dano });

        sheet.anima = damageResult.animaAtual;
        sheet.passagem_para_o_vazio = damageResult.passagemParaOVazio;
        await dbQueries.updateCharacterSheet(db, characterId, sheet);

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: damageResult.descricao,
          dados: {
            characterId,
            ...damageResult
          }
        }), { status: 200, headers });
      }

      case 'rpg.rest': {
        const { characterId, campaignId, tipo = 'curto', customRoll = null } = data;
        if (!characterId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem é obrigatório.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        let campaign = null;
        let autoApprove = 1; // Default
        if (campaignId) {
          campaign = await dbQueries.getCampaignById(db, campaignId);
          if (campaign && campaign.settings) {
            try {
              const campSettings = typeof campaign.settings === 'string' ? JSON.parse(campaign.settings) : campaign.settings;
              if (campSettings.auto_approve_actions !== undefined) {
                autoApprove = Number(campSettings.auto_approve_actions);
              }
            } catch (_) {}
          }
        }

        const isMaster = campaign && (campaign.owner_id === user.userId || ['admin', 'superadmin'].includes(user.role));

        // Se requer aprovação manual e não é o mestre solicitando
        if (autoApprove === 0 && !isMaster) {
          return new Response(JSON.stringify({
            sucesso: true,
            requerAprovacao: true,
            pendente: true,
            mensagem: `Solicitação de ${tipo} enviada ao Mestre para aprovação.`,
            dados: {
              actionType: 'rest',
              tipo,
              characterId,
              characterName: char.name,
              userId: user.userId,
              campaignId,
              customRoll
            }
          }), { status: 200, headers });
        }

        // Executa o descanso
        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
        const currentAnima = sheet.anima !== undefined ? sheet.anima : 10;
        const maxAnima = sheet.max_anima || 20;

        const restResult = rpgEngineService.applyRest({ tipo, currentAnima, maxAnima, customRoll });
        sheet.anima = restResult.animaAtual;
        sheet.passagem_para_o_vazio = false;
        await dbQueries.updateCharacterSheet(db, characterId, sheet);

        let updatedClock = null;
        if (campaign && campaign.id) {
          let clock = null;
          try {
            clock = typeof campaign.clock_data === 'string' ? JSON.parse(campaign.clock_data) : campaign.clock_data;
          } catch (_) {}
          updatedClock = rpgEngineService.advanceWorldClock(clock, { hours: restResult.duracaoHoras });
          await dbQueries.updateCampaignClock(db, campaign.id, updatedClock);
        }

        return new Response(JSON.stringify({
          sucesso: true,
          aprovado: true,
          mensagem: `${char.name} concluiu um ${restResult.nomeDescanso} e recuperou ${restResult.efetivamenteCurado} pontos de Anima.`,
          dados: {
            ...restResult,
            relogio: updatedClock
          }
        }), { status: 200, headers });
      }

      case 'rpg.heal': {
        const { characterId, campaignId, tipo = 'emergencia', itensCuraDisponiveis = 3 } = data;
        if (!characterId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem é obrigatório.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        let campaign = null;
        let autoApprove = 1;
        if (campaignId) {
          campaign = await dbQueries.getCampaignById(db, campaignId);
          if (campaign && campaign.settings) {
            try {
              const campSettings = typeof campaign.settings === 'string' ? JSON.parse(campaign.settings) : campaign.settings;
              if (campSettings.auto_approve_actions !== undefined) {
                autoApprove = Number(campSettings.auto_approve_actions);
              }
            } catch (_) {}
          }
        }

        const isMaster = campaign && (campaign.owner_id === user.userId || ['admin', 'superadmin'].includes(user.role));

        if (autoApprove === 0 && !isMaster) {
          return new Response(JSON.stringify({
            sucesso: true,
            requerAprovacao: true,
            pendente: true,
            mensagem: `Solicitação de restauração (${tipo}) enviada ao Mestre para aprovação.`,
            dados: {
              actionType: 'heal',
              tipo,
              characterId,
              characterName: char.name,
              userId: user.userId,
              campaignId,
              itensCuraDisponiveis
            }
          }), { status: 200, headers });
        }

        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
        const currentAnima = sheet.anima !== undefined ? sheet.anima : 10;
        const maxAnima = sheet.max_anima || 20;

        try {
          const healResult = rpgEngineService.applyRestoration({ tipo, currentAnima, maxAnima, itensCuraDisponiveis });
          sheet.anima = healResult.animaAtual;
          sheet.passagem_para_o_vazio = false;
          await dbQueries.updateCharacterSheet(db, characterId, sheet);

          let updatedClock = null;
          if (campaign && campaign.id && healResult.duracaoHoras > 0) {
            let clock = null;
            try {
              clock = typeof campaign.clock_data === 'string' ? JSON.parse(campaign.clock_data) : campaign.clock_data;
            } catch (_) {}
            updatedClock = rpgEngineService.advanceWorldClock(clock, { hours: healResult.duracaoHoras });
            await dbQueries.updateCampaignClock(db, campaign.id, updatedClock);
          }

          return new Response(JSON.stringify({
            sucesso: true,
            aprovado: true,
            mensagem: `${char.name} recebeu ${healResult.nomeRestauracao} e recuperou ${healResult.efetivamenteCurado} pontos de Anima.`,
            dados: {
              ...healResult,
              relogio: updatedClock
            }
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'rpg.actionApprove': {
        const { actionType, characterId, campaignId, tipo, customRoll, itensCuraDisponiveis } = data;
        if (!campaignId || !characterId || !actionType) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados insuficientes para aprovação.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o mestre ou administrador pode aprovar ações.' }), { status: 403, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
        const currentAnima = sheet.anima !== undefined ? sheet.anima : 10;
        const maxAnima = sheet.max_anima || 20;

        let resultData = null;
        let horasAvanco = 0;

        if (actionType === 'rest') {
          resultData = rpgEngineService.applyRest({ tipo, currentAnima, maxAnima, customRoll });
          horasAvanco = resultData.duracaoHoras;
        } else if (actionType === 'heal') {
          resultData = rpgEngineService.applyRestoration({ tipo, currentAnima, maxAnima, itensCuraDisponiveis: itensCuraDisponiveis ?? 3 });
          horasAvanco = resultData.duracaoHoras;
        } else {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Tipo de ação desconhecido.' }), { status: 400, headers });
        }

        sheet.anima = resultData.animaAtual;
        sheet.passagem_para_o_vazio = false;
        await dbQueries.updateCharacterSheet(db, characterId, sheet);

        let updatedClock = null;
        if (horasAvanco > 0) {
          let clock = null;
          try {
            clock = typeof campaign.clock_data === 'string' ? JSON.parse(campaign.clock_data) : campaign.clock_data;
          } catch (_) {}
          updatedClock = rpgEngineService.advanceWorldClock(clock, { hours: horasAvanco });
          await dbQueries.updateCampaignClock(db, campaign.id, updatedClock);
        }

        return new Response(JSON.stringify({
          sucesso: true,
          aprovado: true,
          mensagem: `Ação de ${actionType} aprovada pelo Mestre para ${char.name}.`,
          dados: {
            ...resultData,
            relogio: updatedClock
          }
        }), { status: 200, headers });
      }

      case 'rpg.actionReject': {
        const { characterId, campaignId, actionType, motivo } = data;
        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign || (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role))) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não autorizado a rejeitar ações.' }), { status: 403, headers });
        }
        return new Response(JSON.stringify({
          sucesso: true,
          rejeitado: true,
          mensagem: `Ação de ${actionType || 'jogador'} foi recusada pelo Mestre. Motivo: ${motivo || 'Local inadequado ou perigoso.'}`
        }), { status: 200, headers });
      }

      case 'campaigns.clock.advance': {
        const { campaignId, minutes = 0, hours = 0, days = 0 } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o mestre pode alterar o relógio da campanha.' }), { status: 403, headers });
        }

        let clock = null;
        try {
          clock = typeof campaign.clock_data === 'string' ? JSON.parse(campaign.clock_data) : campaign.clock_data;
        } catch (_) {}

        const newClock = rpgEngineService.advanceWorldClock(clock, { minutes, hours, days });
        await dbQueries.updateCampaignClock(db, campaignId, newClock);

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: `Relógio avançado: ${newClock.formatado}`,
          dados: newClock
        }), { status: 200, headers });
      }

      case 'campaigns.settings.update': {
        const {
          campaignId,
          autoApproveActions,
          sceneAccessMode,
          xpMultiplier,
          discordVoiceUrl,
          discordWebhookUrl,
          soundEffectsVolume,
          clockTriggers,
          name,
          systemId,
          themeId,
          loreDescription,
          notices,
          sessions,
          nextSession,
          isPublic,
          maxPlayers
        } = data;

        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre pode alterar as configurações da campanha.' }), { status: 403, headers });
        }

        let currentSettings = {};
        try {
          currentSettings = typeof campaign.settings === 'string' ? JSON.parse(campaign.settings) : (campaign.settings || {});
        } catch (_) {}

        if (autoApproveActions !== undefined) {
          currentSettings.auto_approve_actions = Number(autoApproveActions) ? 1 : 0;
        }
        if (sceneAccessMode !== undefined) {
          currentSettings.scene_access_mode = sceneAccessMode === 'approval_required' ? 'approval_required' : 'free';
        }
        if (xpMultiplier !== undefined) {
          const m = Number(xpMultiplier);
          currentSettings.xp_multiplier = (m > 0 && m <= 5) ? m : 1.0;
        }
        if (discordVoiceUrl !== undefined) {
          currentSettings.discord_voice_url = typeof discordVoiceUrl === 'string' ? discordVoiceUrl.trim().substring(0, 300) : '';
        }
        if (discordWebhookUrl !== undefined) {
          currentSettings.discord_webhook_url = typeof discordWebhookUrl === 'string' ? discordWebhookUrl.trim().substring(0, 300) : '';
        }
        if (soundEffectsVolume !== undefined) {
          const v = parseInt(soundEffectsVolume, 10);
          currentSettings.sound_effects_volume = (!isNaN(v) && v >= 0 && v <= 100) ? v : 80;
        }
        if (clockTriggers !== undefined) {
          currentSettings.clock_triggers = clockTriggers;
        }
        if (isPublic !== undefined) {
          currentSettings.is_public = Number(isPublic) ? 1 : 0;
        }

        await dbQueries.updateCampaignSettings(db, campaignId, currentSettings);

        // Se foram enviados campos de edição geral da campanha, atualiza também a tabela campaigns
        if (name !== undefined || systemId !== undefined || themeId !== undefined || loreDescription !== undefined || notices !== undefined || sessions !== undefined || nextSession !== undefined || maxPlayers !== undefined) {
          await dbQueries.updateCampaign(db, campaignId, {
            name: name !== undefined ? String(name).trim() : campaign.name,
            systemId: systemId !== undefined ? String(systemId).trim() : campaign.system_id,
            themeId: themeId !== undefined ? String(themeId).trim() : campaign.theme_id,
            loreDescription: loreDescription !== undefined ? String(loreDescription).trim() : campaign.lore_description,
            notices: notices !== undefined ? String(notices).trim() : campaign.notices,
            sessions: sessions !== undefined ? parseInt(sessions, 10) || 0 : campaign.sessions,
            nextSession: nextSession !== undefined ? String(nextSession).trim() : campaign.next_session,
            maxPlayers: maxPlayers !== undefined ? Math.max(1, Math.min(12, parseInt(maxPlayers, 10) || 5)) : campaign.max_players
          });
        }

        const updatedCampaign = await dbQueries.getCampaignById(db, campaignId);
        const players = await dbQueries.getCampaignPlayers(db, campaignId);

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Configurações da campanha atualizadas com sucesso.',
          dados: {
            ...updatedCampaign,
            settings: currentSettings,
            players
          }
        }), { status: 200, headers });
      }

      // COMBATE, ATAQUES, MORRENDO, PODERES E COMPÊNDIO (ALPHAD6)
      case 'rpg.combat.initiative': {
        const { combatants = [] } = data;
        if (!Array.isArray(combatants) || combatants.length === 0) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Lista de combatentes inválida ou vazia.' }), { status: 400, headers });
        }
        const initiativeResult = rpgEngineService.calculateCombatInitiative(combatants);
        return new Response(JSON.stringify({
          sucesso: true,
          dados: initiativeResult
        }), { status: 200, headers });
      }

      case 'rpg.combat.attack': {
        const { attackerName, targetName, attackerRoll, targetDefense, weaponKey, customWeapon, customDamageRoll } = data;
        try {
          const result = rpgEngineService.resolveCombatAttack({
            attackerName,
            targetName,
            attackerRoll,
            targetDefense,
            weaponKey,
            customWeapon,
            customDamageRoll
          });
          return new Response(JSON.stringify({
            sucesso: true,
            dados: result
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'rpg.combat.dyingCheck': {
        const { characterId, characterName, atributoChoice, atributoValue, tentativaNumero, customRoll } = data;
        try {
          const result = rpgEngineService.resolveDyingCheck({
            characterId,
            characterName,
            atributoChoice,
            atributoValue,
            tentativaNumero,
            customRoll
          });

          // Se characterId fornecido, atualiza a ficha se faleceu
          if (characterId && !result.sobreviveu) {
            const char = await dbQueries.getCharacterById(db, characterId);
            if (char) {
              let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
              sheet.passagem_para_o_vazio = true;
              sheet.anima = 0;
              await dbQueries.updateCharacterSheet(db, characterId, sheet);
            }
          }

          return new Response(JSON.stringify({
            sucesso: true,
            dados: result
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'rpg.power.use': {
        const { characterId, power } = data;
        if (!power || typeof power !== 'object') {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados do poder não fornecidos.' }), { status: 400, headers });
        }

        let sheet = {};
        if (characterId) {
          const char = await dbQueries.getCharacterById(db, characterId);
          if (char) {
            sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
          }
        }

        try {
          const powerResult = rpgEngineService.usePower({ characterSheet: sheet, power });
          
          if (characterId && powerResult.tipo === 'ativo' && powerResult.custoAnima > 0) {
            sheet.anima = powerResult.animaAtual;
            sheet.passagem_para_o_vazio = powerResult.passagemParaOVazio;
            await dbQueries.updateCharacterSheet(db, characterId, sheet);
          }

          return new Response(JSON.stringify({
            sucesso: true,
            mensagem: powerResult.mensagem,
            dados: powerResult
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'rpg.wealth.get': {
        const { mente, social } = data;
        const result = rpgEngineService.getWealthTier({ mente, social });
        return new Response(JSON.stringify({
          sucesso: true,
          dados: result
        }), { status: 200, headers });
      }

      case 'rpg.inventory.calculateSlots': {
        const { corpo, customRoll } = data;
        const result = rpgEngineService.calculateMaxInventorySlots({ corpo, customRoll });
        return new Response(JSON.stringify({
          sucesso: true,
          dados: result
        }), { status: 200, headers });
      }

      case 'rpg.compendium.weapons': {
        return new Response(JSON.stringify({
          sucesso: true,
          dados: rpgEngineService.WEAPONS_CATALOG
        }), { status: 200, headers });
      }

      case 'rpg.compendium.defenses': {
        return new Response(JSON.stringify({
          sucesso: true,
          dados: rpgEngineService.DEFENSES_CATALOG
        }), { status: 200, headers });
      }

      case 'rpg.compendium.specializations': {
        const { categoria, atributo } = data;
        const result = rpgEngineService.getCompendiumSpecializations({ categoria, atributo });
        return new Response(JSON.stringify({
          sucesso: true,
          dados: result
        }), { status: 200, headers });
      }

      case 'rpg.compendium.items': {
        const { slot, categoria, riquezaMax } = data;
        const result = rpgEngineService.getCompendiumItems({ slot, categoria, riquezaMax });
        return new Response(JSON.stringify({
          sucesso: true,
          dados: result
        }), { status: 200, headers });
      }

      // ==========================================
      // SISTEMA ALPHAD6 & COMPÊNDIO GERAL / COMUNIDADE
      // ==========================================
      case 'rpg.system.overview':
      case 'systems.alphad6.details': {
        const { systemId = 'alphad6' } = data;
        
        // 1. Dados Canônicos do Sistema e Compêndio
        const compendiumItems = rpgEngineService.getCompendiumItems();
        const specializations = rpgEngineService.getCompendiumSpecializations();
        const wealthTiers = rpgEngineService.WEALTH_TIERS;
        const weaponsCatalog = rpgEngineService.WEAPONS_CATALOG;
        const defensesCatalog = rpgEngineService.DEFENSES_CATALOG;
        const difficultyTable = rpgEngineService.DIFFICULTY_TABLE;

        const rules = {
          nome: 'AlphaD6 RPG',
          versao: '1.2.0 (Oficial)',
          resumo: 'Sistema minimalista voltado primariamente ao RolePlay, com 4 atributos (Corpo, Mente, Social, Espírito), sucessos em 4, 5 ou 6, característica única de Anima (vida, mente e magia), especializações dinâmicas, 4 ações por turno e economia narrativa abstrata.',
          atributos: [
            { id: 'corpo', nome: 'Corpo', desc: 'Força física, atletismo, vigor corporal, combate corpo a corpo e iniciativa.' },
            { id: 'mente', nome: 'Mente', desc: 'Intelecto, percepção, armas de fogo, medicina, investigação e define a quantidade de Especializações.' },
            { id: 'social', nome: 'Social', desc: 'Carisma, empatia, persuasão, intimidação, presença de palco e traquejo social.' },
            { id: 'espirito', nome: 'Espírito', desc: 'Força de vontade, intuição, conexão mística, defesa mágica e canalização de poderes.' }
          ],
          mecanica_dados: {
            tipo_dado: 'D6',
            regra_sucesso: 'Cada dado com resultado superior a 3 (4, 5 ou 6) é contabilizado como 1 Sucesso.',
            reserva_dados: 'Pontos no Atributo (em D6) + 1d6 se houver Especialização aplicável (+1d6 extra por ajuda de aliado com especialização ou vantagem concedida pelo mestre).',
            testes_resistidos: 'Aquele com mais sucessos vence. Em caso de empate, vence quem obteve os maiores valores nos dados de sucesso. Se o empate persistir, considera-se sucesso parcial.',
            resultados: {
              sucesso_total: 'Sucessos >= Dificuldade definida pelo mestre.',
              sucesso_parcial: 'Sucessos > metade da Dificuldade (atinge o objetivo a um custo significativo).',
              falha_total: 'Sucessos < metade da Dificuldade.'
            },
            dificuldades: difficultyTable
          },
          recursos: {
            anima: '2d6 + 10 — Característica única vital que representa a vida física, saúde mental e energia para magias/habilidades. Ao chegar a 0, ocorre a Passagem para o Vazio.',
            descansos: {
              curto: { tempo: 'Mínimo 2 horas', local: 'Minimamente seguro e confortável', recuperacao: '3d4 pontos de Anima (Média 7,5)' },
              longo: { tempo: '6 horas', local: 'Confortável e totalmente seguro', recuperacao: '3d6 pontos de Anima (Média 10,5)' },
              completo: { tempo: '8 horas', local: 'Totalmente confortável e totalmente seguro', recuperacao: '3d8 pontos de Anima (Média 13,5)' }
            },
            restauracoes: {
              emergencia: { condicao: 'Sem especialização em medicina ou em ambiente perigoso', custo: '1 item de cura consumido', recuperacao: '6 pontos de Anima' },
              cuidadosa: { condicao: 'Com especialização em medicina ou com proteção e tempo', custo: '2 itens de cura consumidos', recuperacao: '12 pontos de Anima' },
              completa: { condicao: 'Com especialização em medicina em ambiente próprio de cura (mínimo 24 horas)', custo: '3 itens de cura consumidos', recuperacao: 'Restaura todos os pontos de Anima' }
            },
            capacidade_carga: '2d6 + Corpo em slots de inventário (itens pequenos/leves não ocupam slots).',
            arquetipos_contatos: 'Arquétipos livres para roleplay + 3 NPCs contatos criados livremente pelo jogador a qualquer momento da campanha.',
            acoes_rodada: '4 Ações por turno fixas (3 metros por ação de movimento). Ações não usadas viram Reações para contra-ataques, proteção de aliados ou ativação de itens de defesa (máx. 3 itens).',
            iniciativa: 'Teste de Corpo (desempate: sucessos -> maiores valores nos dados -> pontos no atributo Corpo).',
            combate: {
              ataque_corpo_a_corpo: 'Teste de Corpo contra a Defesa do alvo.',
              ataque_distancia_fogo: 'Teste de Mente contra a Defesa do alvo (todas as armas de fogo usam Mente).',
              defesa_alvo: 'Atributo de Corpo (físico) ou Espírito (mágico) + bônus de itens de defesa ativados com reação.',
              tabela_defesas_itens: [
                { defesa: 4, riqueza_minima: 'Milionário' },
                { defesa: 2, riqueza_minima: 'Classe Média Alta' },
                { defesa: 1, riqueza_minima: 'Pobre' }
              ],
              morrendo: 'Ao zerar Anima: teste de Corpo ou Espírito a cada turno (Dificuldade inicial 4, +2 a cada novo teste na cena). 1 falha = morte instantânea. Ataque inimigo em morrendo = morte instantânea.'
            }
          },
          sistema_monetario: {
            conceito: 'Abstrato e narrativo pela soma de Mente + Social',
            tiers: wealthTiers
          }
        };

        // 2. Ecossistema da Comunidade (Fichas, NPCs e Homebrews de Campanhas)
        const rawCharacters = await dbQueries.getCharactersBySystem(db, systemId);
        const campaigns = await dbQueries.getCampaignsBySystem(db, systemId);

        const players = [];
        const npcs = [];
        const homebrews = [];

        for (const c of rawCharacters) {
          const sheet = typeof c.sheet_data === 'string' ? JSON.parse(c.sheet_data || '{}') : (c.sheet_data || {});
          const isNpc = sheet.tipo_personagem === 'npc' || sheet.is_npc === true;
          
          const itemResumo = {
            id: c.id,
            name: c.name,
            campaignId: c.campaign_id,
            campaignName: c.campaign_name || 'Campanha Desconhecida',
            campaignSimpleId: c.campaign_simple_id || null,
            creatorName: c.creator_name || 'Aventureiro',
            creatorAvatar: c.creator_avatar || '',
            createdAt: c.created_at,
            sheet: {
              arquetipo: sheet.arquetipo || 'Aventureiro',
              atributos: sheet.atributos || { corpo: 2, mente: 2, social: 2, espirito: 2 },
              pontos_vida_max: sheet.pontos_vida_max || (10 + (sheet.atributos?.corpo || 2) * 3),
              anima_max: sheet.anima_max || (10 + (sheet.atributos?.espirito || 2) * 2),
              defesa_total: sheet.defesa_total || 2,
              riqueza: sheet.riqueza || 'pobre',
              pratas: sheet.pratas !== undefined ? sheet.pratas : 2500,
              especializacoes: sheet.especializacoes || [],
              inventario: sheet.inventario || [],
              lore: sheet.lore || {}
            }
          };

          if (isNpc) {
            npcs.push(itemResumo);
          } else {
            players.push(itemResumo);
          }

          // Coleta itens ou recursos homebrew criados nas fichas
          if (Array.isArray(sheet.inventario)) {
            sheet.inventario.forEach(item => {
              if (item && (item.is_homebrew || item.origem === 'homebrew' || item.custom)) {
                homebrews.push({
                  id: item.id || `hb-${item.nome}`,
                  nome: item.nome,
                  tipo: item.tipo || 'Item Customizado',
                  categoria: item.categoria || 'Homebrew',
                  custo_pratas: item.custo_pratas || 0,
                  peso_slots: item.peso_slots || 1,
                  descricao: item.descricao || 'Item customizado criado pela comunidade.',
                  autor: c.creator_name || 'Mestre',
                  campanha: c.campaign_name || 'Mesa Local'
                });
              }
            });
          }
        }

        // Se não houver homebrews ou NPCs no banco, disponibilizar catálogo padrão exemplar
        if (npcs.length === 0) {
          npcs.push(
            {
              id: 'npc-guard-01',
              name: 'Guarda da Vigília Noturna',
              campaignName: 'Guarnição de Solaria',
              creatorName: 'Compêndio Oficial AlphaD6',
              sheet: {
                arquetipo: 'Sentinela Urbano',
                atributos: { corpo: 3, mente: 2, social: 2, espirito: 1 },
                pontos_vida_max: 19,
                anima_max: 12,
                defesa_total: 4,
                riqueza: 'pobre',
                pratas: 2500,
                especializacoes: [{ nome: 'Arma Branca', atributo: 'corpo', rank: 2 }, { nome: 'Atenção', atributo: 'mente', rank: 1 }],
                inventario: [{ nome: 'Espada Longa', slot: 'mao_primaria', dano: '+3 Dano' }, { nome: 'Cota de Malha Leve', slot: 'armadura', defesa: 2 }]
              }
            },
            {
              id: 'npc-cultist-02',
              name: 'Cultista do Olho Escarlate',
              campaignName: 'O Chamado das Profundezas',
              creatorName: 'Compêndio Oficial AlphaD6',
              sheet: {
                arquetipo: 'Iniciado do Oculto',
                atributos: { corpo: 1, mente: 3, social: 2, espirito: 4 },
                pontos_vida_max: 13,
                anima_max: 18,
                defesa_total: 2,
                riqueza: 'miseravel',
                pratas: 1200,
                especializacoes: [{ nome: 'Ocultismo & Rituais', atributo: 'espirito', rank: 3 }, { nome: 'Enganação', atributo: 'social', rank: 2 }],
                inventario: [{ nome: 'Adaga Cerimonial', slot: 'mao_primaria', dano: '+1 Dano' }]
              }
            },
            {
              id: 'npc-beast-03',
              name: 'Lobo das Cinzas Primevas',
              campaignName: 'Terras Selvagens de Valen',
              creatorName: 'Compêndio Oficial AlphaD6',
              sheet: {
                arquetipo: 'Predador Alfa',
                atributos: { corpo: 4, mente: 2, social: 1, espirito: 2 },
                pontos_vida_max: 22,
                anima_max: 14,
                defesa_total: 3,
                riqueza: 'miseravel',
                pratas: 0,
                especializacoes: [{ nome: 'Furtividade', atributo: 'corpo', rank: 2 }, { nome: 'Rastreamento & Sobrevivência', atributo: 'mente', rank: 2 }],
                inventario: [{ nome: 'Mordida Dilacerante', slot: 'mao_primaria', dano: '+4 Dano Físico' }]
              }
            }
          );
        }

        if (homebrews.length === 0) {
          homebrews.push(
            {
              id: 'hb-01',
              nome: 'Lâmina do Eclipse Sombrio',
              tipo: 'Arma Branca Mágica',
              categoria: 'Armas & Focos',
              custo_pratas: 4800,
              peso_slots: 2,
              descricao: 'Forjada em ferro estelar e banhada em sangue de aberrações. Concede +3 de dano e permite drenar 2 pontos de Anima do alvo em acertos críticos.',
              autor: 'Mestre Salazar',
              campanha: 'Crônicas do Pesadelo'
            },
            {
              id: 'hb-02',
              nome: 'Elixir de Anima Instável',
              tipo: 'Consumível Alquímico',
              categoria: 'Foco & Restauração',
              custo_pratas: 850,
              peso_slots: 1,
              descricao: 'Restaura imediatamente 2d6 de Anima, mas exige um teste de Espírito (Dificuldade 4) para não sofrer 1 ponto de choque no Vazio.',
              autor: 'Grimório dos Alquimistas',
              campanha: 'O Labirinto da Lua Negra'
            },
            {
              id: 'hb-03',
              nome: 'Manto da Neblina Eterna',
              tipo: 'Vestimenta Encantada',
              categoria: 'Proteções & Escudos',
              custo_pratas: 3200,
              peso_slots: 1,
              descricao: 'Tecido com fios de espectros. Adiciona +2 dados em qualquer teste de Furtividade e +1 de Defesa passiva.',
              autor: 'Guardião Eldrin',
              campanha: 'Cripta dos Esquecidos'
            }
          );
        }

        return new Response(JSON.stringify({
          sucesso: true,
          dados: {
            systemId,
            rules,
            compendium: {
              items: compendiumItems,
              weapons: weaponsCatalog,
              defenses: defensesCatalog,
              specializations: specializations,
              wealthTiers: wealthTiers
            },
            community: {
              players,
              npcs,
              homebrews,
              stats: {
                totalPlayers: players.length,
                totalNpcs: npcs.length,
                totalHomebrews: homebrews.length,
                totalCampaigns: campaigns.length
              }
            }
          }
        }), { status: 200, headers });
      }


      // ==========================================
      // EVOLUÇÃO, XP & GATILHOS DE CENA (ALPHAD6)
      // ==========================================
      case 'rpg.character.awardXP': {
        const { campaignId, characterId, characterIds, xpAmount = 1, motivo = 'Recompensa de Aventura' } = data;
        const xp = Math.max(1, Math.floor(Number(xpAmount) || 1));

        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        // Apenas o mestre ou admin pode conceder XP
        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre pode conceder pontos de experiência.' }), { status: 403, headers });
        }

        let targetIds = [];
        if (Array.isArray(characterIds) && characterIds.length > 0) {
          targetIds = characterIds;
        } else if (characterId) {
          targetIds = [characterId];
        } else {
          // Concede para todos os personagens vinculados à campanha
          const party = await dbQueries.getCharactersByCampaign(db, campaignId);
          targetIds = party.map(p => p.id);
        }

        let xpMultiplier = 1.0;
        if (campaign.settings) {
          try {
            const sett = typeof campaign.settings === 'string' ? JSON.parse(campaign.settings) : campaign.settings;
            if (sett.xp_multiplier !== undefined) xpMultiplier = Number(sett.xp_multiplier) || 1.0;
          } catch (_) {}
        }

        const atualizados = [];
        for (const cid of targetIds) {
          const char = await dbQueries.getCharacterById(db, cid);
          if (char) {
            let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
            sheet.xp_atual = Math.max(0, Math.floor(Number(sheet.xp_atual) || 0)) + xp;
            await dbQueries.updateCharacterSheet(db, cid, sheet);

            const levelCheck = rpgEngineService.canLevelUp(sheet, xpMultiplier);
            atualizados.push({
              characterId: cid,
              name: char.name,
              xpAtual: sheet.xp_atual,
              nivelAtual: sheet.nivel || 1,
              prontoParaEvoluir: levelCheck.canLevelUp,
              xpNecessario: levelCheck.xpNecessario
            });
          }
        }

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: `${xp} XP concedido com sucesso para ${atualizados.length} personagem(ns). (${motivo})`,
          dados: atualizados
        }), { status: 200, headers });
      }

      case 'rpg.character.levelUp': {
        const { characterId } = data;
        if (!characterId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem obrigatório.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        // RLS: Dono, Mestre da campanha vinculada ou Admin
        if (char.user_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          if (char.campaign_id) {
            const camp = await dbQueries.getCampaignById(db, char.campaign_id);
            if (!camp || camp.owner_id !== user.userId) {
              return new Response(JSON.stringify({ sucesso: false, erro: 'Não autorizado a evoluir este personagem.' }), { status: 403, headers });
            }
          } else {
            return new Response(JSON.stringify({ sucesso: false, erro: 'Não autorizado a evoluir este personagem.' }), { status: 403, headers });
          }
        }

        let xpMultiplier = 1.0;
        if (char.campaign_id) {
          const camp = await dbQueries.getCampaignById(db, char.campaign_id);
          if (camp && camp.settings) {
            try {
              const sett = typeof camp.settings === 'string' ? JSON.parse(camp.settings) : camp.settings;
              if (sett.xp_multiplier !== undefined) xpMultiplier = Number(sett.xp_multiplier) || 1.0;
            } catch (_) {}
          }
        }

        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});

        try {
          const levelUpResult = rpgEngineService.applyLevelUp(sheet, xpMultiplier);
          await dbQueries.updateCharacterSheet(db, characterId, levelUpResult.sheet);

          return new Response(JSON.stringify({
            sucesso: true,
            mensagem: levelUpResult.mensagem,
            dados: {
              characterId,
              novoNivel: levelUpResult.novoNivel,
              pontosAtributoDisponiveis: levelUpResult.pontosAtributoDisponiveis,
              novaMaxAnima: levelUpResult.novaMaxAnima,
              animaAtual: levelUpResult.animaAtual,
              sheet: levelUpResult.sheet
            }
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'rpg.character.distributeAttributes': {
        const { characterId, distribution } = data;
        if (!characterId || !distribution) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem e distribuição de atributos são obrigatórios.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        if (char.user_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o proprietário do personagem pode distribuir seus atributos.' }), { status: 403, headers });
        }

        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});

        try {
          const distResult = rpgEngineService.distributeAttributePoints(sheet, distribution);
          await dbQueries.updateCharacterSheet(db, characterId, distResult.sheet);

          return new Response(JSON.stringify({
            sucesso: true,
            mensagem: distResult.mensagem,
            dados: {
              characterId,
              atributos: distResult.atributosAtualizados,
              pontosRestantes: distResult.pontosRestantes,
              novasEspecializacoesDisponiveis: distResult.novasEspecializacoesDisponiveis,
              wealthTier: distResult.wealthTier,
              maxSlots: distResult.maxSlots,
              novaMaxAnima: distResult.novaMaxAnima,
              sheet: distResult.sheet
            }
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      // ==========================================
      // CRIAÇÃO DE PERSONAGEM & GESTÃO DE FICHA ALPHAD6
      // ==========================================
      case 'characters.create':
      case 'rpg.character.createAlphaD6': {
        const {
          name,
          sexo,
          idade,
          raca,
          nivel = 1,
          arquetipo,
          atributos,
          especializacoes,
          contatos,
          poderes,
          lore,
          equipamentoSilhueta,
          itensMochila,
          campaignId = null,
          customAnimaRoll,
          customInventoryRoll
        } = data;

        // Validação obrigatória de Campanha (Não é permitido criar personagens desvinculados de campanha)
        if (!campaignId || typeof campaignId !== 'string' || campaignId.trim() === '') {
          return new Response(JSON.stringify({
            sucesso: false,
            codigo: 'CAMPAIGN_REQUIRED',
            erro: 'É obrigatório vincular o personagem a uma campanha. Não é permitido criar personagens avulsos/desvinculados.'
          }), { status: 400, headers });
        }

        const cleanCampaignId = campaignId.trim();

        // Validação da existência da campanha
        const campaign = await dbQueries.getCampaignById(db, cleanCampaignId);
        if (!campaign) {
          return new Response(JSON.stringify({
            sucesso: false,
            codigo: 'CAMPAIGN_NOT_FOUND',
            erro: 'A campanha informada não foi encontrada ou não existe.'
          }), { status: 404, headers });
        }

        // Trava de Integridade: Limite de 1 Personagem por Jogador por Campanha
        const existingChar = await dbQueries.getCharacterByUserAndCampaign(db, user.userId, cleanCampaignId);
        if (existingChar) {
          return new Response(JSON.stringify({
            sucesso: false,
            codigo: 'LIMIT_REACHED',
            erro: `Limite atingido: Você já possui o personagem "${existingChar.name}" vinculado a esta campanha. Cada jogador pode possuir apenas 1 personagem por campanha.`
          }), { status: 400, headers });
        }

        // Suporte a payload genérico com sheetData pré-formatado
        if (data.sheetData && !atributos) {
          const charId = `chr_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
          await dbQueries.createCharacter(db, {
            id: charId,
            userId: user.userId,
            campaignId: cleanCampaignId,
            name,
            sheetData: data.sheetData
          });
          return new Response(JSON.stringify({
            sucesso: true,
            mensagem: 'Personagem criado com sucesso!',
            dados: { id: charId, name, userId: user.userId, campaignId: cleanCampaignId, sheet: data.sheetData }
          }), { status: 201, headers });
        }

        try {
          const validated = rpgEngineService.validateCharacterCreationAlphaD6({
            name,
            sexo,
            idade,
            raca,
            nivel,
            arquetipo,
            atributos,
            especializacoes,
            contatos,
            poderes,
            lore,
            equipamentoSilhueta,
            itensMochila,
            customAnimaRoll,
            customInventoryRoll
          });

          const charId = `chr_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
          await dbQueries.createCharacter(db, {
            id: charId,
            userId: user.userId, // RLS: Dono injetado pelo token
            campaignId: cleanCampaignId,
            name: validated.name,
            sheetData: validated.sheet
          });

          return new Response(JSON.stringify({
            sucesso: true,
            mensagem: validated.mensagem,
            dados: {
              id: charId,
              name: validated.name,
              userId: user.userId,
              campaignId: cleanCampaignId,
              sheet: validated.sheet
            }
          }), { status: 201, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'characters.list':
      case 'rpg.character.list': {
        const chars = await dbQueries.getCharactersByUser(db, user.userId);
        const parsed = chars.map(c => ({
          ...c,
          sheet: typeof c.sheet_data === 'string' ? JSON.parse(c.sheet_data || '{}') : (c.sheet_data || {})
        }));
        return new Response(JSON.stringify({ sucesso: true, dados: parsed }), { status: 200, headers });
      }

      case 'characters.listHierarchical':
      case 'rpg.character.listHierarchical': {
        const chars = await dbQueries.getCharactersByUserHierarchical(db, user.userId);
        const hierarchy = {};

        for (const c of chars) {
          const sheet = typeof c.sheet_data === 'string' ? JSON.parse(c.sheet_data || '{}') : (c.sheet_data || {});
          const systemId = c.campaign_system_id || sheet.sistema || 'alphad6';
          const systemName = (systemId === 'alphad6') ? 'AlphaD6 RPG' : (systemId === 'custom' ? 'Sistema Próprio / Livre' : systemId);

          if (!hierarchy[systemId]) {
            hierarchy[systemId] = {
              systemId,
              systemName,
              campaigns: {}
            };
          }

          const campKey = c.campaign_id || 'avulsos';
          const campName = c.campaign_name || 'Personagens Avulsos (Sem Campanha)';
          const campSimpleId = c.campaign_simple_id || null;
          const campAvatar = c.campaign_image_url || null;

          if (!hierarchy[systemId].campaigns[campKey]) {
            hierarchy[systemId].campaigns[campKey] = {
              campaignId: c.campaign_id || null,
              campaignName: campName,
              simpleId: campSimpleId,
              avatarUrl: campAvatar,
              characters: []
            };
          }

          hierarchy[systemId].campaigns[campKey].characters.push({
            id: c.id,
            name: c.name,
            campaignId: c.campaign_id,
            createdAt: c.created_at,
            sheet
          });
        }

        const output = Object.values(hierarchy).map(sys => ({
          systemId: sys.systemId,
          systemName: sys.systemName,
          campaigns: Object.values(sys.campaigns)
        }));

        return new Response(JSON.stringify({ sucesso: true, dados: output }), { status: 200, headers });
      }

      case 'campaigns.characters.list':
      case 'rpg.campaign.characters': {
        const { campaignId } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }

        const party = await dbQueries.getCampaignPartyCharacters(db, campaignId);
        const parsed = party.map(p => ({
          id: p.id,
          name: p.name,
          userId: p.user_id,
          playerName: p.player_name,
          playerNickname: p.player_nickname,
          playerAvatar: p.player_avatar,
          sheet: typeof p.sheet_data === 'string' ? JSON.parse(p.sheet_data || '{}') : (p.sheet_data || {})
        }));

        return new Response(JSON.stringify({ sucesso: true, dados: parsed }), { status: 200, headers });
      }

      case 'characters.get':
      case 'rpg.character.get': {
        const { characterId } = data;
        if (!characterId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem obrigatório.' }), { status: 400, headers });
        }
        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }
        return new Response(JSON.stringify({
          sucesso: true,
          dados: {
            ...char,
            sheet: typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {})
          }
        }), { status: 200, headers });
      }

      case 'characters.delete':
      case 'rpg.character.delete': {
        const { characterId } = data;
        if (!characterId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem obrigatório.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        // RLS: O Dono da ficha pode deletar, o Mestre da Campanha vinculada pode deletar, ou Administradores
        let isOwner = char.user_id === user.userId;
        let isGM = false;

        if (char.campaign_id) {
          const camp = await dbQueries.getCampaignById(db, char.campaign_id);
          if (camp && camp.owner_id === user.userId) {
            isGM = true;
          }
        }

        const isAdmin = ['admin', 'superadmin'].includes(user.role);

        if (!isOwner && !isGM && !isAdmin) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Acesso negado: Você não possui permissão para excluir este personagem.' }), { status: 403, headers });
        }

        await dbQueries.deleteCharacter(db, characterId);
        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: `Personagem "${char.name}" excluído com sucesso.`
        }), { status: 200, headers });
      }


      case 'rpg.character.equipSlot': {
        const { characterId, slotKey, item } = data;
        if (!characterId || !slotKey) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem e slotKey são obrigatórios.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        if (char.user_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não autorizado a modificar os equipamentos desta ficha.' }), { status: 403, headers });
        }

        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});

        try {
          const result = rpgEngineService.updateEquipmentSlot(sheet, slotKey, item);
          await dbQueries.updateCharacterSheet(db, characterId, result.sheet);

          return new Response(JSON.stringify({
            sucesso: true,
            mensagem: `Slot "${slotKey}" atualizado com sucesso. Defesa atual: ${result.defesaTotal}.`,
            dados: {
              characterId,
              slotKey,
              itemEquipado: result.itemEquipado,
              defesaTotal: result.defesaTotal,
              armasEmPunho: result.armasEmPunho,
              sheet: result.sheet
            }
          }), { status: 200, headers });
        } catch (err) {
          return new Response(JSON.stringify({ sucesso: false, erro: err.message }), { status: 400, headers });
        }
      }

      case 'rpg.character.updateLore': {
        const { characterId, lore } = data;
        if (!characterId || !lore) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem e dados de lore são obrigatórios.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        if (char.user_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o proprietário pode editar a lore do personagem.' }), { status: 403, headers });
        }

        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
        sheet.lore = {
          historia_origem: lore.historia_origem !== undefined ? String(lore.historia_origem).trim() : (sheet.lore?.historia_origem || ''),
          personalidade: lore.personalidade !== undefined ? String(lore.personalidade).trim() : (sheet.lore?.personalidade || ''),
          motivacao: lore.motivacao !== undefined ? String(lore.motivacao).trim() : (sheet.lore?.motivacao || ''),
          diario_anotacoes: lore.diario_anotacoes !== undefined ? String(lore.diario_anotacoes).trim() : (sheet.lore?.diario_anotacoes || '')
        };

        await dbQueries.updateCharacterSheet(db, characterId, sheet);

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Lore do personagem atualizada com sucesso!',
          dados: { characterId, lore: sheet.lore }
        }), { status: 200, headers });
      }

      case 'rpg.character.updateSystemState': {
        const { characterId, acoesRestantes, reacoesDisponiveis, condicoes, recursosCustomizados, estadoVital } = data;
        if (!characterId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID do personagem obrigatório.' }), { status: 400, headers });
        }

        const char = await dbQueries.getCharacterById(db, characterId);
        if (!char) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Personagem não encontrado.' }), { status: 404, headers });
        }

        let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
        if (!sheet.sistema_estado) {
          sheet.sistema_estado = {};
        }

        if (acoesRestantes !== undefined) sheet.sistema_estado.acoes_restantes = Math.max(0, Number(acoesRestantes) || 0);
        if (reacoesDisponiveis !== undefined) sheet.sistema_estado.reacoes_disponiveis = Math.max(0, Number(reacoesDisponiveis) || 0);
        if (Array.isArray(condicoes)) sheet.sistema_estado.condicoes = condicoes;
        if (recursosCustomizados && typeof recursosCustomizados === 'object') sheet.sistema_estado.recursos_customizados = recursosCustomizados;
        if (estadoVital) sheet.sistema_estado.estado_vital = estadoVital;

        await dbQueries.updateCharacterSheet(db, characterId, sheet);

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Estado de sistema atualizado com sucesso.',
          dados: { characterId, sistemaEstado: sheet.sistema_estado }
        }), { status: 200, headers });
      }



      // GOVERNANÇA E ADMINISTRAÇÃO (EXCLUSIVO PARA ROLE === 'admin' / 'superadmin')
      case 'admin.stats': {
        const result = await adminService.getPlatformStats(db, user);
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, dados: result.data }), { status: 200, headers });
      }

      case 'admin.users.list': {
        const { search = '', role = null, limit = 50, offset = 0 } = data;
        const result = await adminService.listUsers(db, user, { search, role, limit, offset });
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, dados: result.data }), { status: 200, headers });
      }

      case 'admin.devices.list': {
        const result = await adminService.listBlockedDevices(db, user);
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, dados: result.data }), { status: 200, headers });
      }

      case 'admin.devices.unblock': {
        const { deviceHash } = data;
        const result = await adminService.unblockDevice(db, user, deviceHash);
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, mensagem: result.message }), { status: 200, headers });
      }

      case 'admin.user.setRole': {
        const { targetUserId, role } = data;
        const result = await adminService.changeUserRole(db, user, targetUserId, role);
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, mensagem: result.message }), { status: 200, headers });
      }

      case 'admin.user.block': {
        const { targetUserId, reason } = data;
        const result = await adminService.blockUser(db, user, targetUserId, reason);
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, mensagem: result.message }), { status: 200, headers });
      }

      case 'admin.user.unblock': {
        const { targetUserId } = data;
        const result = await adminService.unblockUser(db, user, targetUserId);
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, mensagem: result.message }), { status: 200, headers });
      }

      case 'admin.user.delete': {
        const { targetUserId } = data;
        const result = await adminService.deleteUser(db, user, targetUserId);
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, mensagem: result.message }), { status: 200, headers });
      }

      case 'admin.user.resetPassword': {
        const { targetUserId, newPassword } = data;
        const result = await adminService.resetUserPassword(db, user, targetUserId, newPassword);
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, mensagem: result.message }), { status: 200, headers });
      }

      case 'admin.campaigns.list': {
        const { search = '', limit = 50, offset = 0 } = data;
        const result = await adminService.listAllCampaigns(db, user, { search, limit, offset });
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, dados: result.data }), { status: 200, headers });
      }

      case 'admin.audit.logs': {
        const { limit = 50 } = data;
        const result = await adminService.listAuditLogs(db, user, { limit });
        if (result.error) {
          return new Response(JSON.stringify({ sucesso: false, erro: result.error }), { status: result.status, headers });
        }
        return new Response(JSON.stringify({ sucesso: true, dados: result.data }), { status: 200, headers });
      }

      // ----------------------------------------------------
      // COMPÊNDIO & HERANÇA DELTA (OFICINA DO MESTRE)
      // ----------------------------------------------------
      case 'compendium.list': {
        const { category = null, campaignId = null, includePublic = true } = data;
        const items = await dbQueries.getCompendiumItems(db, {
          category,
          ownerUserId: user.userId,
          campaignId,
          includePublic
        });
        return new Response(JSON.stringify({ sucesso: true, dados: items }), { status: 200, headers });
      }

      case 'compendium.get': {
        const { itemId } = data;
        if (!itemId) return new Response(JSON.stringify({ sucesso: false, erro: 'itemId é obrigatório' }), { status: 400, headers });
        const item = await dbQueries.getCompendiumItemById(db, itemId);
        if (!item) return new Response(JSON.stringify({ sucesso: false, erro: 'Elemento não encontrado no compêndio' }), { status: 404, headers });
        return new Response(JSON.stringify({ sucesso: true, dado: item }), { status: 200, headers });
      }

      case 'compendium.create': {
        const { parentId = null, campaignId = null, name, category, systemId = 'alphad6', baseAssetId = 'default_asset', isPublic = 0, blocks = {}, deltaChanges = {} } = data;
        if (!name || !category) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Nome e Categoria são obrigatórios' }), { status: 400, headers });
        }
        
        // Verifica limite de 100 itens por tipo do mestre
        const currentItems = await dbQueries.getCompendiumItems(db, { category, ownerUserId: user.userId, includePublic: false });
        if (currentItems.length >= 100) {
          return new Response(JSON.stringify({ sucesso: false, erro: `Limite de 100 elementos de compêndio do tipo "${category}" atingido!` }), { status: 400, headers });
        }

        const id = 'comp_' + randomUUID();
        await dbQueries.createCompendiumItem(db, {
          id,
          parentId,
          ownerUserId: user.userId,
          campaignId,
          name,
          category,
          systemId,
          baseAssetId,
          isPublic,
          blocks,
          deltaChanges
        });

        const createdItem = await dbQueries.getCompendiumItemById(db, id);
        return new Response(JSON.stringify({ sucesso: true, dado: createdItem }), { status: 201, headers });
      }

      case 'compendium.update': {
        const { itemId, name, isPublic, blocks, deltaChanges } = data;
        if (!itemId) return new Response(JSON.stringify({ sucesso: false, erro: 'itemId é obrigatório' }), { status: 400, headers });
        
        const existing = await dbQueries.getCompendiumItemById(db, itemId);
        if (!existing) return new Response(JSON.stringify({ sucesso: false, erro: 'Elemento não encontrado' }), { status: 404, headers });
        if (existing.owner_user_id !== user.userId && user.role !== 'admin' && user.role !== 'superadmin') {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Sem permissão para alterar este item' }), { status: 403, headers });
        }

        await dbQueries.updateCompendiumItem(db, itemId, { name, isPublic, blocks, deltaChanges });
        const updated = await dbQueries.getCompendiumItemById(db, itemId);
        return new Response(JSON.stringify({ sucesso: true, dado: updated }), { status: 200, headers });
      }

      case 'compendium.delete': {
        const { itemId } = data;
        if (!itemId) return new Response(JSON.stringify({ sucesso: false, erro: 'itemId é obrigatório' }), { status: 400, headers });
        const existing = await dbQueries.getCompendiumItemById(db, itemId);
        if (!existing) return new Response(JSON.stringify({ sucesso: false, erro: 'Elemento não encontrado' }), { status: 404, headers });
        if (existing.owner_user_id !== user.userId && user.role !== 'admin' && user.role !== 'superadmin') {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Sem permissão para excluir este item' }), { status: 403, headers });
        }

        await dbQueries.deleteCompendiumItem(db, itemId);
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Elemento de compêndio removido com sucesso' }), { status: 200, headers });
      }

      case 'compendium.useItem': {
        const { itemId, characterId } = data;
        if (!itemId || !characterId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'itemId e characterId são obrigatórios para usar o item' }), { status: 400, headers });
        }

        const item = await dbQueries.getCompendiumItemById(db, itemId);
        if (!item) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Item não encontrado no compêndio' }), { status: 404, headers });
        }

        const blocks = item.resolved_blocks || item.blocks || {};
        const tipoItem = blocks.bloco_tipo_item?.value || 'consumable';
        const efeitoBlock = blocks.bloco_efeito_alphad6 || {};
        const actions = efeitoBlock.actions || [];

        // Verifica cargas/quantidade
        let qtdAtual = blocks.bloco_quantidade?.value !== undefined ? Number(blocks.bloco_quantidade.value) : 1;
        if (qtdAtual <= 0) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Item esgotado / sem quantidade restante' }), { status: 400, headers });
        }

        // Executa ações mecânicas autoritativas no personagem
        const results = [];
        const char = await dbQueries.getCharacterById(db, characterId);
        let sheet = char && char.sheet_data ? (typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data) : char.sheet_data) : {};

        for (const act of actions) {
          if (act.type === 'heal_anima') {
            const dice = act.params?.dice || '2d6';
            const roll = rpgEngineService.rollDice(dice);
            const curAnima = sheet.anima_atual !== undefined ? Number(sheet.anima_atual) : 10;
            const maxAnima = sheet.anima_max !== undefined ? Number(sheet.anima_max) : 20;
            const newAnima = Math.min(maxAnima, curAnima + roll.total);
            sheet.anima_atual = newAnima;
            results.push(`Curou ${roll.total} de Anima (${dice}: ${roll.dados.join('+')}). Nova Anima: ${newAnima}/${maxAnima}`);
          }
        }

        // Se for consumível, reduz quantidade
        if (tipoItem === 'consumable') {
          blocks.bloco_quantidade.value = Math.max(0, qtdAtual - 1);
        }

        // Salva ficha atualizada se alterada
        if (char) {
          await dbQueries.updateCharacter(db, characterId, { sheetData: sheet });
        }

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: `Item "${item.name}" utilizado com sucesso!`,
          resultados: results,
          quantidadeRestante: blocks.bloco_quantidade?.value
        }), { status: 200, headers });
      }

      default:
        return new Response(JSON.stringify({
          sucesso: false,
          erro: `Ação desconhecida: "${action}"`
        }), { status: 404, headers });
    }
  } catch (err) {
    console.error('[SyncService Error]', action, err);
    return new Response(JSON.stringify({
      sucesso: false,
      erro: err.message || 'Erro interno ao processar comando de sincronização',
      detalhes: env?.ENVIRONMENT === 'development' ? err.message : undefined
    }), { status: 500, headers });
  }
}
