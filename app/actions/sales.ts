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
    collectedBy?: string;
  }
) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  const qty = parseInt(data.quantity, 10) || 1;
  const price = parseFloat(data.price);
  const saleDate = new Date(data.date);

  const availableItems = await prisma.inventoryItem.findMany({
    where: {
      catalogProductId: modelId,
      status: 'available',
      batch: { arrivalDate: { not: null } },
    },
    take: qty,
  });

  if (availableItems.length < qty) {
    throw new Error('Stock insuficiente');
  }

  await prisma.$transaction(
    availableItems.map((item) =>
      prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          status: 'sold',
          finalPriceUyu: price,
          sale: {
            create: {
              userId,
              price,
              date: saleDate,
              method: data.method?.trim().toLowerCase() || null,
              description: data.description?.trim().toLowerCase() || null,
              collectedBy: data.collectedBy?.trim().toLowerCase() || null,
            },
          },
        },
      })
    )
  );

  revalidatePath('/inventory');
  revalidatePath(`/inventory/${modelId}`);
  revalidatePath('/saldos');
  redirect(`/inventory/${modelId}`);
}
