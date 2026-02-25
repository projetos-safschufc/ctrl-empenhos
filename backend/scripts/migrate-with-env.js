/**
 * Script para rodar migrations com DATABASE_URL montada a partir de DB_*.
 * Uso: node scripts/migrate-with-env.js (na pasta backend)
 *
 * Senha com # no .env deve estar entre aspas: DB_PASSWORD="abi123!@#qwe"
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const backendEnv = process.cwd().endsWith('backend')
  ? path.join(process.cwd(), '.env')
  : path.join(process.cwd(), 'backend', '.env');
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });
else dotenv.config();

function normalizePassword(s) {
  let t = String(s ?? '');
  if (t.startsWith('\uFEFF')) t = t.slice(1);
  t = t.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  return t.replace(/[\x00-\x1F\x7F]/g, '');
}
if (!process.env.DATABASE_URL && process.env.DB_PASSWORD) {
  const raw = normalizePassword(process.env.DB_PASSWORD);
  const encoded = encodeURIComponent(raw);
  process.env.DATABASE_URL = [
    'postgresql://',
    process.env.DB_USER || 'abimael',
    ':',
    encoded,
    '@',
    process.env.DB_HOST || '10.28.0.159',
    ':',
    process.env.DB_PORT || '5432',
    '/',
    process.env.DB_DATABASE || 'safs',
  ].join('');
}

const { execSync } = require('child_process');
const args = process.argv.slice(2);
const cmd = args.length ? `npx prisma migrate ${args.join(' ')}` : 'npx prisma migrate dev';
execSync(cmd, { stdio: 'inherit' });
