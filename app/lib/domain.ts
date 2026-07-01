import type { Photo } from './photo';

export type UserSummary = { id: string; alias: string };

export const METHODS = ['Efectivo', 'Transferencia', 'MercadoPago', 'MercadoLibre'] as const;
export const VERSIONS = ['Home', 'Away', 'Third', 'Fourth', 'Arquero'] as const;
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;
export const KID_SIZES = ['20', '22', '24', '26', '28'] as const;
export const ITEM_TYPES = ['Fan', 'Player', 'Retro', 'KidKit', 'Short', 'NBA'] as const;
export const SLEEVES = ['Corta', 'Larga'] as const;

const KID_SIZE_LABELS: Record<string, string> = {
  '20': '5-6 años', '22': '7-8 años', '24': '8-10 años', '26': '10-12 años',
  '28': '12-13 años',
};

// Size options for the purchase selector, based on a model's type.
export const sizesForType = (type: string | null | undefined): readonly string[] =>
  type === 'kidkit' ? KID_SIZES : SIZES;

// Public-facing label: kid numeric sizes -> age range, everything else unchanged.
export const fmtSize = (size: string): string => KID_SIZE_LABELS[size] ?? size;

export const JERSEY_COLORS = [
  { name: 'blanco', bg: '#f4f5f7', fg: '#1b2330' },
  { name: 'negro', bg: '#1c1f26', fg: '#f4f5f7' },
  { name: 'azul', bg: '#1d4fd7', fg: '#ffffff' },
  { name: 'celeste', bg: '#4aa3e8', fg: '#0c2740' },
  { name: 'rojo', bg: '#da2332ff', fg: '#ffffff' },
  { name: 'amarillo', bg: '#f2c43d', fg: '#3a2c05' },
  { name: 'verde', bg: '#1f9d57', fg: '#ffffff' },
  { name: 'bordó', bg: '#7c1f2e', fg: '#ffffff' },
  { name: 'naranja', bg: '#e8702a', fg: '#ffffff' },
  { name: 'violeta', bg: '#6b3fb5', fg: '#ffffff' },
  { name: 'rosa', bg: '#e95fa0', fg: '#3a0d24' },
  { name: 'gris', bg: '#c4c4c4ff', fg: '#3a2c05' },
] as const;

export type JerseyColor = typeof JERSEY_COLORS[number];

// ---- Domain types (serialization-safe: no Prisma Decimal, no Date objects) ----

export type ModelMeta = {
  id: string;
  team: string;
  season: string;
  version: string | null;
  color: string;
  number: string | null;
  player: string | null;
  type: string | null;
  sleeve: string | null;
  photos: Photo[];
  sizes: string[];  // derived from in-stock InventoryItem.size values
  description: string | null;
};

export type ModelWithStats = ModelMeta & {
  stock: number;
  inTransit: number;
  // Sizes that currently have stock, with their available unit counts. Drives
  // the size picker on the sale forms so a sale consumes the right size (FIFO
  // is applied *within* the chosen size).
  availableBySize: { size: string; count: number }[];
};

// Diacritic-insensitive, case-insensitive text key for model search.
const normalizeText = (s: string | null | undefined): string =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// The single searchable string for a model: every field a picker matches on.
// Shared by every model picker so search behaves identically everywhere.
export function modelHaystack(m: ModelMeta): string {
  return normalizeText(
    [m.team, m.version, m.season, m.player, m.number && '#' + m.number, m.type, m.sleeve, m.color, m.description]
      .filter(Boolean)
      .join(' '),
  );
}

// Does a model match a free-text query? Empty query matches everything.
export function matchesModel(m: ModelMeta, query: string): boolean {
  const q = normalizeText(query.trim());
  return q === '' || modelHaystack(m).includes(q);
}

// Size -> available unit count, the shape the sale schema validates against.
export const sizeStockOf = (
  model: { availableBySize: { size: string; count: number }[] },
): Record<string, number> => Object.fromEntries(model.availableBySize.map((s) => [s.size, s.count]));

export type PurchaseStatus = 'transit' | 'partial' | 'arrived';

// A batch's arrival state, derived from how many of its items have shipped —
// never stored. See ADR 0004.
export function derivePurchaseStatus(arrivedQuantity: number, totalQuantity: number): PurchaseStatus {
  if (arrivedQuantity <= 0) return 'transit';
  if (arrivedQuantity >= totalQuantity) return 'arrived';
  return 'partial';
}

export type ItemInBatch = {
  id: string;
  catalogProductId: string;
  size: string;
  basePriceUsd: number;
  shipmentId: string | null;
  product: ModelMeta;
};

