import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function buildUrl(base) {
  if (!base || base.includes('connection_limit')) return base;
  return base + (base.includes('?') ? '&' : '?') + 'connection_limit=1';
}

const pooledUrl = buildUrl(process.env.POSTGRES_PRISMA_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    ...(pooledUrl ? { datasources: { db: { url: pooledUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
