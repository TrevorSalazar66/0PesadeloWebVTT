/**
 * Gerenciador de conexões WebSocket para a Mesa em Tempo Real (/ws/room)
 */
import { authenticateRequest } from '../middleware/authMiddleware.js';

export async function handleWebSocketUpgrade(request, env) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Esperado cabeçalho Upgrade: websocket', { status: 426 });
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');

  if (!campaignId) {
    return new Response('Parâmetro "campaignId" é obrigatório', { status: 400 });
  }

  // Autenticação da conexão de WebSocket
  const user = await authenticateRequest(request, env);
  if (!user) {
    return new Response('Não autorizado para ingressar na mesa', { status: 401 });
  }

  // No Cloudflare Workers nativo, utiliza-se WebSocketPair
  if (typeof WebSocketPair !== 'undefined') {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    server.addEventListener('message', event => {
      try {
        const msg = JSON.parse(event.data);
        // Echo / Broadcast simulado
        server.send(JSON.stringify({
          tipo: 'ACK',
          usuario: user.displayName,
          evento: msg.tipo,
          timestamp: Date.now()
        }));
      } catch (e) {}
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  return new Response('WebSocket pronto para conexão na borda Cloudflare', { status: 200 });
}
