/**
 * Gateway Unificado de Sincronização e Comandos (/api/sync)
 * Roteamento interno blindado com RLS lógico e despacho desacoplado
 */
import { authenticateRequest } from '../middleware/authMiddleware.js';
import { dbQueries } from '../db/queries.js';
import { LIMITS } from '../config/limits.js';
import { checkRateLimit } from '../middleware/rateLimiter.js';
import { applySecurityHeaders } from '../config/securityHeaders.js';
import { randomUUID } from './cryptoService.js';
import { adminService } from './adminService.js';

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

  // ----------------------------------------------------
  // DESPACHO INTERNO POR NAMESPACE
  // ----------------------------------------------------
  try {
    switch (action) {
      // PERFIL
      case 'profile.get': {
        const profile = await dbQueries.getUserById(db, user.userId);
        return new Response(JSON.stringify({ sucesso: true, dados: profile }), { status: 200, headers });
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

      case 'campaigns.create': {
        const { name, systemId = 'retroforge-core', description = '' } = data;
        if (!name || name.trim().length === 0) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'O nome da campanha é obrigatório' }), { status: 400, headers });
        }
        if (name.length > LIMITS.MAX_CAMPAIGN_NAME_LENGTH) {
          return new Response(JSON.stringify({ sucesso: false, erro: `Nome da campanha excede o limite de ${LIMITS.MAX_CAMPAIGN_NAME_LENGTH} caracteres` }), { status: 400, headers });
        }

        const campaignId = `cmp_${randomUUID().replace(/-/g, '').substring(0, 12)}`;
        await dbQueries.createCampaign(db, {
          id: campaignId,
          name,
          ownerId: user.userId, // RLS: Dono inviolável obtido do JWT
          systemId,
          description
        });

        return new Response(JSON.stringify({
          sucesso: true,
          mensagem: 'Campanha criada com sucesso!',
          dados: { id: campaignId, name, ownerId: user.userId, systemId }
        }), { status: 201, headers });
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
