import { cacheTag, cacheLife } from 'next/cache';
import { prisma } from './prisma';
import { fmtDate } from './format';
import { stockByModel, countStock } from './inventory';
import { CACHE_TAGS } from './cache-tags';
import { parsePhotos } from './photo';
import type {
  ModelWithStats, ModelDetail, BatchSummary,
  ModelMeta, PurchaseStatus, TimelineEvent, SaleRecord, UserSummary,
  ShipmentRecord,
} from './domain';

export type HomeSaleItem = {
  id: string;
  catalogProductId: string;
  teamName: string;
  color: string;
  version: string | null;
  number: string | null;
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
    shippingPriceUsd: unknown; shippingPriceUyu: unknown; weight: unknown;
    supplierPayments: Array<{ userId: string; amountUsd: unknown; user: { alias: string } }>;
    shippingPaidByUserId: string | null;
    shippingPaidByUser: { alias: string } | null;
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
  const total = items.length;
  const status: PurchaseStatus =
    arrivedQuantity <= 0 ? 'transit' :
    arrivedQuantity >= total ? 'arrived' :
    'partial';

  // For legacy summary fields, surface either the most recent shipment data or
  // the batch fallback (used in case the batch row still holds metadata for an
  // older record that hasn't been turned into a shipment yet).
  const lastShipment = shipments[shipments.length - 1] ?? null;
  const arrivalDate = lastShipment ? lastShipment.date : toISODate(b.arrivalDate);
  const trackingNumber = lastShipment?.trackingNumber ?? b.trackingNumber;
  const shippingPriceUsd = shipments.reduce((s, sh) => s + (sh.shippingPriceUsd ?? 0), 0) || (b.shippingPriceUsd ? Number(b.shippingPriceUsd) : 0);
  const shippingPriceUyu = shipments.reduce((s, sh) => s + (sh.shippingPriceUyu ?? 0), 0) || (b.shippingPriceUyu ? Number(b.shippingPriceUyu) : 0);
  const weight = lastShipment?.weight ?? (b.weight ? Number(b.weight) : null);
  const shippingPaidByUserId = lastShipment?.shippingPaidByUserId ?? b.shippingPaidByUserId;
  const shippingPaidByAlias = lastShipment?.shippingPaidByAlias ?? b.shippingPaidByUser?.alias ?? null;

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
              supplierPayments: { include: { user: true } },
              shippingPaidByUser: true,
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

  for (const [, { batch, items }] of batchMap) {
    // Build the summary from ALL items of the batch (needed for accurate
    // shipment grouping and totals), but compute per-model qty from `items`.
    const allBatchItems = await prisma.inventoryItem.findMany({
      where: { batchId: batch.id },
      select: {
        id: true, catalogProductId: true, size: true, basePriceUsd: true, shipmentId: true,
        product: { include: { team: true } },
      },
    });
    const batchData = batchToSummary(batch, allBatchItems);

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
      supplierPayments: { include: { user: true } },
      shippingPaidByUser: true,
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
      shippingPaidByUser: true,
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

