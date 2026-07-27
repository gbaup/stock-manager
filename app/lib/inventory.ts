import { prisma } from './prisma';
import { money } from './money';
import { invalidateSale } from './cache-tags';
import { compareSizes, SALE_STATUS } from './domain';

// Narrow write interfaces: only the delegates each helper needs.
// Both the top-level PrismaClient and a TransactionClient satisfy these.
type InventoryWriter = Pick<typeof prisma, 'inventoryItem'>;
type SaleWriter = Pick<typeof prisma, 'inventoryItem' | 'sale'>;

export type StockCount = { available: number; inTransit: number; sold: number };

export type SaleIntent = {
  modelId: string;
  size: string;
  priceUyu: number;
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
  return [...counts]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => compareSizes(a.size, b.size));
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
    result.set(id, [...sizes]
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => compareSizes(a.size, b.size)));
  }
  return result;
}

// Inserts new items into an existing Batch inside a transaction. All start as
// `status: 'available'` with `shipmentId: null` (in-transit). Both currencies
// are stored: USD is the supplier price, UYU is derived at purchase time.
export async function addBatchItems(
  batchId: string,
  items: NewBatchItem[],
  exchangeRate: number,
  db: InventoryWriter,
): Promise<void> {
  if (items.length === 0) return;
  await db.inventoryItem.createMany({
    data: items.map((it) => ({
      batchId,
      catalogProductId: it.modelId,
      size: it.size,
      basePriceUsd: it.basePriceUsd,
      basePriceUyu: money.toUyu(it.basePriceUsd, exchangeRate),
      status: 'available',
    })),
  });
}

// Claims (flips to 'sold') the oldest available shipped unit for a model+size
// and returns its id. FIFO by Shipment.date then InventoryItem.createdAt.
// Throws NotEnoughStockError if nothing matches or a concurrent sale won the
// race. Must run inside a transaction.
async function claimOldestAvailableItem(tx: SaleWriter, modelId: string, size: string): Promise<string> {
  const candidate = await tx.inventoryItem.findFirst({
    where: {
      catalogProductId: modelId,
      size,
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
  return candidate.id;
}

// Atomic sale: picks `quantity` oldest-available items in an arrived batch,
// flips each to sold and creates its matching Sale row, all inside one
// transaction — either every unit sells or none does. Throws
// NotEnoughStockError (rolling back the whole batch) if any claim fails,
// so a request for 5 when only 3 are in stock never partially fulfills.
export async function recordSale(
  intent: SaleIntent,
  quantity: number,
  loggedByUserId: string,
): Promise<{ saleIds: string[] }> {
  const saleIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const itemId = await claimOldestAvailableItem(tx, intent.modelId, intent.size);

      const sale = await tx.sale.create({
        data: {
          inventoryItemId: itemId,
          userId: loggedByUserId,
          price: intent.priceUyu,
          date: intent.date,
          method: intent.method,
          description: intent.description,
          collectedByUserId: intent.collectedByUserId,
        },
        select: { id: true },
      });
      ids.push(sale.id);
    }
    return ids;
  });

  invalidateSale();
  return { saleIds };
}

// Edits an active sale's details (price, date, method, collector). Details
// only — the unit behind the sale stays; changing model or size goes through
// swapSaleItem. Lives here (not in the action) so Inventory stays the single
// owner of every Sale write — see ADR 0003.
export async function updateSaleDetails(
  saleId: string,
  details: {
    priceUyu: number;
    date: Date;
    method: string | null;
    description: string | null;
    collectedByUserId: string | null;
  },
): Promise<void> {
  const { count } = await prisma.sale.updateMany({
    where: { id: saleId, status: SALE_STATUS.active },
    data: {
      price: details.priceUyu,
      date: details.date,
      method: details.method,
      description: details.description,
      collectedByUserId: details.collectedByUserId,
    },
  });
  if (count === 0) throw new Error('La venta no existe o fue anulada');

  invalidateSale();
}

// Cancels a sale keeping the row as history (status 'cancelled') and returns
// its unit to stock. The item keeps its shipment and createdAt, so it re-enters
// the FIFO queue in its original slot and shipping shares are untouched.
export async function cancelSale(saleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.sale.updateMany({
      where: { id: saleId, status: SALE_STATUS.active },
      data: { status: SALE_STATUS.cancelled, cancelledAt: new Date() },
    });
    if (count === 0) throw new Error('La venta ya fue anulada');

    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      select: { inventoryItemId: true },
    });
    const released = await tx.inventoryItem.updateMany({
      where: { id: sale.inventoryItemId, status: 'sold' },
      data: { status: 'available' },
    });
    // A sold item must exist for an active sale; anything else is a broken
    // invariant, so abort rather than leave the sale half-cancelled.
    if (released.count === 0) throw new Error('El item de la venta no está marcado como vendido');
  });

  invalidateSale();
}

// Swaps the unit behind an active sale (buyer changed model or size), keeping
// the same Sale row — date, method, collector and logger survive; only the
// item and price change. Claims the NEW unit first (the old one is still
// 'sold', so FIFO can't hand it back), then releases the old one.
export async function swapSaleItem(
  saleId: string,
  target: { modelId: string; size: string; priceUyu: number },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, status: SALE_STATUS.active },
      select: { inventoryItemId: true, item: { select: { catalogProductId: true, size: true } } },
    });
    if (!sale) throw new Error('La venta no existe o fue anulada');
    if (sale.item.catalogProductId === target.modelId && sale.item.size === target.size) {
      throw new Error('Elegí un producto o talle distinto al actual');
    }

    const newItemId = await claimOldestAvailableItem(tx, target.modelId, target.size);

    const released = await tx.inventoryItem.updateMany({
      where: { id: sale.inventoryItemId, status: 'sold' },
      data: { status: 'available' },
    });
    if (released.count === 0) throw new Error('El item de la venta no está marcado como vendido');

    await tx.sale.update({
      where: { id: saleId },
      data: { inventoryItemId: newItemId, price: target.priceUyu },
    });
  });

  invalidateSale();
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
