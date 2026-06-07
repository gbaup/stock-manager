export const USD_RATE = 40.5;

export const PEOPLE = ['Caja', 'Bauer'] as const;
export type Person = typeof PEOPLE[number];

export const METHODS = ['Efectivo', 'Transferencia', 'MercadoPago', 'MercadoLibre'] as const;
export const VERSIONS = ['Home', 'Away', 'Third', 'Fourth', 'Arquero', 'Retro'] as const;
export const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'] as const;
export const SHIRT_TYPES = ['Fan', 'Player', 'Retro'] as const;
export const SLEEVES = ['Corta', 'Larga'] as const;

export const JERSEY_COLORS = [
  { name: 'Blanco',   bg: '#f4f5f7', fg: '#1b2330' },
  { name: 'Negro',    bg: '#1c1f26', fg: '#f4f5f7' },
  { name: 'Azul',     bg: '#1d4fd7', fg: '#ffffff' },
  { name: 'Celeste',  bg: '#4aa3e8', fg: '#0c2740' },
  { name: 'Rojo',     bg: '#d22d3a', fg: '#ffffff' },
  { name: 'Amarillo', bg: '#f2c43d', fg: '#3a2c05' },
  { name: 'Verde',    bg: '#1f9d57', fg: '#ffffff' },
  { name: 'Bordó',    bg: '#7c1f2e', fg: '#ffffff' },
  { name: 'Naranja',  bg: '#e8702a', fg: '#ffffff' },
  { name: 'Violeta',  bg: '#6b3fb5', fg: '#ffffff' },
  { name: 'Rosa',     bg: '#e95fa0', fg: '#3a0d24' },
] as const;

export type JerseyColor = typeof JERSEY_COLORS[number];

export function colorByName(name: string): JerseyColor {
  return (JERSEY_COLORS.find((c) => c.name === name) ?? JERSEY_COLORS[0]) as JerseyColor;
}

export function personInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic'];

export function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : date;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function uyu(n: number): string {
  return `$U ${new Intl.NumberFormat('es-UY').format(Math.round(n))}`;
}

export function usd(n: number): string {
  return `US$ ${new Intl.NumberFormat('es-UY').format(Math.round(n))}`;
}

export function toUsd(uyuAmount: number): number {
  return uyuAmount / USD_RATE;
}

export function signedUyu(n: number): string {
  if (n === 0) return '$U 0';
  const abs = uyu(Math.abs(n));
  return n > 0 ? `+ ${abs}` : `− ${abs}`;
}

export function signedUsd(n: number): string {
  if (n === 0) return 'US$ 0';
  const abs = usd(Math.abs(n));
  return n > 0 ? `+ ${abs}` : `− ${abs}`;
}

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
  photos: string[];
  sizes: string[];  // derived from in-stock InventoryItem.size values
  description: string | null;
};

export type ModelWithStats = ModelMeta & {
  stock: number;
  inTransit: number;
};

export type PurchaseStatus = 'transit' | 'arrived';

export type ItemInBatch = {
  id: string;
  catalogProductId: string;
  size: string;
  basePriceUsd: number;
  product: ModelMeta;
};

export type BatchSummary = {
  id: string;
  supplier: string | null;
  purchaseDate: string;
  arrivalDate: string | null;
  quantity: number;
  trackingNumber: string | null;
  description: string | null;
  shippingPriceUsd: number | null;
  shippingPriceUyu: number | null;
  weight: number | null;
  status: PurchaseStatus;
  supplierPaidBy: string | null;
  shippingPaidBy: string | null;
  items: ItemInBatch[];
};

export type SaleRecord = {
  id: string;
  catalogProductId: string;
  price: number;
  quantity: number;
  date: string;
  method: string | null;
  description: string | null;
  collectedBy: string | null;
};

export type TimelineEvent =
  | { type: 'sale';    date: string; data: SaleRecord;    qty: number }
  | { type: 'transit'; date: string; data: BatchSummary;  qty: number }
  | { type: 'arrived'; date: string; data: BatchSummary;  qty: number };

