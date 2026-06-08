'use server';

import { prisma } from '@/app/lib/prisma';

export async function createTeam(name: string): Promise<{ id: string; name: string }> {
  const trimmed = name.trim().toLowerCase();
  const team = await prisma.team.upsert({
    where: { name: trimmed },
    create: { name: trimmed },
    update: {},
  });
  return { id: team.id, name: team.name };
}
