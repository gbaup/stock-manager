'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { z } from 'zod';
import { arrivalSchema, parseOrThrow } from '@/app/lib/schemas';
import { getExchangeRate } from '@/app/lib/exchange-rate';

const createPurchaseSchema = z.object({
  purchaseDate: z.string().min(1),
  supplier: z.string().optional(),
  trackingNumber: z.string().optional(),
  description: z.string().optional(),
  supplierPaidByUserId: z.string().uuid().optional(),
  items: z.array(z.object({
    modelId: z.string().min(1),
    size: z.string().min(1),
    basePriceUsd: z.number().finite().min(0),
  })).min(1),
});

type PurchaseItem = { modelId: string; size: string; basePriceUsd: number };

export async function createPurchase(data: {
  purchaseDate: string;
  supplier?: string;
  trackingNumber?: string;
  description?: string;
  supplierPaidByUserId?: string;
  items: PurchaseItem[];
}) {
  parseOrThrow(createPurchaseSchema, data);

  const exchangeRate = await getExchangeRate();

  await prisma.batch.create({
    data: {
      purchaseDate: new Date(data.purchaseDate),
      supplier: data.supplier?.trim().toLowerCase() || null,
      trackingNumber: data.trackingNumber?.trim().toLowerCase() || null,
      description: data.description?.trim().toLowerCase() || null,
      quantity: data.items.length,
      supplierPaidByUserId: data.supplierPaidByUserId || null,
      items: {
        create: data.items.map((it) => ({
          catalogProductId: it.modelId,
          size: it.size.trim().toLowerCase(),
          basePriceUsd: it.basePriceUsd,
          basePriceUyu: it.basePriceUsd * exchangeRate,
          status: 'available',
        })),
      },
    },
  });

  updateTag('purchases');
  updateTag('models');
  updateTag('saldos');
  redirect('/purchases');
}

export async function markArrived(
  batchId: string,
  data: {
    arrivalDate: string;
    shippingPriceUsd?: string;
    shippingPriceUyu?: string;
    weight?: string;
    shippingPaidByUserId?: string;
  }
) {
  if (!arrivalSchema.safeParse(data).success) throw new Error('Invalid arrival data');

  await prisma.batch.update({
    where: { id: batchId },
    data: {
      arrivalDate: new Date(data.arrivalDate),
      shippingPriceUsd: data.shippingPriceUsd ? parseFloat(data.shippingPriceUsd) : null,
      shippingPriceUyu: data.shippingPriceUyu ? parseFloat(data.shippingPriceUyu) : null,
      weight: data.weight ? parseFloat(data.weight) : null,
      shippingPaidByUserId: data.shippingPaidByUserId || null,
    },
  });

  updateTag('purchases');
  updateTag('models');
  updateTag('saldos');
  redirect('/purchases');
}
