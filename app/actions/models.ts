'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';
import { modelSchema, type ModelFormValues } from '@/app/lib/schemas';

const n = (v: string) => v.trim().toLowerCase();

function parseNumber(s: string | undefined): number | null {
  if (!s || s.trim() === '') return null;
  const parsed = parseInt(s, 10);
  return isNaN(parsed) ? null : parsed;
}

export async function createModel(data: ModelFormValues): Promise<{ errors: Record<string, string[]> } | void> {
  const result = modelSchema.safeParse(data);
  if (!result.success) return { errors: result.error.flatten().fieldErrors };

  const { teamId, season, version, type, sleeve, color, number, player, description, photos } = result.data;

  let modelId: string;
  try {
    const model = await prisma.catalogProduct.create({
      data: {
        teamId,
        season: n(season),
        version: n(version || 'home'),
        type: n(type || 'fan'),
        sleeve: n(sleeve || 'corta'),
        color: n(color || 'blanco'),
        number: parseNumber(number),
        player: player ? n(player) : null,
        description: description ? n(description) : null,
        photos,
      },
    });
    modelId = model.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { errors: { teamId: ['Ya existe un producto con estas características'] } };
    }
    throw e;
  }
  revalidatePath('/inventory');
  redirect(`/inventory/${modelId}`);
}

export async function updateModel(id: string, data: ModelFormValues): Promise<{ errors: Record<string, string[]> } | void> {
  const result = modelSchema.safeParse(data);
  if (!result.success) return { errors: result.error.flatten().fieldErrors };

  const { teamId, season, version, type, sleeve, color, number, player, description, photos } = result.data;

  try {
    await prisma.catalogProduct.update({
      where: { id },
      data: {
        teamId,
        season: n(season),
        version: n(version || 'home'),
        type: n(type || 'fan'),
        sleeve: n(sleeve || 'corta'),
        color: n(color || 'blanco'),
        number: parseNumber(number),
        player: player ? n(player) : null,
        description: description ? n(description) : null,
        photos,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { errors: { teamId: ['Ya existe un producto con estas características'] } };
    }
    throw e;
  }
  revalidatePath('/inventory');
  revalidatePath(`/inventory/${id}`);
  redirect(`/inventory/${id}`);
}
