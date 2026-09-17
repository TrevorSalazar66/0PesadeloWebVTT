import { createLocalD1 } from '../db/localD1.js';
import { dbQueries } from '../db/queries.js';
import { join } from 'path';

const dbPath = join(process.cwd(), '.data/arcana_local.sqlite');
const db = createLocalD1(dbPath);

async function seed() {
  console.log('Seeding mock users...');
  
  const users = [
    { id: 'usr_mock_1', email: 'mestre1@teste.com', name: 'Mestre Ancião', role: 'mestre' },
    { id: 'usr_mock_2', email: 'mestre2@teste.com', name: 'Mestre Sombrio', role: 'mestre' },
    { id: 'usr_mock_3', email: 'mestre3@teste.com', name: 'Senhor dos Dragões', role: 'mestre' }
  ];

  for (const u of users) {
    try {
      await dbQueries.createUser(db, {
        id: u.id, email: u.email, passwordHash: 'hash', salt: 'salt',
        displayName: u.name, role: u.role, emailVerified: 1, profileCompleted: 1
      });
      console.log('Created user:', u.name);
    } catch(e) {
      console.log('User already exists or error:', u.name);
    }
  }

  console.log('Seeding mock campaigns...');
  const campaigns = [
    { id: 'camp_mock_1', simpleId: 'ORACULO-502', name: 'O Oráculo Caído', ownerId: 'usr_mock_1', systemId: 'dnd5e', themeId: 'dark-fantasy', lore: 'Uma jornada nas profundezas.', max: 5 },
    { id: 'camp_mock_2', simpleId: 'VAMPIRO-999', name: 'Sangue em Chicago', ownerId: 'usr_mock_2', systemId: 'vtm', themeId: 'cyberpunk', lore: 'Intrigas noturnas e política sobrenatural na metrópole.', max: 4 },
    { id: 'camp_mock_3', simpleId: 'DRAG-001', name: 'O Covil de Fogo', ownerId: 'usr_mock_3', systemId: 'custom', themeId: 'high-fantasy', lore: 'O antigo dragão vermelho despertou de seu sono milenar.', max: 6 },
    { id: 'camp_mock_4', simpleId: 'CTHULHU-42', name: 'Sussurros do Abismo', ownerId: 'usr_mock_1', systemId: 'coc', themeId: 'dark-fantasy', lore: 'Você não pode escapar da loucura.', max: 3 },
    { id: 'camp_mock_5', simpleId: 'SPACE-777', name: 'Rebelião Estelar', ownerId: 'usr_mock_2', systemId: 'custom', themeId: 'cyberpunk', lore: 'A frota rebelde tenta um último ataque à corporação Mega.', max: 8 }
  ];

  for (const c of campaigns) {
    try {
      await dbQueries.createCampaign(db, {
        id: c.id, simpleId: c.simpleId, name: c.name, ownerId: c.ownerId,
        systemId: c.systemId, themeId: c.themeId, loreDescription: c.lore, maxPlayers: c.max
      });
      console.log('Created campaign:', c.name);
    } catch(e) {
      console.log('Campaign already exists or error:', c.name);
    }
  }
  
  console.log('Seeding complete.');
}

seed();
