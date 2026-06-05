export const USD_RATE = 40.5;

export const METHODS = ['Efectivo', 'Transferencia', 'MercadoPago', 'MercadoLibre'] as const;
export const VERSIONS = ['Home', 'Away', 'Third', 'Fourth', 'Arquero', 'Retro'] as const;
export const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'] as const;

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

// ---- Domain types (serialization-safe: no Prisma Decimal, no Date objects) ----

export type ModelMeta = {
  id: string;
  team: string;
  season: string;
  version: string | null;
  color: string;
  number: string | null;
  player: string | null;
};

export type ModelWithStats = ModelMeta & {
  description: string | null;
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
