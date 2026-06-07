import { prisma } from './prisma';
import type {
  ModelWithStats, ModelDetail, BatchSummary,
  ModelMeta, PurchaseStatus, TimelineEvent, SaleRecord, ExpenseRecord,
} from './domain';

function toISODate(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().split('T')[0];
}

function productMeta(p: {
  id: string; team: string; season: string; version: string | null;
  color: string; number: number | null; player: string | null;
  type: string | null; sleeve: string | null;
  photos: unknown; sizes: unknown;
  description?: string | null;
}): ModelMeta {
  return {
    id: p.id, team: p.team, season: p.season,
    version: p.version, color: p.color,
    number: p.number !== null ? String(p.number) : null,
    player: p.player,
    type: p.type,
    sleeve: p.sleeve,
    photos: Array.isArray(p.photos) ? (p.photos as string[]) : [],
    sizes: Array.isArray(p.sizes) ? (p.sizes as string[]) : [],
    description: p.description ?? null,
  };
}

function batchToSummary(
  b: {
    id: string; purchaseDate: Date; arrivalDate: Date | null;
    trackingNumber: string | null; description: string | null;
    shippingPriceUsd: unknown; shippingPriceUyu: unknown; weight: unknown;
    supplierPaidBy: string | null; shippingPaidBy: string | null;
  },
  items: Array<{ id: string; catalogProductId: string; size: string; basePriceUsd: unknown; product: Parameters<typeof productMeta>[0] }>
): BatchSummary {
  return {
    id: b.id,
    supplier: null,
    purchaseDate: toISODate(b.purchaseDate)!,
    arrivalDate: toISODate(b.arrivalDate),
    quantity: items.length,
    trackingNumber: b.trackingNumber,
    description: b.description,
    shippingPriceUsd: b.shippingPriceUsd ? Number(b.shippingPriceUsd) : null,
    shippingPriceUyu: b.shippingPriceUyu ? Number(b.shippingPriceUyu) : null,
    weight: b.weight ? Number(b.weight) : null,
    status: (b.arrivalDate ? 'arrived' : 'transit') as PurchaseStatus,
    supplierPaidBy: b.supplierPaidBy,
    shippingPaidBy: b.shippingPaidBy,
    items: items.map((i) => ({
      id: i.id,
      catalogProductId: i.catalogProductId,
      size: i.size,
      basePriceUsd: Number(i.basePriceUsd),
      product: productMeta(i.product),
    })),
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
          sale: {
            select: {
              id: true, price: true, date: true, method: true,
              description: true, userId: true, collectedBy: true,
            },
          },
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

  const batchMap = new Map<string, { batch: typeof p.items[0]['batch']; items: typeof p.items }>();
  for (const item of p.items) {
    if (!batchMap.has(item.batchId)) batchMap.set(item.batchId, { batch: item.batch, items: [] });
    batchMap.get(item.batchId)!.items.push(item);
  }

  const events: TimelineEvent[] = [];

  for (const [, { batch, items }] of batchMap) {
    const qty = items.length;
    const batchData = batchToSummary(batch, items.map((i) => ({
      id: i.id,
      catalogProductId: i.catalogProductId,
      size: i.size,
      basePriceUsd: i.basePriceUsd,
      product: p,
    })));
    const date = toISODate(batch.arrivalDate ?? batch.purchaseDate)!;
    events.push(batch.arrivalDate
      ? { type: 'arrived', date, data: batchData, qty }
      : { type: 'transit', date, data: batchData, qty }
    );
  }

  // Group sales by date → one event per day
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
      collectedBy: s!.collectedBy,
    };
    events.push({ type: 'sale', date: dateKey, data: saleData, qty });
  }

  events.sort((a, b) => b.date.localeCompare(a.date));

  return {
    ...productMeta(p),
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

  return batches.map((b) =>
    batchToSummary(b, b.items.map((i) => ({ ...i, product: i.product })))
  );
}

export async function getBatchById(id: string): Promise<BatchSummary | null> {
  const b = await prisma.batch.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });
  if (!b) return null;

  return batchToSummary(b, b.items.map((i) => ({ ...i, product: i.product })));
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

export async function getExpenses(): Promise<ExpenseRecord[]> {
  const rows = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    amount: Number(e.amount),
    currency: e.currency as 'UYU' | 'USD',
    paidBy: e.paidBy,
    date: toISODate(e.date)!,
  }));
}

export async function getSaldosData() {
  const [batches, soldItems, expenses] = await Promise.all([
    prisma.batch.findMany({
      include: { items: { include: { product: true } } },
      orderBy: { purchaseDate: 'desc' },
    }),
    prisma.inventoryItem.findMany({
      where: { status: 'sold' },
      include: {
        product: true,
        sale: { select: { id: true, price: true, date: true, collectedBy: true } },
        batch: { select: { arrivalDate: true } },
      },
    }),
    prisma.expense.findMany({ orderBy: { date: 'desc' } }),
  ]);

  const purchases: BatchSummary[] = batches.map((b) =>
    batchToSummary(b, b.items.map((i) => ({ ...i, product: i.product })))
  );

  const sales = soldItems
    .filter((i) => i.sale !== null)
    .map((i) => ({
      id: i.sale!.id,
      date: toISODate(i.sale!.date)!,
      price: Number(i.sale!.price),
      collectedBy: i.sale!.collectedBy,
      quantity: 1,
      model: i.product.team,
    }));

  const expenseList: ExpenseRecord[] = expenses.map((e) => ({
    id: e.id,
    title: e.title,
    amount: Number(e.amount),
    currency: e.currency as 'UYU' | 'USD',
    paidBy: e.paidBy,
    date: toISODate(e.date)!,
  }));

  return { purchases, sales, expenses: expenseList };
}
