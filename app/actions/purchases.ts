'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import { z } from 'zod';
import { arrivalSchema, parseOrThrow } from '@/app/lib/schemas';
import { addBatchItems } from '@/app/lib/inventory';
import { computeShippingPrice } from '@/app/lib/money';
import { baseCostUsd, reconcileSupplierPayments } from '@/app/lib/domain';
import { bakeCardTaxIntoItems, unbakeBatch } from '@/app/lib/pricing';
import { invalidatePurchase } from '@/app/lib/cache-tags';

const purchaseItemInput = z.object({
  modelId: z.string().min(1),
  size: z.string().min(1),
  basePriceUsd: z.number().finite().min(0),
  quantity: z.number().int().min(1).default(1),
});

const purchaseBaseSchema = z.object({
  purchaseDate: z.string().min(1),
  supplier: z.string().optional(),
  description: z.string().optional(),
  supplierPayments: z.array(z.object({
    userId: z.string().uuid(),
    amountUsd: z.number().finite().positive(),
    cardTaxPct: z.number().finite().min(0).max(100).optional(),
  })).optional(),
  exchangeRate: z.number().finite().positive(),
});

const createPurchaseSchema = purchaseBaseSchema.extend({
  items: z.array(purchaseItemInput).min(1),
});

// On edit, `items` is the desired EDITABLE (unshipped) set with PRE-TAX prices;
// it may be empty when only locked items remain. `expectedUpdatedAt` is the
// batch's optimistic-lock token as the form loaded it (BatchSummary.updatedAt).
const updatePurchaseSchema = purchaseBaseSchema.extend({
  items: z.array(purchaseItemInput),
  expectedUpdatedAt: z.string().min(1),
});

type PurchaseItem = { modelId: string; size: string; basePriceUsd: number; quantity?: number };

// Expands quantity lines into one row per physical unit.
function expandItems(items: PurchaseItem[]) {
  return items.flatMap((it) =>
    Array.from({ length: it.quantity ?? 1 }, () => ({
      modelId: it.modelId,
      size: it.size.trim().toLowerCase(),
      basePriceUsd: it.basePriceUsd,
    }))
  );
}

export async function createPurchase(data: {
  purchaseDate: string;
  supplier?: string;
  description?: string;
  supplierPayments?: { userId: string; amountUsd: number; cardTaxPct?: number }[];
  exchangeRate: number;
  items: PurchaseItem[];
}, opts?: { skipRedirect?: boolean }) {
  parseOrThrow(createPurchaseSchema, data);

  const expandedItems = expandItems(data.items);

  // Each partner's entered amount becomes one supplier-payment row. When any
  // amount is given, all payments together must cover the batch's base cost —
  // the form enforces this too, but re-check here against tampered payloads.
  const payments = (data.supplierPayments ?? []).filter((p) => p.amountUsd > 0);
  const baseTotal = baseCostUsd(expandedItems);
  if (reconcileSupplierPayments(payments, baseTotal).status === 'mismatch') {
    throw new Error('Los pagos al proveedor deben sumar el costo base total');
  }

  // Spread card taxes proportionally into each item's base price so profit
  // calculations reflect the true acquisition cost. Items with a higher base
  // price bear a proportionally larger share of the tax.
  const itemsWithTax = bakeCardTaxIntoItems(expandedItems, payments, baseTotal);

  await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.create({
      data: {
        purchaseDate: new Date(data.purchaseDate),
        supplier: data.supplier?.trim().toLowerCase() || null,
        description: data.description?.trim().toLowerCase() || null,
        quantity: itemsWithTax.length,
        supplierPayments: {
          create: payments.map((p) => ({
            userId: p.userId,
            amountUsd: p.amountUsd,
            cardTaxPct: p.cardTaxPct != null && p.cardTaxPct > 0 ? p.cardTaxPct : null,
          })),
        },
      },
      select: { id: true },
    });

    await addBatchItems(batch.id, itemsWithTax, data.exchangeRate, tx);
  });

  invalidatePurchase();
  if (opts?.skipRedirect) return;
  redirect('/purchases');
}

