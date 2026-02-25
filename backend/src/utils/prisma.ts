import '../config/env';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Cliente Prisma singleton. DATABASE_URL já inclui connection_limit, connect_timeout e pool_timeout
 * (via getDatabaseUrl em config/database.ts) para reduzir ConnectionReset (10054) pelo host remoto.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
