import type { Photo } from './photo';

export type UserSummary = { id: string; alias: string };

export const METHODS = ['Efectivo', 'Transferencia', 'MercadoPago', 'MercadoLibre'] as const;
// Canonical enum values are lowercase — the same form the server stores via n()
// and every comparison uses. UI labels are derived at render time (fmtType /
// fmtVersion / fmtSleeve), so the picker still reads "Fan", "NBA", "Home".
export const VERSIONS = ['home', 'away', 'third', 'fourth', 'arquero'] as const;
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;
export const KID_SIZES = ['20', '22', '24', '26', '28'] as const;
export const ITEM_TYPES = ['fan', 'player', 'retro', 'kidkit', 'short', 'nba', 'jacket'] as const;
export const SLEEVES = ['corta', 'larga'] as const;

// Types that carry no version (e.g. jackets, NBA jerseys have no home/away).
export const TYPES_WITHOUT_VERSION = new Set(['nba', 'jacket']);
// Types that carry no sleeve (shorts and the above have no sleeve distinction).
export const TYPES_WITHOUT_SLEEVE = new Set(['nba', 'jacket', 'short']);

const KID_SIZE_LABELS: Record<string, string> = {
  '20': '5-6 años', '22': '7-8 años', '24': '8-10 años', '26': '10-12 años',
  '28': '12-13 años',
};

// Size options for the purchase selector, based on a model's type.
export const sizesForType = (type: string | null | undefined): readonly string[] =>
  type === 'kidkit' ? KID_SIZES : SIZES;

// Canonical incremental order across all size sets. KID_SIZES and SIZES are
// disjoint, so a single combined index gives a total order. Sizes are stored
// lowercase in the DB, so the order set and lookups are lowercased to match
// (SIZES is declared uppercase for display). Unknown sizes sort last
// (alphabetically among themselves) for stability.
const SIZE_ORDER: string[] = [...KID_SIZES, ...SIZES].map((s) => s.toLowerCase());
export const compareSizes = (a: string, b: string): number => {
  const ia = SIZE_ORDER.indexOf(a.toLowerCase());
  const ib = SIZE_ORDER.indexOf(b.toLowerCase());
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};

// Canonical version order (home before away before third...), same
// indexOf-based pattern as compareSizes. Unknown/null versions sort last.
const VERSION_ORDER: string[] = [...VERSIONS];
export const compareVersions = (a: string | null, b: string | null): number => {
  const ia = a ? VERSION_ORDER.indexOf(a.toLowerCase()) : -1;
  const ib = b ? VERSION_ORDER.indexOf(b.toLowerCase()) : -1;
  if (ia === -1 && ib === -1) return (a ?? '').localeCompare(b ?? '');
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};

// Public-facing label: kid numeric sizes -> age range, everything else unchanged.
export const fmtSize = (size: string): string => KID_SIZE_LABELS[size] ?? size;

// ---- Enum display labels (lowercase canonical value -> UI label) ----
// Most values just capitalize; the ones that don't (NBA, KidKit) live in a map.
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const ITEM_TYPE_LABELS: Record<string, string> = {
  fan: 'Fan', player: 'Player', retro: 'Retro', kidkit: 'KidKit', short: 'Short', nba: 'NBA', jacket: 'Jacket',
};
export const fmtType = (t: string | null | undefined): string => (t ? ITEM_TYPE_LABELS[t] ?? cap(t) : '');
export const fmtVersion = (v: string | null | undefined): string => (v ? cap(v) : '');
export const fmtSleeve = (s: string | null | undefined): string => (s ? cap(s) : '');

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
  // Units bought for a client but not yet handed over — excluded from `stock`
  // and from the public catalog, but tracked separately so they aren't lost.
  reserved: number;
  // Sizes that currently have stock, with their available unit counts. Drives
  // the size picker on the sale forms so a sale consumes the right size (FIFO
  // is applied *within* the chosen size).
  availableBySize: { size: string; count: number }[];
};

// Diacritic-insensitive, case-insensitive text key for model search.
const normalizeText = (s: string | null | undefined): string =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  // Null when the caller's query didn't fetch it (only the purchase edit form
  // needs it, to derive the batch's implicit exchange rate).
  basePriceUyu: number | null;
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
  supplierPayments: Array<{ userId: string; alias: string; amountUsd: number; cardTaxPct: number | null }>;
  shippingPaidByUserId: string | null;
  shippingPaidByAlias: string | null;
  items: ItemInBatch[];
  shipments: ShipmentRecord[];
  // Optimistic-lock token for the edit flow: every mutation that can change
  // the batch (metadata edits, item changes, shipments arriving) bumps it.
  // The edit form echoes it back and updatePurchase rejects a stale token.
  updatedAt: string;
};

