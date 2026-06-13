import { cacheTag, cacheLife } from 'next/cache';
import { prisma } from './prisma';
import { fmtDate } from './format';
import { stockByModel, countStock } from './inventory';
import { CACHE_TAGS } from './cache-tags';
import { parsePhotos } from './photo';
import type { Photo } from './photo';
import type {
  ModelWithStats, ModelDetail, BatchSummary,
  ModelMeta, PurchaseStatus, TimelineEvent, SaleRecord, UserSummary,
} from './domain';

export type HomeSaleItem = {
  id: string;
  catalogProductId: string;
  teamName: string;
  color: string;
  version: string | null;
  number: string | null;
  photos: Photo[];
  price: number;
  date: string;
  collectedByUserId: string | null;
  collectedByAlias: string | null;
};

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

function batchToSummary(
  b: {
    id: string; purchaseDate: Date; arrivalDate: Date | null;
    supplier: string | null;
    trackingNumber: string | null; description: string | null;
    shippingPriceUsd: unknown; shippingPriceUyu: unknown; weight: unknown;
    supplierPaidByUserId: string | null;
    supplierPaidByUser: { alias: string } | null;
    shippingPaidByUserId: string | null;
    shippingPaidByUser: { alias: string } | null;
  },
  items: Array<{ id: string; catalogProductId: string; size: string; basePriceUsd: unknown; product: Parameters<typeof productMeta>[0] }>
): BatchSummary {
  return {
    id: b.id,
    supplier: b.supplier,
    purchaseDate: toISODate(b.purchaseDate)!,
    arrivalDate: toISODate(b.arrivalDate),
    quantity: items.length,
    trackingNumber: b.trackingNumber,
    description: b.description,
    shippingPriceUsd: b.shippingPriceUsd ? Number(b.shippingPriceUsd) : null,
    shippingPriceUyu: b.shippingPriceUyu ? Number(b.shippingPriceUyu) : null,
    weight: b.weight ? Number(b.weight) : null,
    status: (b.arrivalDate ? 'arrived' : 'transit') as PurchaseStatus,
    supplierPaidByUserId: b.supplierPaidByUserId,
    supplierPaidByAlias: b.supplierPaidByUser?.alias ?? null,
    shippingPaidByUserId: b.shippingPaidByUserId,
    shippingPaidByAlias: b.shippingPaidByUser?.alias ?? null,
    items: items.map((i) => ({
      id: i.id,
      catalogProductId: i.catalogProductId,
      size: i.size,
      basePriceUsd: Number(i.basePriceUsd),
      product: productMeta(i.product),
    })),
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
  const [products, counts] = await Promise.all([
    prisma.catalogProduct.findMany({
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    }),
    stockByModel(),
  ]);

  return products.map((p) => {
    const c = counts.get(p.id);
    return {
      ...productMeta(p),
      stock: c?.available ?? 0,
      inTransit: c?.inTransit ?? 0,
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
              supplierPaidByUser: true,
              shippingPaidByUser: true,
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

  // Group sales by (date, collectedByUserId) so each collector gets their own event per day
  const saleByKey = new Map<string, { price: number; qty: number; s: typeof soldItems[0]['sale']; dateKey: string }>();
  for (const item of soldItems) {
    const s = item.sale!;
    const dateKey = toISODate(s.date)!;
    const key = `${dateKey}::${s.collectedByUserId ?? ''}`;
    const existing = saleByKey.get(key);
    if (existing) {
      existing.price += Number(s.price);
      existing.qty += 1;
    } else {
      saleByKey.set(key, { price: Number(s.price), qty: 1, s, dateKey });
    }
  }

  for (const [, { price, qty, s, dateKey }] of saleByKey) {
    const saleData: SaleRecord = {
      id: s!.id,
      catalogProductId: id,
      price,
      quantity: qty,
      date: dateKey,
      method: s!.method,
      description: s!.description,
      collectedByUserId: s!.collectedByUserId,
      collectedByAlias: s!.collectedByUser?.alias ?? null,
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
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.purchases);
  const batches = await prisma.batch.findMany({
    include: {
      items: { include: { product: { include: { team: true } } } },
      supplierPaidByUser: true,
      shippingPaidByUser: true,
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
      supplierPaidByUser: true,
      shippingPaidByUser: true,
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
      items: { select: { status: true, size: true, batch: { select: { arrivalDate: true } } } },
    },
    orderBy: { team: { name: 'asc' } },
  });

  const models = products
    .map((p) => {
      const availableItems = p.items.filter(
        (i) => i.batch.arrivalDate !== null && i.status === 'available'
      );
      const sizes = [...new Set(availableItems.map((i) => i.size).filter(Boolean))];
      return {
        ...productMeta(p, sizes),
        stock: availableItems.length,
      };
    })
    .filter((p) => p.stock > 0);

  return { models, today: fmtDate(new Date().toISOString().split('T')[0]) };
}

export async function getHomeSales(): Promise<HomeSaleItem[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.saldos);
  const items = await prisma.inventoryItem.findMany({
    where: { status: 'sold' },
    include: {
      product: { include: { team: true } },
      sale: {
        select: {
          id: true,
          price: true,
          date: true,
          collectedByUserId: true,
          collectedByUser: { select: { alias: true } },
        },
      },
    },
  });
  return items
    .filter((i) => i.sale !== null)
    .map((i) => ({
      id: i.sale!.id,
      catalogProductId: i.catalogProductId,
      teamName: i.product.team.name,
      color: i.product.color,
      version: i.product.version,
      number: i.product.number !== null ? String(i.product.number) : null,
      photos: parsePhotos(i.product.photos),
      price: Number(i.sale!.price),
      date: toISODate(i.sale!.date)!,
      collectedByUserId: i.sale!.collectedByUserId,
      collectedByAlias: i.sale!.collectedByUser?.alias ?? null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTransitCount(): Promise<number> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.purchases);
  return prisma.batch.count({ where: { arrivalDate: null } });
}

