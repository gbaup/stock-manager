'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { getCurrentUserId } from '@/app/lib/auth';
import { saleSchema, parseOrThrow } from '@/app/lib/schemas';

export async function createSale(
  modelId: string,
  data: {
    price: string;
    quantity: string;
    date: string;
    method?: string;
    description?: string;
    collectedByUserId?: string;
  }
) {
  const userId = await getCurrentUserId();
  if (!userId) redirect('/login');

  parseOrThrow(saleSchema, data);

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
    orderBy: { createdAt: 'asc' },
  });

  if (availableItems.length < qty) {
    throw new Error('Stock insuficiente');
  }

  // Interactive transaction re-checks status='available' before each update,
  // so concurrent sales on the same items fail atomically instead of overselling.
  await prisma.$transaction(async (tx) => {
    for (const item of availableItems) {
      const { count } = await tx.inventoryItem.updateMany({
        where: { id: item.id, status: 'available' },
        data: { status: 'sold', finalPriceUyu: price },
      });
      if (count === 0) throw new Error('Stock insuficiente');
      await tx.sale.create({
        data: {
          inventoryItemId: item.id,
          userId,
          price,
          date: saleDate,
          method: data.method?.trim().toLowerCase() || null,
          description: data.description?.trim().toLowerCase() || null,
          collectedByUserId: data.collectedByUserId || null,
        },
      });
    }
  });

  updateTag('models');
  updateTag('saldos');
  redirect(`/inventory/${modelId}`);
}
