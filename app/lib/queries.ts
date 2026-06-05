import { prisma } from './prisma';
import type {
  ModelWithStats, ModelDetail, BatchSummary, ItemInBatch,
  ModelMeta, PurchaseStatus, TimelineEvent, SaleRecord,
} from './domain';

function toISODate(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().split('T')[0];
}

function productMeta(p: {
  id: string; team: string; season: string; version: string | null;
  color: string; number: number | null; player: string | null;
}): ModelMeta {
  return {
    id: p.id, team: p.team, season: p.season,
    version: p.version, color: p.color,
    number: p.number !== null ? String(p.number) : null,
    player: p.player,
  };
}

export async function getModels(): Promise<ModelWithStats[]> {
  const products = await prisma.catalogProduct.findMany({
    include: {
      items: { select: { status: true, batch: { select: { arrivalDate: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return products.map((p) => {
    const arrivedItems = p.items.filter((i) => i.batch.arrivalDate !== null);
    const stock = arrivedItems.filter((i) => i.status === 'available').length;
    const inTransit = p.items.filter((i) => i.batch.arrivalDate === null).length;
    return {
      ...productMeta(p),
      description: p.description,
      stock,
      inTransit,
    };
  });
}

export async function getModelById(id: string): Promise<ModelDetail | null> {
  const p = await prisma.catalogProduct.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          batch: true,
          sale: { select: { id: true, price: true, date: true, method: true, description: true, userId: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!p) return null;

  const arrivedItems = p.items.filter((i) => i.batch.arrivalDate !== null);
  const stock = arrivedItems.filter((i) => i.status === 'available').length;
  const inTransit = p.items.filter((i) => i.batch.arrivalDate === null).length;
  const soldItems = p.items.filter((i) => i.sale !== null);
  const sold = soldItems.length;
  const revenue = soldItems.reduce((s, i) => s + Number(i.sale!.price), 0);

  // Group items by batch for transit/arrived events
  const batchMap = new Map<string, { batch: typeof p.items[0]['batch']; items: typeof p.items }>();
  for (const item of p.items) {
    if (!batchMap.has(item.batchId)) batchMap.set(item.batchId, { batch: item.batch, items: [] });
    batchMap.get(item.batchId)!.items.push(item);
  }

  const events: TimelineEvent[] = [];

  for (const [, { batch, items }] of batchMap) {
    const qty = items.length;
    const batchData: BatchSummary = {
      id: batch.id,
      supplier: null,
      purchaseDate: toISODate(batch.purchaseDate)!,
      arrivalDate: toISODate(batch.arrivalDate),
      quantity: qty,
      trackingNumber: batch.trackingNumber,
      description: batch.description,
      shippingPriceUsd: batch.shippingPriceUsd ? Number(batch.shippingPriceUsd) : null,
      shippingPriceUyu: batch.shippingPriceUyu ? Number(batch.shippingPriceUyu) : null,
      weight: batch.weight ? Number(batch.weight) : null,
      status: batch.arrivalDate ? 'arrived' : 'transit',
      items: items.map((i) => ({
        id: i.id,
        catalogProductId: i.catalogProductId,
        size: i.size,
        basePriceUsd: Number(i.basePriceUsd),
        product: productMeta(p),
      })),
    };
    const date = toISODate(batch.arrivalDate ?? batch.purchaseDate)!;
    events.push(batch.arrivalDate
      ? { type: 'arrived', date, data: batchData, qty }
      : { type: 'transit', date, data: batchData, qty }
    );
  }

  // Group sales by ISO date → one timeline event per day
  const saleByDate = new Map<string, { price: number; qty: number; s: typeof soldItems[0]['sale'] }>();
  for (const item of soldItems) {
    const s = item.sale!;
    const dateKey = toISODate(s.date)!;
    const existing = saleByDate.get(dateKey);
    if (existing) {
      existing.price += Number(s.price);
      existing.qty += 1;
    } else {
      saleByDate.set(dateKey, { price: Number(s.price), qty: 1, s });
    }
  }

  for (const [dateKey, { price, qty, s }] of saleByDate) {
    const saleData: SaleRecord = {
      id: s!.id,
      catalogProductId: id,
      price,
      quantity: qty,
      date: dateKey,
      method: s!.method,
      description: s!.description,
    };
    events.push({ type: 'sale', date: dateKey, data: saleData, qty });
  }

  events.sort((a, b) => b.date.localeCompare(a.date));

  return {
    ...productMeta(p),
    description: p.description,
    stock,
    inTransit,
    sold,
    revenue,
    events,
  };
}

export async function getPurchases(): Promise<BatchSummary[]> {
  const batches = await prisma.batch.findMany({
    include: { items: { include: { product: true } } },
    orderBy: { purchaseDate: 'desc' },
  });

  return batches.map((b) => ({
    id: b.id,
    supplier: null,
    purchaseDate: toISODate(b.purchaseDate)!,
    arrivalDate: toISODate(b.arrivalDate),
    quantity: b.items.length,
    trackingNumber: b.trackingNumber,
    description: b.description,
    shippingPriceUsd: b.shippingPriceUsd ? Number(b.shippingPriceUsd) : null,
    shippingPriceUyu: b.shippingPriceUyu ? Number(b.shippingPriceUyu) : null,
    weight: b.weight ? Number(b.weight) : null,
    status: (b.arrivalDate ? 'arrived' : 'transit') as PurchaseStatus,
    items: b.items.map((i) => ({
      id: i.id,
      catalogProductId: i.catalogProductId,
      size: i.size,
      basePriceUsd: Number(i.basePriceUsd),
      product: productMeta(i.product),
    })),
  }));
}

export async function getBatchById(id: string): Promise<BatchSummary | null> {
  const b = await prisma.batch.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });
  if (!b) return null;

  return {
    id: b.id,
    supplier: null,
    purchaseDate: toISODate(b.purchaseDate)!,
    arrivalDate: toISODate(b.arrivalDate),
    quantity: b.items.length,
    trackingNumber: b.trackingNumber,
    description: b.description,
    shippingPriceUsd: b.shippingPriceUsd ? Number(b.shippingPriceUsd) : null,
    shippingPriceUyu: b.shippingPriceUyu ? Number(b.shippingPriceUyu) : null,
    weight: b.weight ? Number(b.weight) : null,
    status: (b.arrivalDate ? 'arrived' : 'transit') as PurchaseStatus,
    items: b.items.map((i) => ({
      id: i.id,
      catalogProductId: i.catalogProductId,
      size: i.size,
      basePriceUsd: Number(i.basePriceUsd),
      product: productMeta(i.product),
    })),
  };
}

export async function getPublicModels() {
  const products = await prisma.catalogProduct.findMany({
    include: {
      items: { select: { status: true, batch: { select: { arrivalDate: true } } } },
    },
    orderBy: { team: 'asc' },
  });

  return products
    .map((p) => ({
      ...productMeta(p),
      stock: p.items
        .filter((i) => i.batch.arrivalDate !== null && i.status === 'available')
        .length,
    }))
    .filter((p) => p.stock > 0);
}

export async function getTransitCount(): Promise<number> {
  return prisma.batch.count({ where: { arrivalDate: null } });
}
