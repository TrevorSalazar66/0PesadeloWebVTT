/**
 * Serviço Criptográfico Nativo (WebCrypto W3C) — Sem dependências externas
 */

const cryptoSubtle = globalThis.crypto?.subtle || (await import('node:crypto')).webcrypto.subtle;
const randomUUID = () => globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2));

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

function base64UrlEncode(str) {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Gera um Salt aleatório criptograficamente seguro de 16 bytes
 */
export function generateSalt() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
}

/**
 * Derivação de chave e Hash de senha com PBKDF2 (100.000 iterações, HMAC-SHA256)
 */
export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await cryptoSubtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await cryptoSubtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBuffer(saltHex),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign']
  );

  const rawKey = await cryptoSubtle.exportKey('raw', derivedKey);
  return bufferToHex(rawKey);
}

/**
 * Verificação de senha com comparação constante de tempo
 */
export async function verifyPassword(password, storedHashHex, saltHex) {
  const calculatedHashHex = await hashPassword(password, saltHex);
  if (calculatedHashHex.length !== storedHashHex.length) return false;
  
  let result = 0;
  for (let i = 0; i < calculatedHashHex.length; i++) {
    result |= calculatedHashHex.charCodeAt(i) ^ storedHashHex.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Assina um JWT usando HMAC-SHA256 e chave secreta
 */
export async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await cryptoSubtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await cryptoSubtle.sign(
    'HMAC',
    key,
    enc.encode(dataToSign)
  );

  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Valida a assinatura de um JWT e retorna o payload decodificado
 */
export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;

    const enc = new TextEncoder();
    const key = await cryptoSubtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const rawSigString = base64UrlDecode(signatureB64);
    const sigBytes = new Uint8Array(rawSigString.length);
    for (let i = 0; i < rawSigString.length; i++) {
      sigBytes[i] = rawSigString.charCodeAt(i);
    }

    const isValid = await cryptoSubtle.verify(
      'HMAC',
      key,
      sigBytes,
      enc.encode(dataToVerify)
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < nowInSeconds) {
      return null; // Token expirado
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Utilitários para Cookies HttpOnly seguros
 */
export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

export function createAuthCookie(token, maxAgeSeconds = 900) {
  // Atributos: HttpOnly (bloqueia XSS), Secure (apenas HTTPS/Localhost), SameSite=Strict (bloqueia CSRF)
  return `arcana_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}

export function createClearCookie() {
  return `arcana_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export { randomUUID };
