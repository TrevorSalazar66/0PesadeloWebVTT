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
  
  // Carrega e executa o esquema oficial de tabelas
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
