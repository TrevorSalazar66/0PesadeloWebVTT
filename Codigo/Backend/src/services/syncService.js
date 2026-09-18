/**
 * Gateway Unificado de Sincronização e Comandos (/api/sync)
 * Roteamento interno blindado com RLS lógico e despacho desacoplado
 */
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { dbQueries } from '../db/queries.js';
import { LIMITS } from '../config/limits.js';
import { checkRateLimit } from '../middleware/rateLimiter.js';
import { applySecurityHeaders } from '../config/securityHeaders.js';
import { randomUUID, signJWT, createAuthCookie } from './cryptoService.js';
import { adminService } from './adminService.js';
import { generateUniqueSimpleId, OFFICIAL_SYSTEMS, OFFICIAL_THEMES, CAMPAIGN_LIMITS, sanitizeText } from './campaignService.js';


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
      // PERFIL & ONBOARDING
      case 'profile.get': {
        const userBasic = await dbQueries.getUserById(db, user.userId);
        const profile = await dbQueries.getUserProfile(db, user.userId);
        return new Response(JSON.stringify({
          sucesso: true,
          dados: {
            ...userBasic,
            perfil: profile || null
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
        const { displayName } = data;
        if (!displayName || !displayName.trim()) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Nome de exibição inválido' }), { status: 400, headers });
        }
        await dbQueries.updateUserProfile(db, user.userId, { displayName });
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Perfil atualizado com sucesso' }), { status: 200, headers });
      }

      // CAMPANHAS (RLS: O usuário só enxerga/cria sob seu ID)
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
        const players = await dbQueries.getCampaignPlayers(db, campaign.id);
        return new Response(JSON.stringify({
          sucesso: true,
          dados: { ...campaign, players }
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
        const { campaignId, name, sessions, nextSession, description, notices } = data;
        
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

        await dbQueries.updateCampaign(db, campaignId, { 
          name: cleanName, 
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
        
        const requestId = `req_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
        await dbQueries.createCampaignRequest(db, { id: requestId, campaignId: data.campaignId, userId: user.userId });
        
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Solicitação enviada com sucesso!' }), { status: 201, headers });
      }

      case 'campaigns.requests.list': {
        const { campaignId } = data;
        if (!campaignId) return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha ausente.' }), { status: 400, headers });
        
        // Ensure user is owner of the campaign or admin/superadmin
        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        
        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não autorizado.' }), { status: 403, headers });
        }
        
        const requests = await dbQueries.getCampaignRequests(db, campaignId);
        return new Response(JSON.stringify({ sucesso: true, dados: requests }), { status: 200, headers });
      }

      case 'campaigns.requests.update': {
        const { requestId, status } = data;
        if (!requestId || !['aceito', 'recusado'].includes(status)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados inválidos.' }), { status: 400, headers });
        }
        
        const req = await dbQueries.getCampaignRequestById(db, requestId);
        if (!req) return new Response(JSON.stringify({ sucesso: false, erro: 'Solicitação não encontrada.' }), { status: 404, headers });
        
        const campaign = await dbQueries.getCampaignById(db, req.campaign_id);
        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não autorizado.' }), { status: 403, headers });
        }
        
        await dbQueries.updateCampaignRequestStatus(db, requestId, status);
        
        // If accepted, add player to campaign_players
        if (status === 'aceito') {
          try {
            const stmtPlayer = db.prepare(`
              INSERT OR IGNORE INTO campaign_players (campaign_id, user_id, role)
              VALUES (?, ?, 'jogador')
            `);
            await stmtPlayer.bind(req.campaign_id, req.user_id).run();
          } catch (_) {}
        }
        
        return new Response(JSON.stringify({ sucesso: true, mensagem: `Solicitação ${status}.` }), { status: 200, headers });
      }

      case 'campaigns.players.updateRole': {
        const { campaignId, targetUserId, newRole } = data;
        if (!campaignId || !targetUserId || !['jogador', 'assistente de mestre'].includes(newRole)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados inválidos.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        // Only the master (owner) or global admin can promote/demote players in this campaign
        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o mestre da campanha pode alterar papéis.' }), { status: 403, headers });
        }

        if (targetUserId === campaign.owner_id) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Não é possível alterar o papel do criador.' }), { status: 400, headers });
        }

        await dbQueries.updateCampaignPlayerRole(db, campaignId, targetUserId, newRole);
        return new Response(JSON.stringify({ sucesso: true, mensagem: `Papel atualizado para ${newRole}.` }), { status: 200, headers });
      }

      // PERSONAGENS (RLS: O usuário só acessa fichas vinculadas ao seu user_id)
      case 'characters.list': {
        const characters = await dbQueries.getCharactersByUser(db, user.userId);
        return new Response(JSON.stringify({ sucesso: true, dados: characters }), { status: 200, headers });
      }

      case 'characters.create': {
        const { name, campaignId = null, sheetData = {} } = data;
        if (!name || name.trim().length === 0) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Nome do personagem é obrigatório' }), { status: 400, headers });
        }

        const charId = `chr_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
        await dbQueries.createCharacter(db, {
          id: charId,
          userId: user.userId, // RLS: Proprietário injetado pelo token
          campaignId,
          name,
          sheetData
        });

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Personagem criado com sucesso!',
          dados: { id: charId, name, userId: user.userId }
        }), { status: 201, headers });
      }

      // GOVERNANÇA E ADMINISTRAÇÃO (EXCLUSIVO PARA ROLE === 'Admin')
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

      default:
        return new Response(JSON.stringify({
          sucesso: false,
          erro: `Ação desconhecida: "${action}"`
        }), { status: 404, headers });
    }
  } catch (err) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: 'Erro interno ao processar comando de sincronização',
      detalhes: env?.ENVIRONMENT === 'development' ? err.message : undefined
    }), { status: 500, headers });
  }
}
