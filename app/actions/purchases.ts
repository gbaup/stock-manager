'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { z } from 'zod';
import { arrivalSchema, parseOrThrow } from '@/app/lib/schemas';
import { addBatchItems } from '@/app/lib/inventory';
import { money } from '@/app/lib/money';
import { CACHE_TAGS } from '@/app/lib/cache-tags';

const createPurchaseSchema = z.object({
  purchaseDate: z.string().min(1),
  supplier: z.string().optional(),
  trackingNumber: z.string().optional(),
  description: z.string().optional(),
  supplierPaidByUserId: z.string().uuid().optional(),
  exchangeRate: z.number().finite().positive(),
  items: z.array(z.object({
    modelId: z.string().min(1),
    size: z.string().min(1),
    basePriceUsd: z.number().finite().min(0),
    quantity: z.number().int().min(1).default(1),
  })).min(1),
});

type PurchaseItem = { modelId: string; size: string; basePriceUsd: number; quantity?: number };

export async function createPurchase(data: {
  purchaseDate: string;
  supplier?: string;
  trackingNumber?: string;
  description?: string;
  supplierPaidByUserId?: string;
  exchangeRate: number;
  items: PurchaseItem[];
}) {
  parseOrThrow(createPurchaseSchema, data);

  const expandedItems = data.items.flatMap((it) =>
    Array.from({ length: it.quantity ?? 1 }, () => ({
      modelId: it.modelId,
      size: it.size.trim().toLowerCase(),
      basePriceUsd: it.basePriceUsd,
    }))
  );

  await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.create({
      data: {
        purchaseDate: new Date(data.purchaseDate),
        supplier: data.supplier?.trim().toLowerCase() || null,
        trackingNumber: data.trackingNumber?.trim().toLowerCase() || null,
        description: data.description?.trim().toLowerCase() || null,
        quantity: expandedItems.length,
        supplierPaidByUserId: data.supplierPaidByUserId || null,
      },
      select: { id: true },
    });

    await addBatchItems(batch.id, expandedItems, data.exchangeRate, tx);
  });

  updateTag(CACHE_TAGS.purchases);
  updateTag(CACHE_TAGS.models);
  updateTag(CACHE_TAGS.saldos);
  redirect('/purchases');
}

export async function markArrived(
  batchId: string,
  data: {
    arrivalDate: string;
    shippingRateUsd: string;
    weight: string;
    shippingPaidByUserId?: string;
    exchangeRate: number;
  }
) {
  const { exchangeRate, ...rest } = data;
  if (!arrivalSchema.safeParse(rest).success) throw new Error('Invalid arrival data');

  const weight = parseFloat(data.weight);
  const shippingPriceUsd = parseFloat(data.shippingRateUsd) * weight;

  await prisma.batch.update({
    where: { id: batchId },
    data: {
      arrivalDate: new Date(data.arrivalDate),
      shippingPriceUsd,
      shippingPriceUyu: money.toUyu(shippingPriceUsd, exchangeRate),
      weight,
      shippingPaidByUserId: data.shippingPaidByUserId || null,
    },
  });

  updateTag(CACHE_TAGS.purchases);
  updateTag(CACHE_TAGS.models);
  updateTag(CACHE_TAGS.saldos);
  redirect('/purchases');
}
