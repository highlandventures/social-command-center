import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function buildUrl(base) {
  if (!base || base.includes('connection_limit')) return base;
  return base + (base.includes('?') ? '&' : '?') + 'connection_limit=1';
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: { url: buildUrl(process.env.POSTGRES_PRISMA_URL) },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
