import { timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma';

// Route Handlers under /api/meli are called server-to-server by n8n, so they
// skip the session cookie (see proxy.ts) and authenticate with a shared key.
export function isMeliAuthorized(request: Request): boolean {
  const expected = process.env.MELI_API_KEY;
  const provided = request.headers.get('x-api-key');
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Sizes are stored lowercase (see compareSizes in domain.ts).
export const normalizeSize = (size: string) => size.trim().toLowerCase();

export async function findUserByMeliId(meliUserId: string) {
  return prisma.user.findUnique({ where: { meliUserId }, select: { id: true } });
}

export async function findModelIdsByListing(meliItemIds: string[]): Promise<Map<string, string>> {
  const rows = await prisma.meliListing.findMany({
    where: { meliItemId: { in: meliItemIds } },
    select: { meliItemId: true, modelId: true },
  });
  return new Map(rows.map((r) => [r.meliItemId, r.modelId]));
}

// Remembers which model a listing is, so the next order for it resolves
// without asking. Overwrites a previous link (a listing is one model).
export async function linkListing(meliItemId: string, modelId: string) {
  await prisma.meliListing.upsert({
    where: { meliItemId },
    update: { modelId },
    create: { meliItemId, modelId },
  });
}
