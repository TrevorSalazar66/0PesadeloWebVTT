/**
 * Script de Criação / Atualização da Conta Superadmin do Fundador
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSalt, hashPassword } from '../services/cryptoService.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(currentDir, '../../../Banco/schema.sql');
const schemaSql = readFileSync(schemaPath, 'utf-8');

const targetDbPaths = [
  join(currentDir, '../../.data/arcana_local.sqlite'),
  join(currentDir, '../../arcana_local.sqlite')
];

const SUPERADMIN = {
  id: 'usr_superadmin_trevor',
  email: 'trevor.salazar.www.com@gmail.com',
  password: 'SPadmin++',
  displayName: 'TrevorSalazar',
  nickname: 'Trevorrot',
  role: 'superadmin',
  ageGroup: '+18',
  bio: 'Eu sou o fundador',
  contacts: JSON.stringify({ whatsapp: '', discord: '', instagram: '' }),
  avatarUrl: '',
  bannerUrl: ''
};

async function seedDatabase(dbPath) {
  console.log(`\n📦 Processando banco de dados: ${dbPath}`);
  const sqlite = new DatabaseSync(dbPath);

  // Executa o schema base
  sqlite.exec(schemaSql);

  // Migração segura para atualizar a CHECK constraint de role em tabelas antigas
  const tableSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || '';
  if (!tableSql.includes('superadmin')) {
    console.log('   Atualizando constraint de role na tabela users antiga...');
    sqlite.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL COLLATE NOCASE,
          password_hash TEXT,
          salt TEXT,
          google_id TEXT UNIQUE,
          avatar_url TEXT DEFAULT '',
          display_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'jogador' CHECK (role IN ('jogador', 'assistente de mestre', 'mestre', 'admin', 'superadmin', 'Jogador', 'Mestre', 'Admin')),
          email_verified INTEGER NOT NULL DEFAULT 0,
          profile_completed INTEGER NOT NULL DEFAULT 0,
          auth_provider TEXT NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'both')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users_new (id, email, password_hash, salt, google_id, avatar_url, display_name, role, email_verified, auth_provider, created_at)
      SELECT id, email, password_hash, salt, google_id, avatar_url, display_name, role, email_verified, auth_provider, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
      PRAGMA foreign_keys = ON;
    `);
  }

  try {
    sqlite.exec('ALTER TABLE users ADD COLUMN profile_completed INTEGER NOT NULL DEFAULT 0;');
  } catch (_) {}

  // Gera hash seguro PBKDF2 com salt aleatório
  const salt = generateSalt();
  const passwordHash = await hashPassword(SUPERADMIN.password, salt);

  // 1. Inserção ou Atualização na tabela users
  const existingUser = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(SUPERADMIN.email.toLowerCase().trim());
  let userId = SUPERADMIN.id;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`   Usuário já existia no banco com ID: ${userId}. Atualizando credenciais e permissão...`);
    const updateStmt = sqlite.prepare(`
      UPDATE users 
      SET password_hash = ?, 
          salt = ?, 
          display_name = ?, 
          role = ?, 
          email_verified = 1, 
          profile_completed = 1, 
          auth_provider = 'email'
      WHERE id = ?
    `);
    updateStmt.run(passwordHash, salt, SUPERADMIN.displayName, SUPERADMIN.role, userId);
  } else {
    console.log(`   Criando nova conta Superadmin com ID: ${userId}...`);
    const insertStmt = sqlite.prepare(`
      INSERT INTO users (id, email, password_hash, salt, display_name, role, email_verified, profile_completed, auth_provider)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'email')
    `);
    insertStmt.run(userId, SUPERADMIN.email.toLowerCase().trim(), passwordHash, salt, SUPERADMIN.displayName, SUPERADMIN.role);
  }

  // 2. Inserção ou Atualização na tabela user_profiles
  console.log(`   Gravando perfil público (Nickname: @${SUPERADMIN.nickname}, Faixa Etária: ${SUPERADMIN.ageGroup})...`);
  const profileStmt = sqlite.prepare(`
    INSERT INTO user_profiles (user_id, name, nickname, age_group, bio, contacts, avatar_url, banner_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      name = excluded.name,
      nickname = excluded.nickname,
      age_group = excluded.age_group,
      bio = excluded.bio,
      contacts = excluded.contacts,
      avatar_url = excluded.avatar_url,
      banner_url = excluded.banner_url,
      updated_at = datetime('now')
  `);
  profileStmt.run(
    userId,
    SUPERADMIN.displayName,
    SUPERADMIN.nickname,
    SUPERADMIN.ageGroup,
    SUPERADMIN.bio,
    SUPERADMIN.contacts,
    SUPERADMIN.avatarUrl,
    SUPERADMIN.bannerUrl
  );

  // Verificação
  const verifiedUser = sqlite.prepare('SELECT id, email, display_name, role, email_verified, profile_completed FROM users WHERE id = ?').get(userId);
  const verifiedProfile = sqlite.prepare('SELECT user_id, nickname, age_group, bio FROM user_profiles WHERE user_id = ?').get(userId);

  console.log('   ✅ Verificação de integridade no banco:');
  console.log('      Usuário:', verifiedUser);
  console.log('      Perfil:', verifiedProfile);
}

async function main() {
  for (const p of targetDbPaths) {
    await seedDatabase(p);
  }
  console.log('\n🌟 CONTA SUPERADMIN CRIADA E ATIVADA COM SUCESSO EM TODOS OS BANCOS LOCAIS!\n');
}

main().catch(err => {
  console.error('❌ Erro ao criar conta:', err);
  process.exit(1);
});
