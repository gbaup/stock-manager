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

  const qty = parseInt(data.quantity, 10) || 1;
  const price = parseFloat(data.price);
  const saleDate = new Date(data.date);

  // Find available items for this product in arrived batches
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

  // Create one Sale per item and mark items as sold
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
              method: data.method || null,
              description: data.description || null,
            },
          },
        },
      })
    )
  );

  revalidatePath('/inventory');
  revalidatePath(`/inventory/${modelId}`);
  redirect(`/inventory/${modelId}`);
}