// Edits a batch after creation: metadata, supplier payments, and the items the
// supplier hasn't shipped yet (replace/delete/add — e.g. when the supplier ran
// out of a jersey). Shipped items are locked: their shipping shares and any
// recorded profit must not change retroactively, so their stored (taxed)
// prices stay as-is even if payments/taxes are edited. The editable set is
// replaced wholesale (delete + recreate) — with per-unit rows there's nothing
// to diff.
export async function updatePurchase(batchId: string, data: {
  purchaseDate: string;
  supplier?: string;
  description?: string;
  supplierPayments?: { userId: string; amountUsd: number; cardTaxPct?: number }[];
  exchangeRate: number;
  items: PurchaseItem[];
  expectedUpdatedAt: string;
}, opts?: { skipRedirect?: boolean }) {
  parseOrThrow(updatePurchaseSchema, data);

  const expandedItems = expandItems(data.items);
  const payments = (data.supplierPayments ?? []).filter((p) => p.amountUsd > 0);

  await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({
      where: { id: batchId },
      select: {
        updatedAt: true,
        supplierPayments: { select: { amountUsd: true, cardTaxPct: true } },
        items: { select: { id: true, shipmentId: true, basePriceUsd: true } },
      },
    });
    if (!batch) throw new Error('La compra no existe');

    // Optimistic lock: every mutation that can change this batch (metadata
    // edits, item changes, shipments arriving — see markArrived) bumps
    // updatedAt, so a stale token means the edit was built on old data.
    if (batch.updatedAt.toISOString() !== data.expectedUpdatedAt) {
      throw new Error('La compra cambió — actualizá la página antes de editar');
    }

    const lockedItems = batch.items.filter((i) => i.shipmentId !== null);
    if (lockedItems.length + expandedItems.length === 0) {
      throw new Error('La compra debe tener al menos un item — para borrarla usá "Eliminar compra"');
    }

    // Locked items keep their stored taxed prices, but the payment-sum rule
    // applies to the whole batch in pre-tax terms, so undo their old bake-in.
    const { lockedPreTaxTotal } = unbakeBatch(
      batch.items.map((i) => ({ shipmentId: i.shipmentId, basePriceUsd: Number(i.basePriceUsd) })),
      batch.supplierPayments.map((p) => ({
        amountUsd: Number(p.amountUsd),
        cardTaxPct: p.cardTaxPct != null ? Number(p.cardTaxPct) : null,
      })),
    );
    const baseTotal = lockedPreTaxTotal + baseCostUsd(expandedItems);
    if (reconcileSupplierPayments(payments, baseTotal).status === 'mismatch') {
      throw new Error('Los pagos al proveedor deben sumar el costo base total');
    }

    const itemsWithTax = bakeCardTaxIntoItems(expandedItems, payments, baseTotal);

    await tx.batch.update({
      where: { id: batchId },
      data: {
        purchaseDate: new Date(data.purchaseDate),
        supplier: data.supplier?.trim().toLowerCase() || null,
        description: data.description?.trim().toLowerCase() || null,
        quantity: lockedItems.length + itemsWithTax.length,
      },
    });

    await tx.batchSupplierPayment.deleteMany({ where: { batchId } });
    if (payments.length > 0) {
      await tx.batchSupplierPayment.createMany({
        data: payments.map((p) => ({
          batchId,
          userId: p.userId,
          amountUsd: p.amountUsd,
          cardTaxPct: p.cardTaxPct != null && p.cardTaxPct > 0 ? p.cardTaxPct : null,
        })),
      });
    }

    await tx.inventoryItem.deleteMany({ where: { batchId, shipmentId: null, status: 'available' } });
    await addBatchItems(batchId, itemsWithTax, data.exchangeRate, tx);

    // Re-derive the legacy arrivalDate stamp: adding items to a fully-arrived
    // batch reverts it to partial (clear); deleting the last pending items of
    // a partial batch completes it (stamp with the newest shipment date).
    const pending = await tx.inventoryItem.count({ where: { batchId, shipmentId: null } });
    if (pending > 0) {
      await tx.batch.update({ where: { id: batchId }, data: { arrivalDate: null } });
    } else {
      const lastShipment = await tx.shipment.findFirst({
        where: { batchId },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      if (lastShipment) {
        await tx.batch.update({ where: { id: batchId }, data: { arrivalDate: lastShipment.date } });
      }
    }
  });

  invalidatePurchase();
  if (opts?.skipRedirect) return;
  redirect('/purchases');
}

// Deletes a whole batch. Only allowed while nothing has shipped (which also
// means nothing was sold), so the cascade only removes in-transit items and
// supplier payments.
export async function deleteBatch(batchId: string, opts?: { skipRedirect?: boolean }) {
  await prisma.$transaction(async (tx) => {
    const shipped = await tx.inventoryItem.count({
      where: { batchId, shipmentId: { not: null } },
    });
    if (shipped > 0) throw new Error('No se puede eliminar: la compra ya tiene items recibidos');
    await tx.batch.delete({ where: { id: batchId } });
  });

  invalidatePurchase();
  if (opts?.skipRedirect) return;
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
  },
  opts?: { skipRedirect?: boolean },
) {
  const { exchangeRate, ...rest } = data;
  if (!arrivalSchema.safeParse(rest).success) throw new Error('Invalid arrival data');

  const weight = data.weight ? parseFloat(data.weight) : 0;
  const rateUsd = data.shippingRateUsd ? parseFloat(data.shippingRateUsd) : 0;
  const shipping = computeShippingPrice({ rateUsd, weight, exchangeRate });

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
        shippingPriceUsd: shipping.usd,
        shippingPriceUyu: shipping.uyu,
        weight: weight > 0 ? weight : null,
        shippingPaidByUserId: data.shippingPaidByUserId || null,
      },
      select: { id: true },
    });

    await tx.inventoryItem.updateMany({
      where: { id: { in: data.itemIds }, batchId, shipmentId: null },
      data: { shipmentId: shipment.id },
    });

    // Touch the batch on EVERY shipment: updatedAt is the optimistic-lock
    // token updatePurchase checks, so any arrival must move it — not just the
    // last one. The legacy arrivalDate stamp (kept for backwards-compat with
    // the few places that still query it) only lands when nothing is pending.
    const pending = await tx.inventoryItem.count({
      where: { batchId, shipmentId: null },
    });
    await tx.batch.update({
      where: { id: batchId },
      data: pending === 0 ? { arrivalDate: new Date(data.arrivalDate) } : { updatedAt: new Date() },
    });
  });

  invalidatePurchase();
  if (opts?.skipRedirect) return;
  redirect('/purchases');
}
