'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';

const modelSchema = z.object({
  team: z.string().min(1),
  season: z.string().min(1),
  version: z.string().default('Home'),
  color: z.string().default('Blanco'),
  number: z.string().max(2).optional(),
  player: z.string().optional(),
  description: z.string().optional(),
});

export async function createModel(_prev: unknown, formData: FormData) {
  const result = modelSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: result.error.flatten().fieldErrors };

  const model = await prisma.catalogProduct.create({ data: result.data });
  revalidatePath('/inventory');
  redirect(`/inventory/${model.id}`);
}

export async function updateModel(id: string, _prev: unknown, formData: FormData) {
  const result = modelSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: result.error.flatten().fieldErrors };

  await prisma.catalogProduct.update({ where: { id }, data: result.data });
  revalidatePath('/inventory');
  revalidatePath(`/inventory/${id}`);
  redirect(`/inventory/${id}`);
}