export type ModelDetail = ModelWithStats & {
  sold: number;
  revenue: number;
  events: TimelineEvent[];
};

export type ExpenseRecord = {
  id: string;
  title: string;
  amount: number;
  currency: 'UYU' | 'USD';
  paidBy: string;
  date: string;
};

export type MovementKind = 'cobro' | 'pago-prov' | 'pago-envio' | 'gasto';

export type Movement = {
  id: string;
  kind: MovementKind;
  date: string;
  person: string;
  title: string;
  sub: string;
  uyu: number;
  usd: number;
};

export type PersonBalance = {
  uyu: number;
  usd: number;
  inUyu: number;
  outUyu: number;
  inUsd: number;
  outUsd: number;
};

export function buildMovements({
  sales,
  purchases,
  expenses,
}: {
  sales: Array<{ id: string; date: string; price: number; collectedBy: string | null; quantity: number; model: string }>;
  purchases: BatchSummary[];
  expenses: ExpenseRecord[];
}): Movement[] {
  const movements: Movement[] = [];

  for (const sale of sales) {
    if (!sale.collectedBy) continue;
    movements.push({
      id: `cobro-${sale.id}`,
      kind: 'cobro',
      date: sale.date,
      person: sale.collectedBy,
      title: `Venta ×${sale.quantity}`,
      sub: sale.model,
      uyu: sale.price,
      usd: 0,
    });
  }

  for (const batch of purchases) {
    const baseUsd = batch.items.reduce((s, it) => s + it.basePriceUsd, 0);
    if (baseUsd > 0 && batch.supplierPaidBy) {
      movements.push({
        id: `pago-prov-${batch.id}`,
        kind: 'pago-prov',
        date: batch.purchaseDate,
        person: batch.supplierPaidBy,
        title: batch.supplier ?? 'Proveedor',
        sub: `${batch.quantity} ${batch.quantity === 1 ? 'item' : 'items'}`,
        uyu: 0,
        usd: -baseUsd,
      });
    }

    const shippingUyu = batch.shippingPriceUyu ?? 0;
    const shippingUsd = batch.shippingPriceUsd ?? 0;
    if ((shippingUyu > 0 || shippingUsd > 0) && batch.shippingPaidBy && batch.arrivalDate) {
      movements.push({
        id: `pago-envio-${batch.id}`,
        kind: 'pago-envio',
        date: batch.arrivalDate,
        person: batch.shippingPaidBy,
        title: 'Envío',
        sub: batch.supplier ?? `${batch.quantity} items`,
        uyu: shippingUyu > 0 ? -shippingUyu : 0,
        usd: shippingUsd > 0 ? -shippingUsd : 0,
      });
    }
  }

  for (const expense of expenses) {
    movements.push({
      id: `gasto-${expense.id}`,
      kind: 'gasto',
      date: expense.date,
      person: expense.paidBy,
      title: expense.title,
      sub: expense.currency,
      uyu: expense.currency === 'UYU' ? -expense.amount : 0,
      usd: expense.currency === 'USD' ? -expense.amount : 0,
    });
  }

  movements.sort((a, b) => b.date.localeCompare(a.date));
  return movements;
}

export function balancesByPerson(movements: Movement[]): Record<string, PersonBalance> {
  const result: Record<string, PersonBalance> = {};

  for (const person of PEOPLE) {
    result[person] = { uyu: 0, usd: 0, inUyu: 0, outUyu: 0, inUsd: 0, outUsd: 0 };
  }

  for (const m of movements) {
    const b = result[m.person];
    if (!b) continue;
    b.uyu += m.uyu;
    b.usd += m.usd;
    if (m.uyu > 0) b.inUyu += m.uyu;
    if (m.uyu < 0) b.outUyu += Math.abs(m.uyu);
    if (m.usd > 0) b.inUsd += m.usd;
    if (m.usd < 0) b.outUsd += Math.abs(m.usd);
  }

  return result;
}
