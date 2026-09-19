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
        const { campaignId, autoApproveActions, clockTriggers } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Campanha não encontrada.' }), { status: 404, headers });
        }

        if (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role)) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o mestre pode alterar as configurações da campanha.' }), { status: 403, headers });
        }

        let currentSettings = {};
        try {
          currentSettings = typeof campaign.settings === 'string' ? JSON.parse(campaign.settings) : (campaign.settings || {});
        } catch (_) {}

        if (autoApproveActions !== undefined) {
          currentSettings.auto_approve_actions = Number(autoApproveActions) ? 1 : 0;
        }
        if (clockTriggers !== undefined) {
          currentSettings.clock_triggers = clockTriggers;
        }

        await dbQueries.updateCampaignSettings(db, campaignId, currentSettings);

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Configurações da campanha atualizadas com sucesso.',
          dados: currentSettings
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

      case 'campaigns.scenes.create': {
        const { campaignId, name, description = '', imageUrl = '', xpTriggers = [] } = data;
        if (!campaignId || !name) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha e nome da cena são obrigatórios.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign || (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role))) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre pode criar cenas nesta campanha.' }), { status: 403, headers });
        }

        const sceneId = `scn_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
        await dbQueries.createScene(db, {
          id: sceneId,
          campaignId,
          name,
          description,
          imageUrl,
          xpTriggers
        });

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Cena criada com sucesso!',
          dados: { id: sceneId, campaignId, name, xpTriggers }
        }), { status: 201, headers });
      }

      case 'campaigns.scenes.list': {
        const { campaignId } = data;
        if (!campaignId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'ID da campanha obrigatório.' }), { status: 400, headers });
        }
        const scenes = await dbQueries.getScenesByCampaign(db, campaignId);
        const parsed = scenes.map(s => ({
          ...s,
          xp_triggers: typeof s.xp_triggers === 'string' ? JSON.parse(s.xp_triggers || '[]') : (s.xp_triggers || [])
        }));
        return new Response(JSON.stringify({ sucesso: true, dados: parsed }), { status: 200, headers });
      }

      case 'campaigns.scenes.triggerXP': {
        const { campaignId, sceneId, triggerId } = data;
        if (!campaignId || !sceneId || !triggerId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Dados incompletos para acionar gatilho de cena.' }), { status: 400, headers });
        }

        const campaign = await dbQueries.getCampaignById(db, campaignId);
        if (!campaign || (campaign.owner_id !== user.userId && !['admin', 'superadmin'].includes(user.role))) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Apenas o Mestre pode acionar gatilhos de XP.' }), { status: 403, headers });
        }

        const scene = await dbQueries.getSceneById(db, sceneId);
        if (!scene) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Cena não encontrada.' }), { status: 404, headers });
        }

        let triggers = typeof scene.xp_triggers === 'string' ? JSON.parse(scene.xp_triggers || '[]') : (scene.xp_triggers || []);
        const trigger = triggers.find(t => t.id === triggerId);
        if (!trigger) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Gatilho de XP não encontrado na cena.' }), { status: 404, headers });
        }

        if (trigger.status === 'awarded') {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Este gatilho de XP já foi concedido anteriormente.' }), { status: 400, headers });
        }

        const xpToGive = Math.max(1, Math.floor(Number(trigger.xp) || 1));
        const party = await dbQueries.getCharactersByCampaign(db, campaignId);
        
        for (const char of party) {
          let sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : (char.sheet_data || {});
          sheet.xp_atual = Math.max(0, Math.floor(Number(sheet.xp_atual) || 0)) + xpToGive;
          await dbQueries.updateCharacterSheet(db, char.id, sheet);
        }

        // Marca o gatilho como awarded
        trigger.status = 'awarded';
        trigger.awarded_at = new Date().toISOString();
        await dbQueries.updateScene(db, sceneId, { xpTriggers: triggers });

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: `Gatilho "${trigger.titulo || triggerId}" acionado! ${xpToGive} XP concedido a ${party.length} personagem(ns).`,
          dados: {
            sceneId,
            triggerId,
            xpConcedido: xpToGive,
            personagensAfetados: party.length
          }
        }), { status: 200, headers });
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

        // Trava de Integridade: Limite de 1 Personagem por Jogador por Campanha
        if (campaignId) {
          const existingChar = await dbQueries.getCharacterByUserAndCampaign(db, user.userId, campaignId);
          if (existingChar) {
            return new Response(JSON.stringify({
              sucesso: false,
              codigo: 'LIMIT_REACHED',
              erro: `Limite atingido: Você já possui o personagem "${existingChar.name}" vinculado a esta campanha. Cada jogador pode possuir apenas 1 personagem por campanha.`
            }), { status: 400, headers });
          }
        }

        // Suporte a payload genérico com sheetData pré-formatado
        if (data.sheetData && !atributos) {
          const charId = `chr_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
          await dbQueries.createCharacter(db, {
            id: charId,
            userId: user.userId,
            campaignId,
            name,
            sheetData: data.sheetData
          });
          return new Response(JSON.stringify({
            sucesso: true,
            mensagem: 'Personagem criado com sucesso!',
            dados: { id: charId, name, userId: user.userId, campaignId, sheet: data.sheetData }
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
            campaignId,
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
              campaignId,
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
