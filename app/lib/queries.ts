import { prisma } from './prisma';
import type {
  ModelWithStats, ModelDetail, BatchSummary, ItemInBatch,
  ModelMeta, PurchaseStatus, TimelineEvent,
} from './domain';

function toISODate(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().split('T')[0];
}

function productMeta(p: { id: string; team: string; season: string; version: string; color: string; number: string | null; player: string | null }): ModelMeta {
  return { id: p.id, team: p.team, season: p.season, version: p.version, color: p.color, number: p.number, player: p.player };
}

export async function getModels(): Promise<ModelWithStats[]> {
  const products = await prisma.catalogProduct.findMany({
    include: {
      items: { include: { batch: { select: { arrivalDate: true } } } },
      sales: { select: { quantity: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return products.map((p) => {
    const arrivedCount = p.items.filter((i) => i.batch.arrivalDate !== null).length;
    const soldQty = p.sales.reduce((s, x) => s + x.quantity, 0);
    return {
      ...productMeta(p),
      description: p.description,
      stock: Math.max(0, arrivedCount - soldQty),
      inTransit: p.items.filter((i) => i.batch.arrivalDate === null).length,
    };
  });
}

export async function getModelById(id: string): Promise<ModelDetail | null> {
  const p = await prisma.catalogProduct.findUnique({
    where: { id },
    include: {
      items: { include: { batch: true }, orderBy: { createdAt: 'asc' } },
      sales: { orderBy: { date: 'desc' } },
    },
  });
  if (!p) return null;

  const arrivedCount = p.items.filter((i) => i.batch.arrivalDate !== null).length;
  const soldQty = p.sales.reduce((s, x) => s + x.quantity, 0);
  const stock = Math.max(0, arrivedCount - soldQty);
  const inTransit = p.items.filter((i) => i.batch.arrivalDate === null).length;
  const revenue = p.sales.reduce((s, x) => s + Number(x.price) * x.quantity, 0);

  // Group items by batch
  const batchMap = new Map<string, { batch: typeof p.items[0]['batch']; items: typeof p.items }>();
  for (const item of p.items) {
    const key = item.batchId;
    if (!batchMap.has(key)) batchMap.set(key, { batch: item.batch, items: [] });
    batchMap.get(key)!.items.push(item);
  }

  const events: TimelineEvent[] = [];

  for (const [, { batch, items }] of batchMap) {
    const qty = items.length;
    const batchData: BatchSummary = {
      id: batch.id,
      supplier: batch.supplier,
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
    if (batch.arrivalDate) {
      events.push({ type: 'arrived', date, data: batchData, qty });
    } else {
      events.push({ type: 'transit', date, data: batchData, qty });
    }
  }

  for (const s of p.sales) {
    events.push({
      type: 'sale',
      date: toISODate(s.date)!,
      qty: s.quantity,
      data: {
        id: s.id,
        catalogProductId: s.catalogProductId,
        price: Number(s.price),
        quantity: s.quantity,
        date: toISODate(s.date)!,
        method: s.method,
        description: s.description,
      },
    });
  }

  events.sort((a, b) => b.date.localeCompare(a.date));

  return {
    ...productMeta(p),
    description: p.description,
    stock,
    inTransit,
    sold: soldQty,
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
    supplier: b.supplier,
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
    supplier: b.supplier,
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
      items: { include: { batch: { select: { arrivalDate: true } } } },
      sales: { select: { quantity: true } },
    },
    orderBy: { team: 'asc' },
  });

  return products
    .map((p) => ({
      ...productMeta(p),
      stock: Math.max(
        0,
        p.items.filter((i) => i.batch.arrivalDate !== null).length -
          p.sales.reduce((s, x) => s + x.quantity, 0)
      ),
    }))
    .filter((p) => p.stock > 0);
}

export async function getTransitCount(): Promise<number> {
  return prisma.batch.count({ where: { arrivalDate: null } });
}
