/**
 * Cria o schema ctrl e as tabelas (profiles, users, safs_catalogo, hist_ctrl_empenho, empenho) se não existirem.
 * Uso (na pasta backend): npm run db:init
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
  const sqlPath = path.join(__dirname, '../prisma/scripts/init-ctrl-schema-if-not-exists.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client(getClientConfig());
  try {
    await client.connect();
    await client.query(sql);
    console.log('Schema ctrl e tabelas criados/verificados com sucesso.');
  } catch (err) {
    const msg = err.message || '';
    const code = err.code || '';
    const isConnectionError =
      code === 'EHOSTUNREACH' ||
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      msg.indexOf('EHOSTUNREACH') !== -1 ||
      msg.indexOf('ECONNREFUSED') !== -1 ||
      msg.indexOf('ENOTFOUND') !== -1;

    if (isConnectionError) {
      const config = getClientConfig();
      let host = config.host || '?';
      if (config.connectionString) {
        const m = config.connectionString.match(/@([^:/]+)(:\d+)?\//);
        host = m ? m[1] : '(definido em DATABASE_URL)';
      }
      console.error('Erro ao executar SQL:', msg);
      console.error('');
      console.error('O banco de dados não está acessível (host inalcançável ou recusando conexão).');
      console.error('Verifique:');
      console.error('  1. Arquivo backend/.env com DB_HOST, DB_PORT, DB_USER, DB_PASSWORD (ou DATABASE_URL).');
      console.error('  2. Rede/VPN: o host', host, 'precisa estar acessível a partir desta máquina.');
      console.error('  3. Se o PostgreSQL está rodando e a porta está liberada no firewall.');
      console.error('  Para banco local: defina DB_HOST=localhost no .env (copie de .env.example).');
    } else {
      console.error('Erro ao executar SQL:', msg);
    }
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

main();
