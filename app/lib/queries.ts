import { cacheTag, cacheLife } from 'next/cache';
import { prisma } from './prisma';
import { fmtDate } from './format';
import { stockByModel, countStock, availableSizesByModel } from './inventory';
import { CACHE_TAGS } from './cache-tags';
import { parsePhotos } from './photo';
import { shippingShareUyu, derivePurchaseStatus } from './domain';
import type {
  ModelWithStats, ModelDetail, BatchSummary,
  ModelMeta, TimelineEvent, SaleRecord, UserSummary,
  ShipmentRecord,
} from './domain';

export type HomeSaleItem = {
  id: string;
  catalogProductId: string;
  teamName: string;
  color: string;
  version: string | null;
  number: string | null;
  player: string | null;
  price: number;
  date: string;
  collectedByUserId: string | null;
  collectedByAlias: string | null;
};

// Temporary flag: while ramping up, show every model in the public catalog
// (not just the ones with real stock). Unset/false = normal behavior.
const SHOW_ALL_MODELS = process.env.SHOW_ALL_MODELS === 'true';

function toISODate(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().split('T')[0];
}

function productMeta(p: {
  id: string; team: { name: string }; season: string; version: string | null;
  color: string; number: number | null; player: string | null;
  type: string | null; sleeve: string | null;
  photos: unknown;
  description?: string | null;
}, sizes: string[] = []): ModelMeta {
  return {
    id: p.id, team: p.team.name, season: p.season,
    version: p.version, color: p.color,
    number: p.number !== null ? String(p.number) : null,
    player: p.player,
    type: p.type,
    sleeve: p.sleeve,
    photos: parsePhotos(p.photos),
    sizes,
    description: p.description ?? null,
  };
}

type ShipmentInput = {
  id: string;
  date: Date;
  trackingNumber: string | null;
  shippingPriceUsd: unknown;
  shippingPriceUyu: unknown;
  weight: unknown;
  shippingPaidByUserId: string | null;
  shippingPaidByUser: { alias: string } | null;
};

export function batchToSummary(
  b: {
    id: string; purchaseDate: Date; arrivalDate: Date | null;
    supplier: string | null;
    trackingNumber: string | null; description: string | null;
    supplierPayments: Array<{ userId: string; amountUsd: unknown; user: { alias: string } }>;
    shipments: ShipmentInput[];
  },
  items: Array<{ id: string; catalogProductId: string; size: string; basePriceUsd: unknown; shipmentId: string | null; product: Parameters<typeof productMeta>[0] }>
): BatchSummary {
  // Map shipment -> items received via that shipment.
  const itemsByShipment = new Map<string, string[]>();
  for (const it of items) {
    if (!it.shipmentId) continue;
    const list = itemsByShipment.get(it.shipmentId);
    if (list) list.push(it.id);
    else itemsByShipment.set(it.shipmentId, [it.id]);
  }

  const shipments: ShipmentRecord[] = [...b.shipments]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((s) => ({
      id: s.id,
      date: toISODate(s.date)!,
      trackingNumber: s.trackingNumber,
      shippingPriceUsd: s.shippingPriceUsd ? Number(s.shippingPriceUsd) : null,
      shippingPriceUyu: s.shippingPriceUyu ? Number(s.shippingPriceUyu) : null,
      weight: s.weight ? Number(s.weight) : null,
      shippingPaidByUserId: s.shippingPaidByUserId,
      shippingPaidByAlias: s.shippingPaidByUser?.alias ?? null,
      itemIds: itemsByShipment.get(s.id) ?? [],
    }));

  const arrivedQuantity = items.reduce((s, i) => s + (i.shipmentId ? 1 : 0), 0);
  const status = derivePurchaseStatus(arrivedQuantity, items.length);

  // Delivery data lives on shipments (ADR 0004). Summary fields surface the most
  // recent shipment; totals fold across all of them. `arrivalDate` falls back to
  // the batch's convenience stamp only when nothing has shipped yet.
  const lastShipment = shipments[shipments.length - 1] ?? null;
  const arrivalDate = lastShipment ? lastShipment.date : toISODate(b.arrivalDate);
  const trackingNumber = lastShipment?.trackingNumber ?? b.trackingNumber;
  const shippingPriceUsd = shipments.reduce((s, sh) => s + (sh.shippingPriceUsd ?? 0), 0);
  const shippingPriceUyu = shipments.reduce((s, sh) => s + (sh.shippingPriceUyu ?? 0), 0);
  const weight = lastShipment?.weight ?? null;
  const shippingPaidByUserId = lastShipment?.shippingPaidByUserId ?? null;
  const shippingPaidByAlias = lastShipment?.shippingPaidByAlias ?? null;

  return {
    id: b.id,
    supplier: b.supplier,
    purchaseDate: toISODate(b.purchaseDate)!,
    arrivalDate,
    quantity: items.length,
    arrivedQuantity,
    trackingNumber,
    description: b.description,
    shippingPriceUsd: shippingPriceUsd || null,
    shippingPriceUyu: shippingPriceUyu || null,
    weight,
    status,
    supplierPayments: b.supplierPayments.map((p) => ({
      userId: p.userId,
      alias: p.user.alias,
      amountUsd: Number(p.amountUsd),
    })),
    shippingPaidByUserId,
    shippingPaidByAlias,
    items: items.map((i) => ({
      id: i.id,
      catalogProductId: i.catalogProductId,
      size: i.size,
      basePriceUsd: Number(i.basePriceUsd),
      shipmentId: i.shipmentId,
      product: productMeta(i.product),
    })),
    shipments,
  };
}

