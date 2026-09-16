import { DatabaseSync } from 'node:sqlite';

const targetDbs = [
  './Código/Backend/.data/arcana_local.sqlite',
  './Código/Backend/arcana_local.sqlite'
];

const targetHash = 'dev_e4dc30b4ab09db9caeff32d6';

for (const dbPath of targetDbs) {
  try {
    const db = new DatabaseSync(dbPath);
    const info = db.prepare(`
      UPDATE device_security 
      SET status = 'ACTIVE', 
          reason = '', 
          accounts_created_count = 0,
          unblocked_by = 'usr_superadmin_trevor',
          unblocked_at = datetime('now')
      WHERE device_hash = ?
    `).run(targetHash);
    console.log(`Desbloqueado em ${dbPath}: ${info.changes} linha(s) alterada(s)`);
    
    // Mostra o registro atualizado
    const row = db.prepare('SELECT * FROM device_security WHERE device_hash = ?').get(targetHash);
    console.log('Registro atual:', row);
  } catch (err) {
    console.error(`Erro ao desbloquear em ${dbPath}:`, err.message);
  }
}
