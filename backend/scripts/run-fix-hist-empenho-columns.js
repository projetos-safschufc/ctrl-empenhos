/**
 * Adiciona colunas de snapshot em ctrl.hist_ctrl_empenho.
 * Uso (na pasta backend): npm run db:fix-hist-empenho-columns
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
  const sqlPath = path.join(__dirname, '../prisma/scripts/add-missing-hist-ctrl-empenho-columns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client(getClientConfig());
  try {
    await client.connect();
    await client.query(sql);
    console.log('Colunas de ctrl.hist_ctrl_empenho verificadas/adicionadas com sucesso.');
  } catch (err) {
    console.error('Erro ao executar SQL:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
