'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';

type PurchaseItem = { modelId: string; size: string; basePriceUsd: number };

export async function createPurchase(data: {
  purchaseDate: string;
  supplier?: string;
  trackingNumber?: string;
  description?: string;
  items: PurchaseItem[];
}) {
  const batch = await prisma.batch.create({
    data: {
      purchaseDate: new Date(data.purchaseDate),
      supplier: data.supplier || null,
      trackingNumber: data.trackingNumber || null,
      description: data.description || null,
      quantity: data.items.length,
      items: {
        create: data.items.map((it) => ({
          catalogProductId: it.modelId,
          size: it.size,
          basePriceUsd: it.basePriceUsd,
        })),
      },
    },
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  redirect('/purchases');
}

export async function markArrived(
  batchId: string,
  data: {
    arrivalDate: string;
    shippingPriceUsd?: string;
    shippingPriceUyu?: string;
    weight?: string;
  }
) {
  await prisma.batch.update({
    where: { id: batchId },
    data: {
      arrivalDate: new Date(data.arrivalDate),
      shippingPriceUsd: data.shippingPriceUsd ? parseFloat(data.shippingPriceUsd) : null,
      shippingPriceUyu: data.shippingPriceUyu ? parseFloat(data.shippingPriceUyu) : null,
      weight: data.weight ? parseFloat(data.weight) : null,
    },
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  redirect('/purchases');
}
