'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { getCurrentUserId } from '@/app/lib/auth';

export async function createSale(
  modelId: string,
  data: {
    price: string;
    quantity: string;
    date: string;
    method?: string;
    description?: string;
  }
) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  await prisma.sale.create({
    data: {
      catalogProductId: modelId,
      userId,
      price: parseFloat(data.price),
      quantity: parseInt(data.quantity, 10) || 1,
      date: new Date(data.date),
      method: data.method || null,
      description: data.description || null,
    },
  });

  revalidatePath('/inventory');
  revalidatePath(`/inventory/${modelId}`);
  redirect(`/inventory/${modelId}`);
}
