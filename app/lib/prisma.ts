import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const g = globalThis as unknown as { __prisma?: PrismaClient };

function createClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma = g.__prisma ?? createClient();
g.__prisma = prisma;