// A Sale is soft-deleted: cancelling keeps the row as history under status
// 'cancelled' while the unit returns to stock. Every read that feeds money
// math (saldos, profit, revenue) must count ACTIVE sales only — filter
// through these constants, never a raw string. See CONTEXT.md "Sale".
export const SALE_STATUS = { active: 'active', cancelled: 'cancelled' } as const;
export type SaleStatus = (typeof SALE_STATUS)[keyof typeof SALE_STATUS];

// An InventoryItem's lifecycle: 'available' (sellable) -> 'reserved' (spoken
// for by a client, hidden from the public catalog) -> 'sold', or back to
// 'available' if a reservation is released.
export const INVENTORY_STATUS = { available: 'available', reserved: 'reserved', sold: 'sold' } as const;
export type InventoryStatus = (typeof INVENTORY_STATUS)[keyof typeof INVENTORY_STATUS];

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
  | { type: 'purchase'; date: string; data: BatchSummary; qty: number; priceUyuPerUnit: number; priceUsdPerUnit: number }
  | { type: 'transit'; date: string; data: BatchSummary; qty: number }
  | { type: 'arrived'; date: string; data: BatchSummary; qty: number; shipUyuPerUnit: number; shipUsdPerUnit: number };

export type ModelDetail = ModelWithStats & {
  sold: number;
  revenue: number;
  // Revenue minus landed cost (base price + allocated shipping) of sold items,
  // all in UYU. `profitPending` is true when at least one sold item left while
  // still in transit, so its shipping share — and thus its profit — isn't final.
  profit: number;
  profitPending: boolean;
  // Landed cost (base price + allocated shipping) of currently available
  // (arrived, unsold) stock — i.e. capital tied up in this model right now.
  stockCostUyu: number;
  stockCostUsd: number;
  avgCostUyu: number;
  avgCostUsd: number;
  costBySize: { size: string; count: number; avgCostUyu: number; avgCostUsd: number }[];
  // Reserved counterparts to availableBySize / the individual units behind
  // them, for the "Reservado" list (each with a Vender/Liberar action).
  reservedBySize: { size: string; count: number }[];
  reservedItems: { id: string; size: string; note: string | null; reservedAt: string }[];
  events: TimelineEvent[];
};

// Size -> average landed cost of available stock, the per-size counterpart to
// sizeStockOf. Absent for sizes with no available stock.
export const costBySizeOf = (
  model: { costBySize: { size: string; avgCostUyu: number; avgCostUsd: number }[] },
): Record<string, { avgCostUyu: number; avgCostUsd: number }> =>
  Object.fromEntries(model.costBySize.map((s) => [s.size, { avgCostUyu: s.avgCostUyu, avgCostUsd: s.avgCostUsd }]));

// Equal-split shipping allocation: each item in a shipment carries the same
// share of that shipment's UYU shipping cost. The single place this rule
// lives — swap the body if allocation ever becomes weight- or cost-based.
// Takes the raw price and item count so every caller can reach it regardless
// of how it holds the shipment (an itemIds array or a relation _count).
export function shippingShareUyu(shippingPriceUyu: number | null, itemCount: number): number {
  if (!shippingPriceUyu || itemCount === 0) return 0;
  return shippingPriceUyu / itemCount;
}

// ---- Supplier-payment reconciliation (see CONTEXT.md "Reconciliation") ----

export type SupplierPaymentStatus = 'empty' | 'exact' | 'mismatch';

// A batch's base cost in USD: the sum of its items' base prices. Accepts either
// per-line items (with a quantity) or already-expanded unit rows.
export function baseCostUsd(items: { basePriceUsd: number; quantity?: number }[]): number {
  return items.reduce((s, it) => s + it.basePriceUsd * (it.quantity ?? 1), 0);
}

// The reconciliation target when editing a batch: locked items keep their
// stored (already-taxed) prices, so their contribution is `lockedPreTaxTotal`
// (from pricing.unbakeBatch) rather than a fresh baseCostUsd computation —
// only the still-editable items get that. Both the edit form's live preview
// and the edit action's server-side validation must reconcile against this
// same total, or the two can silently disagree about what "paid in full" means.
export function editBatchBaseCostUsd(
  lockedPreTaxTotal: number,
  editableItems: { basePriceUsd: number; quantity?: number }[],
): number {
  return lockedPreTaxTotal + baseCostUsd(editableItems);
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

// Applies a card tax percentage to a USD amount, returning the gross cost.
// pct is a whole-number percentage (e.g. 5 means 5%). Returns amount unchanged when pct is 0 or absent.
export function applyCardTax(amountUsd: number, pct: number | null | undefined): number {
  return Math.round(amountUsd * (1 + (pct ?? 0) / 100) * 100) / 100;
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


