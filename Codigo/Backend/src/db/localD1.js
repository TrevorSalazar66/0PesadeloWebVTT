/**
 * Emulador local 1:1 do Cloudflare D1 utilizando o motor nativo SQLite do Node.js
 * Permite rodar e testar localmente sem necessidade de conexão com a nuvem
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function createLocalD1(dbPath = ':memory:') {
  const sqlite = new DatabaseSync(dbPath);
  
  // 1. Migrações preventivas para bancos de dados locais já existentes em disco
  try {
    const usersTableSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || '';
    if (usersTableSql) {
      try {
        sqlite.exec(`ALTER TABLE users ADD COLUMN profile_completed INTEGER NOT NULL DEFAULT 0;`);
      } catch (_) {}

      if (!usersTableSql.includes('superadmin') || usersTableSql.includes('assistente de mestre')) {
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
              role TEXT NOT NULL DEFAULT 'jogador' CHECK (role IN ('jogador', 'mestre', 'admin', 'superadmin', 'Jogador', 'Mestre', 'Admin')),
              email_verified INTEGER NOT NULL DEFAULT 0,
              profile_completed INTEGER NOT NULL DEFAULT 0,
              auth_provider TEXT NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'both')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO users_new (id, email, password_hash, salt, google_id, avatar_url, display_name, role, email_verified, profile_completed, auth_provider, created_at)
          SELECT id, email, password_hash, salt, google_id, avatar_url, display_name, 
                 CASE WHEN role = 'assistente de mestre' THEN 'jogador' ELSE role END, 
                 email_verified, COALESCE(profile_completed, 0), auth_provider, created_at FROM users;
          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
          CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
          PRAGMA foreign_keys = ON;
        `);
      }
    }
  } catch (err) {
    console.warn('[LocalD1] Migração preventiva users:', err.message);
  }

  try {
    const campTableSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='campaigns'").get()?.sql || '';
    if (campTableSql && !campTableSql.includes('simple_id')) {
      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE campaigns_new (
            id TEXT PRIMARY KEY,
            simple_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            system_id TEXT NOT NULL DEFAULT 'custom',
            theme_id TEXT NOT NULL DEFAULT 'dark-fantasy',
            lore_description TEXT NOT NULL DEFAULT '',
            image_url TEXT NOT NULL DEFAULT '',
            banner_url TEXT NOT NULL DEFAULT '',
            max_players INTEGER NOT NULL DEFAULT 5 CHECK (max_players >= 1 AND max_players <= 12),
            sessions INTEGER NOT NULL DEFAULT 0,
            next_session TEXT NOT NULL DEFAULT '',
            notices TEXT NOT NULL DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        );
        INSERT INTO campaigns_new (id, simple_id, name, owner_id, system_id, theme_id, lore_description, created_at)
        SELECT id, 'ARCANA-' || hex(randomblob(2)), name, owner_id, COALESCE(system_id, 'custom'), 'dark-fantasy', COALESCE(description, ''), created_at FROM campaigns;
        DROP TABLE campaigns;
        ALTER TABLE campaigns_new RENAME TO campaigns;
        CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
        CREATE INDEX IF NOT EXISTS idx_campaigns_simple_id ON campaigns(simple_id);
        PRAGMA foreign_keys = ON;
      `);
    } else if (campTableSql && !campTableSql.includes('sessions')) {
      sqlite.exec(`
        ALTER TABLE campaigns ADD COLUMN sessions INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE campaigns ADD COLUMN next_session TEXT NOT NULL DEFAULT '';
        ALTER TABLE campaigns ADD COLUMN notices TEXT NOT NULL DEFAULT '';
      `);
    }
  } catch (err) {
    console.warn('[LocalD1] Migração preventiva campaigns:', err.message);
  }

  try {
    const cpTableSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='campaign_players'").get()?.sql || '';
    if (cpTableSql && !cpTableSql.includes('assistente de mestre')) {
      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE campaign_players_new (
            campaign_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'jogador' CHECK (role IN ('jogador', 'assistente de mestre', 'mestre', 'Jogador', 'Mestre')),
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (campaign_id, user_id),
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        INSERT INTO campaign_players_new (campaign_id, user_id, role, joined_at)
        SELECT campaign_id, user_id, role, joined_at FROM campaign_players;
        DROP TABLE campaign_players;
        ALTER TABLE campaign_players_new RENAME TO campaign_players;
        PRAGMA foreign_keys = ON;
      `);
    }
  } catch (err) {
    console.warn('[LocalD1] Migração preventiva campaign_players:', err.message);
  }

  // 2. Carrega e executa o esquema oficial de tabelas e índices
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const schemaPath = join(currentDir, '../../../Banco/schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    sqlite.exec(schemaSql);
  } catch (err) {
    console.warn('[LocalD1] Aviso ao inicializar esquema:', err.message);
  }

  // Interface idêntica à do Cloudflare D1 (prepare, bind, first, all, run)
  return {
    prepare(query) {
      return {
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          const stmt = sqlite.prepare(query);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = sqlite.prepare(query);
          const results = stmt.all(...this._params);
          return { results };
        },
        async run() {
          const stmt = sqlite.prepare(query);
          const info = stmt.run(...this._params);
          return {
            success: true,
            meta: {
              changes: info.changes,
              last_row_id: info.lastInsertRowid
            }
          };
        }
      };
    },
    async exec(query) {
      sqlite.exec(query);
      return { success: true };
    }
  };
}
