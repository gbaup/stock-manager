'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';

const normalize = (v: string) => v.trim().toLowerCase();

const modelSchema = z.object({
  teamId:      z.string().uuid(),
  season:      z.string().min(1).transform(normalize),
  version:     z.string().default('Home').transform(normalize),
  color:       z.string().default('Blanco').transform(normalize),
  type:        z.string().default('Fan').transform(normalize),
  sleeve:      z.string().default('Corta').transform(normalize),
  number:      z.string().max(2).optional(),
  player:      z.string().optional().transform(v => v?.trim().toLowerCase()),
  description: z.string().optional().transform(v => v?.trim().toLowerCase()),
  photos:      z.string().optional(),
});

function parseNumber(n: string | undefined): number | null {
  if (!n || n.trim() === '') return null;
  const parsed = parseInt(n, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseJsonArray(s: string | undefined): string[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

export async function createModel(_prev: unknown, formData: FormData) {
  const result = modelSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: result.error.flatten().fieldErrors };

  const { number, photos, ...rest } = result.data;
  let modelId: string;
  try {
    const model = await prisma.catalogProduct.create({
      data: { ...rest, number: parseNumber(number), photos: parseJsonArray(photos) },
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

export async function updateModel(id: string, _prev: unknown, formData: FormData) {
  const result = modelSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: result.error.flatten().fieldErrors };

  const { number, photos, ...rest } = result.data;
  try {
    await prisma.catalogProduct.update({
      where: { id },
      data: { ...rest, number: parseNumber(number), photos: parseJsonArray(photos) },
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
