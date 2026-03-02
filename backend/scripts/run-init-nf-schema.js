/**
 * Cria o schema nf e as tabelas (recebimento_nota_fiscal, item_recebimento_nf) se não existirem.
 * Uso (na pasta backend): npm run db:init-nf
 * Requer backend/.env com DB_* ou NF_* (senha com # entre aspas) ou DATABASE_URL.
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
  const host = process.env.NF_HOST ?? process.env.DB_HOST ?? 'localhost';
  const port = parseInt(process.env.NF_PORT ?? process.env.DB_PORT ?? '5432', 10);
  const database = process.env.NF_DATABASE ?? process.env.DB_DATABASE ?? 'postgres';
  const user = process.env.NF_USER ?? process.env.DB_USER ?? 'postgres';
  const password = normalizePassword(process.env.NF_PASSWORD ?? process.env.DB_PASSWORD ?? '');
  return { host, port, database, user, password };
}

async function main() {
  const sqlPath = path.join(__dirname, '../database/nf/01_create_nf_schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Arquivo SQL não encontrado:', sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client(getClientConfig());
  try {
    await client.connect();
    await client.query(sql);
    console.log('Schema nf e tabelas (recebimento_nota_fiscal, item_recebimento_nf) criados/verificados com sucesso.');
  } catch (err) {
    const msg = err.message || '';
    const code = err.code || '';
    const isConnectionError =
      code === 'EHOSTUNREACH' ||
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      msg.includes('EHOSTUNREACH') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ENOTFOUND');

    if (isConnectionError) {
      const config = getClientConfig();
      const host = config.host || (config.connectionString && config.connectionString.match(/@([^:/]+)/)?.[1]) || '?';
      console.error('Erro ao executar SQL:', msg);
      console.error('');
      console.error('O banco de dados não está acessível.');
      console.error('Verifique backend/.env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD ou DATABASE_URL) e conectividade.');
      console.error('Host utilizado:', host);
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
