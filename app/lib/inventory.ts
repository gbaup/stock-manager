import { updateTag } from 'next/cache';
import { prisma } from './prisma';
import { money } from './money';
import { CACHE_TAGS } from './cache-tags';

// Narrow write interface: only the inventoryItem delegate is needed.
// Both the top-level PrismaClient and a TransactionClient satisfy this.
type InventoryWriter = Pick<typeof prisma, 'inventoryItem'>;

export type StockCount = { available: number; inTransit: number; sold: number };

export type SaleIntent = {
  modelId: string;
  // If null, the seam picks the oldest available item across any size.
  // The sale form today doesn't capture size; public listings show per-size
  // stock but internal sales don't bind to one.
  size: string | null;
  priceUyu: number;
  exchangeRate: number;
  date: Date;
  method: string | null;
  description: string | null;
  collectedByUserId: string | null;
};

export type NewBatchItem = {
  modelId: string;
  size: string;
  basePriceUsd: number;
};

export class NotEnoughStockError extends Error {
  constructor() {
    super('Stock insuficiente');
    this.name = 'NotEnoughStockError';
  }
}

// Counts available/in-transit/sold items for one model. Stock means
// "item belongs to a shipment AND status='available'"; in-transit means
// the item has no shipment yet (still on its way).
export async function stockOf(modelId: string): Promise<StockCount> {
  const items = await prisma.inventoryItem.findMany({
    where: { catalogProductId: modelId },
    select: { status: true, shipmentId: true },
  });
  return countStock(items);
}

// Batched version for listing pages — one query, one pass. Returns
// a Map keyed by modelId. If `modelIds` is omitted, returns counts
// for every model that has at least one InventoryItem.
export async function stockByModel(modelIds?: string[]): Promise<Map<string, StockCount>> {
  const items = await prisma.inventoryItem.findMany({
    where: modelIds ? { catalogProductId: { in: modelIds } } : undefined,
    select: {
      catalogProductId: true,
      status: true,
      shipmentId: true,
    },
  });

  const byModel = new Map<string, Array<{ status: string; shipmentId: string | null }>>();
  for (const item of items) {
    const list = byModel.get(item.catalogProductId);
    if (list) list.push(item);
    else byModel.set(item.catalogProductId, [item]);
  }

  const result = new Map<string, StockCount>();
  for (const [id, group] of byModel) result.set(id, countStock(group));
  return result;
}

// Sizes currently in stock for a model (each entry counts > 0).
export async function availableSizes(modelId: string): Promise<Array<{ size: string; count: number }>> {
  const items = await prisma.inventoryItem.findMany({
    where: {
      catalogProductId: modelId,
      status: 'available',
      shipmentId: { not: null },
    },
    select: { size: true },
  });
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.size, (counts.get(i.size) ?? 0) + 1);
  return [...counts].map(([size, count]) => ({ size, count }));
}

// Batched version of availableSizes for listing pages — one query, one pass.
// Returns a Map keyed by modelId. Models with no stock are simply absent.
export async function availableSizesByModel(
  modelIds?: string[],
): Promise<Map<string, Array<{ size: string; count: number }>>> {
  const items = await prisma.inventoryItem.findMany({
    where: {
      ...(modelIds ? { catalogProductId: { in: modelIds } } : {}),
      status: 'available',
      shipmentId: { not: null },
    },
    select: { catalogProductId: true, size: true },
  });
  const byModel = new Map<string, Map<string, number>>();
  for (const i of items) {
    let sizes = byModel.get(i.catalogProductId);
    if (!sizes) { sizes = new Map(); byModel.set(i.catalogProductId, sizes); }
    sizes.set(i.size, (sizes.get(i.size) ?? 0) + 1);
  }
  const result = new Map<string, Array<{ size: string; count: number }>>();
  for (const [id, sizes] of byModel) {
    result.set(id, [...sizes].map(([size, count]) => ({ size, count })));
  }
  return result;
}

// Inserts new items into an existing Batch. All start as `status: 'available'`
// with `shipmentId: null` (in-transit). They become stock once linked to a
// Shipment via markArrived. The Shipment seam decides what "arrived" means.
// Both currencies are stored: USD is the supplier price, UYU is derived at
// purchase time using the supplied exchange rate (snapshotted on the batch).
//
// Accepts an optional `db` so callers (notably the Purchase action) can
// compose this write with a sibling `batch.create` inside one transaction.
// When `db` is omitted, runs standalone and invalidates the models cache.
export async function addBatchItems(
  batchId: string,
  items: NewBatchItem[],
  exchangeRate: number,
  db?: InventoryWriter,
): Promise<void> {
  if (items.length === 0) return;
  const client = db ?? prisma;
  await client.inventoryItem.createMany({
    data: items.map((it) => ({
      batchId,
      catalogProductId: it.modelId,
      size: it.size,
      basePriceUsd: it.basePriceUsd,
      basePriceUyu: money.toUyu(it.basePriceUsd, exchangeRate),
      status: 'available',
    })),
  });
  if (!db) updateTag(CACHE_TAGS.models);
}

// Atomic sale: picks the oldest available item in an arrived batch, flips it
// to sold (writing both UYU and USD final prices), creates the matching Sale
// row, and invalidates caches. Throws NotEnoughStockError if no item matches.
//
// FIFO by Shipment.date then InventoryItem.createdAt.
export async function recordSale(intent: SaleIntent, loggedByUserId: string): Promise<{ saleId: string }> {
  const saleId = await prisma.$transaction(async (tx) => {
    const candidate = await tx.inventoryItem.findFirst({
      where: {
        catalogProductId: intent.modelId,
        ...(intent.size ? { size: intent.size } : {}),
        status: 'available',
        shipmentId: { not: null },
      },
      orderBy: [{ shipment: { date: 'asc' } }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (!candidate) throw new NotEnoughStockError();

    // Re-check status inside the transaction with a conditional update so
    // concurrent sales on the same item fail atomically rather than oversell.
    const { count } = await tx.inventoryItem.updateMany({
      where: { id: candidate.id, status: 'available' },
      data: { status: 'sold' },
    });
    if (count === 0) throw new NotEnoughStockError();

    const sale = await tx.sale.create({
      data: {
        inventoryItemId: candidate.id,
        userId: loggedByUserId,
        price: intent.priceUyu,
        date: intent.date,
        method: intent.method,
        description: intent.description,
        collectedByUserId: intent.collectedByUserId,
      },
      select: { id: true },
    });
    return sale.id;
  });

  updateTag(CACHE_TAGS.models);
  updateTag(CACHE_TAGS.saldos);
  return { saleId };
}

// Exported so callers that have already fetched items (e.g. detail pages
// that need items for timelines or size lists) can derive counts in-process
// without a second DB round trip. An item is in transit until it gets linked
// to a Shipment; once shipped, its status decides available vs sold.
export function countStock(
  items: Array<{ status: string; shipmentId: string | null }>,
): StockCount {
  let available = 0;
  let inTransit = 0;
  let sold = 0;
  for (const i of items) {
    if (i.shipmentId === null) inTransit += 1;
    else if (i.status === 'available') available += 1;
    else if (i.status === 'sold') sold += 1;
  }
  return { available, inTransit, sold };
}