export type ShipmentRecord = {
  id: string;
  date: string;
  trackingNumber: string | null;
  shippingPriceUsd: number | null;
  shippingPriceUyu: number | null;
  weight: number | null;
  shippingPaidByUserId: string | null;
  shippingPaidByAlias: string | null;
  itemIds: string[];
};

export type BatchSummary = {
  id: string;
  supplier: string | null;
  purchaseDate: string;
  arrivalDate: string | null;
  quantity: number;
  arrivedQuantity: number;
  trackingNumber: string | null;
  description: string | null;
  shippingPriceUsd: number | null;
  shippingPriceUyu: number | null;
  weight: number | null;
  status: PurchaseStatus;
  supplierPayments: Array<{ userId: string; alias: string; amountUsd: number }>;
  shippingPaidByUserId: string | null;
  shippingPaidByAlias: string | null;
  items: ItemInBatch[];
  shipments: ShipmentRecord[];
};

export type SaleRecord = {
  id: string;
  catalogProductId: string;
  size: string;
  price: number;
  quantity: number;
  date: string;
  method: string | null;
  description: string | null;
  collectedByUserId: string | null;
  collectedByAlias: string | null;
  profit: number;
};

export type TimelineEvent =
  | { type: 'sale'; date: string; data: SaleRecord; qty: number }
  | { type: 'transit'; date: string; data: BatchSummary; qty: number }
  | { type: 'arrived'; date: string; data: BatchSummary; qty: number };

export type ModelDetail = ModelWithStats & {
  sold: number;
  revenue: number;
  // Revenue minus landed cost (base price + allocated shipping) of sold items,
  // all in UYU. `profitPending` is true when at least one sold item left while
  // still in transit, so its shipping share — and thus its profit — isn't final.
  profit: number;
  profitPending: boolean;
  events: TimelineEvent[];
};

// Equal-split shipping allocation: each item in a shipment carries the same
// share of that shipment's UYU shipping cost. The single place this rule
// lives — swap the body if allocation ever becomes weight- or cost-based.
export function shippingShareUyu(shipment: { shippingPriceUyu: number | null; itemIds: string[] }): number {
  if (!shipment.shippingPriceUyu || shipment.itemIds.length === 0) return 0;
  return shipment.shippingPriceUyu / shipment.itemIds.length;
}

// ---- Supplier-payment reconciliation (see CONTEXT.md "Reconciliation") ----

export type SupplierPaymentStatus = 'empty' | 'exact' | 'mismatch';

// A batch's base cost in USD: the sum of its items' base prices. Accepts either
// per-line items (with a quantity) or already-expanded unit rows.
export function baseCostUsd(items: { basePriceUsd: number; quantity?: number }[]): number {
  return items.reduce((s, it) => s + it.basePriceUsd * (it.quantity ?? 1), 0);
}

// The reconciliation rule: given the partners' payments and the base cost, is
// the batch `empty` (nobody paid — a valid state), `exact` (payments cover the
// cost), or `mismatch` (paid, but the totals disagree — invalid)?
export function reconcileSupplierPayments(
  payments: { amountUsd: number }[],
  baseCost: number,
): { paidSum: number; status: SupplierPaymentStatus } {
  const paid = payments.filter((p) => p.amountUsd > 0);
  const paidSum = paid.reduce((s, p) => s + p.amountUsd, 0);
  if (paid.length === 0) return { paidSum: 0, status: 'empty' };
  const status: SupplierPaymentStatus =
    Math.round(paidSum * 100) === Math.round(baseCost * 100) ? 'exact' : 'mismatch';
  return { paidSum, status };
}

// Turns the form's `{ userId: "amount" }` dict into the wire array the action
// takes, dropping blanks and non-positive amounts.
export function toSupplierPaymentArray(
  dict: Record<string, string | undefined> | undefined,
): { userId: string; amountUsd: number }[] {
  return Object.entries(dict ?? {})
    .map(([userId, v]) => ({ userId, amountUsd: parseFloat(v ?? '') || 0 }))
    .filter((p) => p.amountUsd > 0);
}

export type ExpenseRecord = {
  id: string;
  title: string;
  amount: number;
  currency: 'UYU' | 'USD';
  paidByUserId: string;
  paidByAlias: string;
  date: string;
};

export type AdjustmentRecord = {
  id: string;
  userId: string;
  userAlias: string;
  amountUyu: number;
  amountUsd: number;
  date: string;
  note: string | null;
};

export type ConversionRecord = {
  id: string;
  date: string;
  fromUserId: string;
  fromUserAlias: string;
  fromCur: 'UYU' | 'USD';
  toUserId: string;
  toUserAlias: string;
  toCur: 'UYU' | 'USD';
  fromAmount: number;
  rate: number;
  toAmount: number;
};