export async function getUsers(): Promise<UserSummary[]> {
  'use cache';
  cacheLife('days');
  cacheTag(CACHE_TAGS.users);
  const rows = await prisma.user.findMany({ select: { id: true, alias: true }, orderBy: { alias: 'asc' } });
  return rows.map((u) => ({ id: u.id, alias: u.alias }));
}

export async function getTeams(): Promise<{ id: string; name: string }[]> {
  'use cache';
  cacheLife('days');
  cacheTag(CACHE_TAGS.teams);
  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });
  return teams.map((t) => ({ id: t.id, name: t.name }));
}

export async function getModels(): Promise<ModelWithStats[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.models);
  const [products, counts, sizes] = await Promise.all([
    prisma.catalogProduct.findMany({
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    }),
    stockByModel(),
    availableSizesByModel(),
  ]);

  return products.map((p) => {
    const c = counts.get(p.id);
    return {
      ...productMeta(p),
      stock: c?.available ?? 0,
      inTransit: c?.inTransit ?? 0,
      availableBySize: sizes.get(p.id) ?? [],
    };
  });
}

export async function getModelById(id: string): Promise<ModelDetail | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.models);
  const p = await prisma.catalogProduct.findUnique({
    where: { id },
    include: {
      team: true,
      items: {
        include: {
          batch: {
            include: {
              supplierPayments: { include: { user: true } },
              shipments: {
                include: { shippingPaidByUser: true },
                orderBy: { date: 'asc' },
              },
            },
          },
          sale: {
            select: {
              id: true, price: true, date: true, method: true,
              description: true, userId: true,
              collectedByUserId: true,
              collectedByUser: { select: { alias: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!p) return null;

  const counts = countStock(p.items);
  const stock = counts.available;
  const inTransit = counts.inTransit;

  // Sizes with available stock (shipped + not sold), with per-size counts.
  const sizeCounts = new Map<string, number>();
  for (const i of p.items) {
    if (i.status === 'available' && i.shipmentId !== null) {
      sizeCounts.set(i.size, (sizeCounts.get(i.size) ?? 0) + 1);
    }
  }
  const availableBySize = [...sizeCounts].map(([size, count]) => ({ size, count }));
  const soldItems = p.items.filter((i) => i.sale !== null);
  const sold = soldItems.length;
  const revenue = soldItems.reduce((s, i) => s + Number(i.sale!.price), 0);

  // Group items by batch so we can build a BatchSummary per batch even when
  // only a subset of the items belong to this model.
  const batchMap = new Map<string, { batch: typeof p.items[0]['batch']; items: typeof p.items }>();
  for (const item of p.items) {
    if (!batchMap.has(item.batchId)) batchMap.set(item.batchId, { batch: item.batch, items: [] });
    batchMap.get(item.batchId)!.items.push(item);
  }

  const events: TimelineEvent[] = [];

  // itemId -> allocated UYU shipping cost for that unit. Built per batch so the
  // equal-split denominator counts every item in a shipment, not just this
  // model's. Items with no resolvable shipping (in transit) are simply absent.
  const shippingShareByItem = new Map<string, number>();

  // The summary needs ALL items of each batch (for accurate shipment grouping
  // and shipping totals), even though this page only renders this model's units.
  // Fetch them for every relevant batch in one query, then group in memory.
  const allBatchItemsRaw = await prisma.inventoryItem.findMany({
    where: { batchId: { in: [...batchMap.keys()] } },
    select: {
      id: true, batchId: true, catalogProductId: true, size: true, basePriceUsd: true, shipmentId: true,
      product: { include: { team: true } },
    },
  });
  const itemsByBatch = new Map<string, typeof allBatchItemsRaw>();
  for (const it of allBatchItemsRaw) {
    const list = itemsByBatch.get(it.batchId);
    if (list) list.push(it);
    else itemsByBatch.set(it.batchId, [it]);
  }

  for (const [, { batch, items }] of batchMap) {
    const allBatchItems = itemsByBatch.get(batch.id) ?? [];
    const batchData = batchToSummary(batch, allBatchItems);

    if (batchData.shipments.length > 0) {
      for (const sh of batchData.shipments) {
        const share = shippingShareUyu(sh);
        for (const itemId of sh.itemIds) shippingShareByItem.set(itemId, share);
      }
    }

    const arrivedForModel = items.reduce((s, i) => s + (i.shipmentId ? 1 : 0), 0);
    const transitForModel = items.length - arrivedForModel;

    if (transitForModel > 0) {
      events.push({
        type: 'transit',
        date: toISODate(batch.purchaseDate)!,
        data: batchData,
        qty: transitForModel,
      });
    }
    if (arrivedForModel > 0) {
      const lastDate = batchData.shipments.length
        ? batchData.shipments[batchData.shipments.length - 1].date
        : toISODate(batch.purchaseDate)!;
      events.push({
        type: 'arrived',
        date: lastDate,
        data: batchData,
        qty: arrivedForModel,
      });
    }
  }

  // Landed cost of one sold unit, in UYU: its base price plus the shipping
  // share resolved above (0 while in transit).
  const itemCostUyu = (i: typeof soldItems[0]) =>
    Number(i.basePriceUyu) + (shippingShareByItem.get(i.id) ?? 0);

  const cost = soldItems.reduce((s, i) => s + itemCostUyu(i), 0);
  const profit = revenue - cost;
  // A unit sold before it arrived has no shipping share yet, so its profit is
  // provisional until its shipment lands.
  const profitPending = soldItems.some((i) => !i.shipmentId);

  // Group sales by (date, collectedByUserId, size) so each collector gets their
  // own event per day, split by size — sizes now carry distinct cost/profit.
  const saleByKey = new Map<string, { size: string; price: number; profit: number; qty: number; s: typeof soldItems[0]['sale']; dateKey: string }>();
  for (const item of soldItems) {
    const s = item.sale!;
    const dateKey = toISODate(s.date)!;
    const key = `${dateKey}::${s.collectedByUserId ?? ''}::${item.size}`;
    const saleProfit = Number(s.price) - itemCostUyu(item);
    const existing = saleByKey.get(key);
    if (existing) {
      existing.price += Number(s.price);
      existing.profit += saleProfit;
      existing.qty += 1;
    } else {
      saleByKey.set(key, { size: item.size, price: Number(s.price), profit: saleProfit, qty: 1, s, dateKey });
    }
  }

  for (const [, { size, price, profit: eventProfit, qty, s, dateKey }] of saleByKey) {
    const saleData: SaleRecord = {
      id: s!.id,
      catalogProductId: id,
      size,
      price,
      quantity: qty,
      date: dateKey,
      method: s!.method,
      description: s!.description,
      collectedByUserId: s!.collectedByUserId,
      collectedByAlias: s!.collectedByUser?.alias ?? null,
      profit: eventProfit,
    };
    events.push({ type: 'sale', date: dateKey, data: saleData, qty });
  }

  events.sort((a, b) => b.date.localeCompare(a.date));

  return {
    ...productMeta(p),
    stock,
    inTransit,
    availableBySize,
    sold,
    revenue,
    profit,
    profitPending,
    events,
  };
}

export async function getPurchases(): Promise<BatchSummary[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.purchases);
  const batches = await prisma.batch.findMany({
    include: {
      items: { include: { product: { include: { team: true } } } },
      supplierPayments: { include: { user: true } },
      shipments: {
        include: { shippingPaidByUser: true },
        orderBy: { date: 'asc' },
      },
    },
    orderBy: { purchaseDate: 'desc' },
  });

  return batches.map((b) =>
    batchToSummary(b, b.items.map((i) => ({ ...i, product: i.product })))
  );
}

export async function getBatchById(id: string): Promise<BatchSummary | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.purchases);
  const b = await prisma.batch.findUnique({
    where: { id },
    include: {
      items: { include: { product: { include: { team: true } } } },
      supplierPayments: { include: { user: true } },
      shipments: {
        include: { shippingPaidByUser: true },
        orderBy: { date: 'asc' },
      },
    },
  });
  if (!b) return null;

  return batchToSummary(b, b.items.map((i) => ({ ...i, product: i.product })));
}

export async function getPublicModels() {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.models);
  const products = await prisma.catalogProduct.findMany({
    include: {
      team: true,
      items: { select: { status: true, size: true, shipmentId: true } },
    },
    orderBy: { team: { name: 'asc' } },
  });

  const models = products
    .map((p) => {
      const availableItems = p.items.filter(
        (i) => i.shipmentId !== null && i.status === 'available'
      );
      // When showing all models, suppress sizes entirely (availability not guaranteed)
      const sizes = SHOW_ALL_MODELS
        ? []
        : [...new Set(availableItems.map((i) => i.size).filter(Boolean))];
      return {
        ...productMeta(p, sizes),
        stock: availableItems.length,
      };
    })
    .filter((p) => SHOW_ALL_MODELS || p.stock > 0);

  return { models, today: fmtDate(new Date().toISOString().split('T')[0]) };
}

export async function getHomeSales(): Promise<HomeSaleItem[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.saldos);
  const sales = await prisma.sale.findMany({
    select: {
      id: true,
      price: true,
      date: true,
      collectedByUserId: true,
      collectedByUser: { select: { alias: true } },
      item: {
        select: {
          catalogProductId: true,
          product: {
            select: {
              color: true,
              version: true,
              number: true,
              player: true,
              team: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { date: 'desc' },
  });
  return sales.map((s) => ({
    id: s.id,
    catalogProductId: s.item.catalogProductId,
    teamName: s.item.product.team.name,
    color: s.item.product.color,
    version: s.item.product.version,
    number: s.item.product.number !== null ? String(s.item.product.number) : null,
    player: s.item.product.player,
    price: Number(s.price),
    date: toISODate(s.date)!,
    collectedByUserId: s.collectedByUserId,
    collectedByAlias: s.collectedByUser?.alias ?? null,
  }));
}

export async function getTransitCount(): Promise<number> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.purchases);
  // A batch is "in transit" (or partial) as long as it has at least one item
  // that hasn't been received via a shipment.
  const transitBatches = await prisma.batch.findMany({
    where: { items: { some: { shipmentId: null } } },
    select: { id: true },
  });
  return transitBatches.length;
}

