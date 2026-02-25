/**
 * Verificação de que o banco está pronto para o Prisma (schema ctrl e tabela profiles existem).
 * Usa information_schema para não disparar erro do Prisma por tabela inexistente.
 * Se não estiver pronto, o servidor não sobe e exibe instrução para npm run db:init.
 */
import { prisma } from '../utils/prisma';

const MSG =
  '\n  >> Banco não inicializado. Na pasta backend execute: npm run db:init\n  >> Depois: npm run seed (para usuário admin)\n';

export async function isDatabaseReady(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'ctrl' AND table_name = 'profiles'
      ) AS exists
    `;
    return result[0]?.exists === true;
  } catch (err) {
    console.error('[Database check] Erro ao verificar schema ctrl:', (err as Error).message);
    return false;
  }
}

export function exitWithDatabaseInstructions(): void {
  console.error(MSG);
  process.exit(1);
}
