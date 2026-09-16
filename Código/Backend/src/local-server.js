/**
 * Servidor Local de Desenvolvimento e Simulação do Gateway Cloudflare Worker
 * Roda na porta 8787 conectando ao banco D1 local
 */
import http from 'node:http';
import worker from './index.js';
import { createLocalD1 } from './db/localD1.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8787;
const currentDir = dirname(fileURLToPath(import.meta.url));
const dbFile = join(currentDir, '../arcana_local.sqlite');

// Instancia o Banco D1 SQLite Local
const localD1 = createLocalD1(dbFile);

// Configuração do ambiente emulado
const env = {
  ENVIRONMENT: 'development',
  ALLOWED_ORIGINS: 'http://localhost:5500,http://127.0.0.1:5500,https://arcana.pages.dev',
  JWT_SECRET: 'arcana-super-secret-key-development-local-2026-vtt',
  DB: localD1
};

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const protocol = 'http';
    const fullUrl = `${protocol}://${host}${req.url}`;

    // Leitura do corpo da requisição
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : Buffer.concat(chunks);

    // Conversão de headers do Node para Headers Web padrão
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    // Cria a Request compatível com a API padrão do Cloudflare Worker
    const webRequest = new Request(fullUrl, {
      method: req.method,
      headers,
      body
    });

    // Despacha para o manipulador fetch do Cloudflare Worker
    const webResponse = await worker.fetch(webRequest, env, {});

    // Retorna a resposta HTTP
    res.statusCode = webResponse.status;
    
    // Tratamento especial para múltiplos Set-Cookie
    for (const [key, value] of webResponse.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        const existing = res.getHeader('Set-Cookie') || [];
        const arrayValues = Array.isArray(existing) ? existing : [existing];
        res.setHeader('Set-Cookie', [...arrayValues, value]);
      } else {
        res.setHeader(key, value);
      }
    }

    const responseBuffer = await webResponse.arrayBuffer();
    res.end(Buffer.from(responseBuffer));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      sucesso: false,
      erro: 'Falha interna no servidor local',
      mensagem: err.message
    }));
  }
});

// Apenas inicializa o listener se executado diretamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`🗡️ [Arcana VTT] Servidor Backend Gateway rodando em: http://localhost:${PORT}`);
    console.log(`🛡️ Endpoints disponíveis: /api/auth | /api/sync | /ws/room`);
    console.log(`💾 Banco Cloudflare D1 Local carregado com sucesso.`);
  });
}

export { server, env };
