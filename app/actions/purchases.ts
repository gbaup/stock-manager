'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { USD_RATE } from '@/app/lib/domain';

type PurchaseItem = { modelId: string; size: string; basePriceUsd: number };

export async function createPurchase(data: {
  purchaseDate: string;
  supplier?: string;
  trackingNumber?: string;
  description?: string;
  supplierPaidBy?: string;
  items: PurchaseItem[];
}) {
  await prisma.batch.create({
    data: {
      purchaseDate: new Date(data.purchaseDate),
      trackingNumber: data.trackingNumber?.trim().toLowerCase() || null,
      description: data.description?.trim().toLowerCase() || null,
      quantity: data.items.length,
      supplierPaidBy: data.supplierPaidBy?.trim().toLowerCase() || null,
      items: {
        create: data.items.map((it) => ({
          catalogProductId: it.modelId,
          size: it.size.trim().toLowerCase(),
          basePriceUsd: it.basePriceUsd,
          basePriceUyu: it.basePriceUsd * USD_RATE,
          status: 'available',
        })),
      },
    },
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  revalidatePath('/saldos');
  redirect('/purchases');
}

export async function markArrived(
  batchId: string,
  data: {
    arrivalDate: string;
    shippingPriceUsd?: string;
    shippingPriceUyu?: string;
    weight?: string;
    shippingPaidBy?: string;
  }
) {
  await prisma.batch.update({
    where: { id: batchId },
    data: {
      arrivalDate: new Date(data.arrivalDate),
      shippingPriceUsd: data.shippingPriceUsd ? parseFloat(data.shippingPriceUsd) : null,
      shippingPriceUyu: data.shippingPriceUyu ? parseFloat(data.shippingPriceUyu) : null,
      weight: data.weight ? parseFloat(data.weight) : null,
      shippingPaidBy: data.shippingPaidBy?.trim().toLowerCase() || null,
    },
  });

  revalidatePath('/purchases');
  revalidatePath('/inventory');
  revalidatePath('/saldos');
  redirect('/purchases');
}
