import * as dotenv from 'dotenv';
import path from 'path';

// Carrega backend/.env (senha com # entre aspas; normalização mantém #, remove BOM/controle)
const backendEnv = path.resolve(__dirname, '../.env');
dotenv.config({ path: backendEnv });
dotenv.config();
function normalizePassword(s: string): string {
  let t = String(s ?? '');
  if (t.startsWith('\uFEFF')) t = t.slice(1);
  t = t.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  return t.replace(/[\x00-\x1F\x7F]/g, '');
}
if (!process.env.DATABASE_URL && process.env.DB_PASSWORD) {
  const raw = normalizePassword(process.env.DB_PASSWORD);
  const host = process.env.DB_HOST || '10.28.0.159';
  const port = process.env.DB_PORT || '5432';
  const db = process.env.DB_DATABASE || 'safs';
  const user = process.env.DB_USER || 'abimael';
  process.env.DATABASE_URL = `postgresql://${user}:${encodeURIComponent(raw)}@${host}:${port}/${db}`;
}

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {

  const profiles = [
    { name: 'admin', permissions: '{"users":true,"controle":true,"provisionamento":true,"movimentacao":true}' },
    { name: 'gerente', permissions: '{"controle":true,"provisionamento":true,"movimentacao":true}' },
    { name: 'consultor', permissions: '{"controle":false,"provisionamento":false,"movimentacao":true}' },
  ];

  for (const p of profiles) {
    await prisma.profile.upsert({
      where: { name: p.name },
      update: { permissions: p.permissions },
      create: p,
    });
  }

  const adminProfile = await prisma.profile.findUnique({ where: { name: 'admin' } });
  if (!adminProfile) throw new Error('Perfil admin não encontrado');

  const email = 'admin@safs.local';
  const plainPassword = 'Admin@123#';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, profileId: adminProfile.id },
    create: {
      email,
      passwordHash,
      name: 'Administrador',
      profileId: adminProfile.id,
    },
  });

  console.log('Seed concluído: perfis admin, gerente, consultor e usuário admin (admin@safs.local / Admin@123#)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
