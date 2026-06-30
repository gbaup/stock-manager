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
  description: z.string().optional(),
  supplierPayments: z.array(z.object({
    userId: z.string().uuid(),
    amountUsd: z.number().finite().positive(),
  })).optional(),
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
  description?: string;
  supplierPayments?: { userId: string; amountUsd: number }[];
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

  // Each partner's entered amount becomes one supplier-payment row. When any
  // amount is given, the two together must cover the batch's base cost — the
  // form enforces this too, but re-check here against tampered payloads.
  const payments = (data.supplierPayments ?? []).filter((p) => p.amountUsd > 0);
  if (payments.length > 0) {
    const baseUsd = expandedItems.reduce((s, it) => s + it.basePriceUsd, 0);
    const paid = payments.reduce((s, p) => s + p.amountUsd, 0);
    if (Math.round(paid * 100) !== Math.round(baseUsd * 100)) {
      throw new Error('Los pagos al proveedor deben sumar el costo base total');
    }
  }

  await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.create({
      data: {
        purchaseDate: new Date(data.purchaseDate),
        supplier: data.supplier?.trim().toLowerCase() || null,
        description: data.description?.trim().toLowerCase() || null,
        quantity: expandedItems.length,
        supplierPayments: {
          create: payments.map((p) => ({ userId: p.userId, amountUsd: p.amountUsd })),
        },
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

// Registers ONE shipment against a batch: marks the chosen pending items as
// received and stores the shipment's tracking, cost and payer (any one of
// these can be absent — a free shipment has no payer). The batch's overall
// status is derived from how many of its items now belong to a shipment.
export async function markArrived(
  batchId: string,
  data: {
    arrivalDate: string;
    trackingNumber?: string;
    shippingRateUsd?: string;
    weight?: string;
    shippingPaidByUserId?: string;
    itemIds: string[];
    exchangeRate: number;
  }
) {
  const { exchangeRate, ...rest } = data;
  if (!arrivalSchema.safeParse(rest).success) throw new Error('Invalid arrival data');

  const weight = data.weight ? parseFloat(data.weight) : 0;
  const rateUsd = data.shippingRateUsd ? parseFloat(data.shippingRateUsd) : 0;
  const shippingPriceUsd = rateUsd > 0 && weight > 0 ? rateUsd * weight : 0;
  const shippingPriceUyu = shippingPriceUsd > 0 ? money.toUyu(shippingPriceUsd, exchangeRate) : 0;

  await prisma.$transaction(async (tx) => {
    // Guard: the supplied itemIds must belong to this batch and still be
    // pending (no shipment yet). Lock them in a single conditional update.
    const eligible = await tx.inventoryItem.findMany({
      where: { id: { in: data.itemIds }, batchId, shipmentId: null },
      select: { id: true },
    });
    if (eligible.length !== data.itemIds.length) {
      throw new Error('Algunos items ya fueron recibidos o no pertenecen a esta compra');
    }

    const shipment = await tx.shipment.create({
      data: {
        batchId,
        date: new Date(data.arrivalDate),
        trackingNumber: data.trackingNumber?.trim().toLowerCase() || null,
        shippingPriceUsd: shippingPriceUsd > 0 ? shippingPriceUsd : null,
        shippingPriceUyu: shippingPriceUyu > 0 ? shippingPriceUyu : null,
        weight: weight > 0 ? weight : null,
        shippingPaidByUserId: data.shippingPaidByUserId || null,
      },
      select: { id: true },
    });

    await tx.inventoryItem.updateMany({
      where: { id: { in: data.itemIds }, batchId, shipmentId: null },
      data: { shipmentId: shipment.id },
    });

    // Once every item is on a shipment, stamp the legacy arrivalDate column
    // for backwards-compat with the few places that still query it.
    const pending = await tx.inventoryItem.count({
      where: { batchId, shipmentId: null },
    });
    if (pending === 0) {
      await tx.batch.update({
        where: { id: batchId },
        data: { arrivalDate: new Date(data.arrivalDate) },
      });
    }
  });

  updateTag(CACHE_TAGS.purchases);
  updateTag(CACHE_TAGS.models);
  updateTag(CACHE_TAGS.saldos);
  redirect('/purchases');
}
