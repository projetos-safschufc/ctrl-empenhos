/**
 * Executa o SQL que adiciona as colunas faltantes em ctrl.users (active, updated_at).
 * Uso (na pasta backend): node scripts/run-fix-users-columns.js
 * Requer backend/.env com DB_* (senha com # entre aspas) ou DATABASE_URL.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const backendEnv = process.cwd().endsWith('backend')
  ? path.join(process.cwd(), '.env')
  : path.join(process.cwd(), 'backend', '.env');
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });
else dotenv.config();
const { Client } = require('pg');

function normalizePassword(s) {
  let t = String(s ?? '');
  if (t.startsWith('\uFEFF')) t = t.slice(1);
  t = t.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  return t.replace(/[\x00-\x1F\x7F]/g, '');
}
function getClientConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.DB_HOST || '10.28.0.159',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'safs',
    user: process.env.DB_USER || 'abimael',
    password: normalizePassword(process.env.DB_PASSWORD || ''),
  };
}

async function main() {
  const sqlPath = path.join(__dirname, '../prisma/scripts/add-missing-users-columns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client(getClientConfig());
  try {
    await client.connect();
    await client.query(sql);
    console.log('Colunas adicionadas/atualizadas em ctrl.users com sucesso.');
  } catch (err) {
    console.error('Erro ao executar SQL:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
