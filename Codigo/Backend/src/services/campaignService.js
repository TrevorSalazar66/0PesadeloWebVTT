/**
 * Serviço de Gerenciamento e Lógica de Negócio de Campanhas (Mesas de RPG)
 */
import { dbQueries } from '../db/queries.js';
import { randomUUID } from './cryptoService.js';

// Palavras arcanas/místicas para geração do Simple ID (Opção B do Fundador)
const MYSTIC_WORDS = [
  'TAVERNA', 'DRAGAO', 'ARCANA', 'RUNA', 'SOMBRA',
  'ESPADA', 'CRANIO', 'FORJA', 'MASMORRA', 'ABISMO',
  'GRIMORIO', 'VALIRIA', 'TITAN', 'NEBULA', 'CHAMA',
  'BASTIAO', 'CORUJA', 'LOBO', 'ESPECTRO', 'VORTICE',
  'PORTAL', 'ORACULO', 'ELIXIR', 'RELICARIO', 'SENTINELA'
];

// Sistemas Oficiais Suportados
export const OFFICIAL_SYSTEMS = [
  { 
    id: 'alphad6', 
    name: 'AlphaD6 RPG', 
    badge: 'AlphaD6', 
    icon: 'dice-d6',
    description: 'Sistema oficial baseado em Dice Pool D6, atributos e especializações'
  },
  { 
    id: 'custom', 
    name: 'Sistema Próprio / Livre', 
    badge: 'Custom', 
    icon: 'book',
    description: 'Regras livres e rolagens matemáticas genéricas'
  }
];

// Temas Estéticos e Narrativos
export const OFFICIAL_THEMES = [
  { id: 'dark-fantasy', name: 'Fantasia Sombria', badge: 'Dark Fantasy', color: '#9b2c2c' },
  { id: 'high-fantasy', name: 'Alta Fantasia Épica', badge: 'High Fantasy', color: '#b7791f' },
  { id: 'cosmic-horror', name: 'Terror Cósmico & Mistério', badge: 'Horror Cósmico', color: '#553c9a' },
  { id: 'cyberpunk', name: 'Cyberpunk & Sci-Fi', badge: 'Cyberpunk', color: '#0987a0' },
  { id: 'investigation', name: 'Investigação Sobrenatural', badge: 'Investigação', color: '#276749' }
];

// Limites Rígidos de Segurança e Governança
export const CAMPAIGN_LIMITS = {
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 60,
  MAX_LORE_LENGTH: 2000,
  MIN_PLAYERS: 1,
  DEFAULT_PLAYERS: 5,
  MAX_PLAYERS_GLOBAL: 12 // Teto estrito aprovado pelo fundador
};

/**
 * Gera um ID Simples Místico único (ex: TAVERNA-42, DRAGAO-107)
 */
export async function generateUniqueSimpleId(db) {
  let attempts = 0;
  while (attempts < 20) {
    const word = MYSTIC_WORDS[Math.floor(Math.random() * MYSTIC_WORDS.length)];
    const num = Math.floor(Math.random() * 990) + 10; // 10 a 999
    const candidateId = `${word}-${num}`;

    const existing = await dbQueries.getCampaignBySimpleId(db, candidateId);
    if (!existing) {
      return candidateId;
    }
    attempts++;
  }
  // Fallback seguro caso haja muitas colisões
  return `ARCANA-${Math.floor(Math.random() * 9000) + 1000}`;
}

/**
 * Sanitiza texto contra tags maliciosas
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}
