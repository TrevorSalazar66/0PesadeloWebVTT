/**
 * Ponto de Entrada Principal (Gateway Cloudflare Worker) — Arcana VTT
 * Apenas 2 endpoints HTTP (/api/auth e /api/sync) e 1 endpoint WebSocket (/ws/room)
 */

import { validateRequestSecurity } from './middleware/validator.js';
import { handleAuthRequest } from './services/authService.js';
import { handleSyncRequest } from './services/syncService.js';
import { handleWebSocketUpgrade } from './services/roomService.js';
import { applySecurityHeaders } from './config/securityHeaders.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const clientIp = request.headers.get('CF-Connecting-IP') 
      || request.headers.get('X-Forwarded-For')?.split(',')[0].trim() 
      || '127.0.0.1';

    // 1. Validação de Fronteira e Pré-requisitos de Segurança
    const securityCheckResponse = await validateRequestSecurity(request, env);
    if (securityCheckResponse) {
      return securityCheckResponse;
    }

    try {
      // 2. Roteamento Estrito dos 2 Endpoints Mínimos e WebSocket
      if (url.pathname === '/api/auth') {
        if (request.method !== 'POST') {
          return new Response('Método não permitido', { status: 405 });
        }
        return await handleAuthRequest(request, env, clientIp);
      }

      if (url.pathname === '/api/sync') {
        if (request.method !== 'POST') {
          return new Response('Método não permitido', { status: 405 });
        }
        return await handleSyncRequest(request, env, clientIp);
      }

      if (url.pathname === '/ws/room') {
        return await handleWebSocketUpgrade(request, env);
      }

      // Rota de Diagnóstico / Health Check
      if (url.pathname === '/health' || url.pathname === '/') {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        applySecurityHeaders(headers, origin, env);
        return new Response(JSON.stringify({
          status: 'online',
          servico: 'Arcana VTT Backend Gateway',
          ambiente: env?.ENVIRONMENT || 'production',
          endpoints: ['/api/auth', '/api/sync', '/ws/room']
        }), { status: 200, headers });
      }

      // Rota Não Encontrada
      const notFoundHeaders = new Headers({ 'Content-Type': 'application/json' });
      applySecurityHeaders(notFoundHeaders, origin, env);
      return new Response(JSON.stringify({
        sucesso: false,
        erro: `Endpoint '${url.pathname}' não encontrado`
      }), { status: 404, headers: notFoundHeaders });

    } catch (err) {
      const errorHeaders = new Headers({ 'Content-Type': 'application/json' });
      applySecurityHeaders(errorHeaders, origin, env);
      return new Response(JSON.stringify({
        sucesso: false,
        erro: 'Erro interno no gateway',
        detalhes: env?.ENVIRONMENT === 'development' ? err.message : undefined
      }), { status: 500, headers: errorHeaders });
    }
  }
};
