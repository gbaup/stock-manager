'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { z } from 'zod';
import { arrivalSchema, parseOrThrow } from '@/app/lib/schemas';
import { getExchangeRate } from '@/app/lib/exchange-rate';
import { addBatchItems } from '@/app/lib/inventory';

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

  await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.create({
      data: {
        purchaseDate: new Date(data.purchaseDate),
        supplier: data.supplier?.trim().toLowerCase() || null,
        trackingNumber: data.trackingNumber?.trim().toLowerCase() || null,
        description: data.description?.trim().toLowerCase() || null,
        quantity: data.items.length,
        supplierPaidByUserId: data.supplierPaidByUserId || null,
      },
      select: { id: true },
    });

    await addBatchItems(
      batch.id,
      data.items.map((it) => ({
        modelId: it.modelId,
        size: it.size.trim().toLowerCase(),
        basePriceUsd: it.basePriceUsd,
      })),
      exchangeRate,
      tx,
    );
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
    shippingRateUsd: string;
    weight: string;
    shippingPaidByUserId?: string;
  }
) {
  if (!arrivalSchema.safeParse(data).success) throw new Error('Invalid arrival data');

  const weight = parseFloat(data.weight);
  const shippingPriceUsd = parseFloat(data.shippingRateUsd) * weight;

  await prisma.batch.update({
    where: { id: batchId },
    data: {
      arrivalDate: new Date(data.arrivalDate),
      shippingPriceUsd,
      shippingPriceUyu: null,
      weight,
      shippingPaidByUserId: data.shippingPaidByUserId || null,
    },
  });

  updateTag('purchases');
  updateTag('models');
  updateTag('saldos');
  redirect('/purchases');
}
