import { PrismaClient } from '@/prisma/generated/client/client';
import { PrismaNeon } from '@prisma/adapter-neon';

/**
 * Prisma client singleton.
 *
 * Prisma v7 requires a driver adapter for all connections (the built-in
 * Rust query engine was removed). We use `@prisma/adapter-neon` because
 * our DATABASE_URL points at a Neon Postgres pooler.
 *
 * In dev we attach the client to `globalThis` so HMR doesn't exhaust the
 * connection pool by spinning up a new adapter/client per reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy apps/web/.env.example to apps/web/.env and fill it in.',
    );
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
