export const PEOPLE = ['Caja', 'Bauer'] as const;
export type Person = typeof PEOPLE[number];

export const METHODS = ['Efectivo', 'Transferencia', 'MercadoPago', 'MercadoLibre'] as const;
export const VERSIONS = ['Home', 'Away', 'Third', 'Fourth', 'Arquero', 'Retro'] as const;
export const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'] as const;
export const SHIRT_TYPES = ['Fan', 'Player', 'Retro'] as const;
export const SLEEVES = ['Corta', 'Larga'] as const;

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
] as const;

export type JerseyColor = typeof JERSEY_COLORS[number];

export function colorByName(name: string): JerseyColor {
  return (JERSEY_COLORS.find((c) => c.name === name) ?? JERSEY_COLORS[0]) as JerseyColor;
}

export function personInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

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

export function toUsd(uyuAmount: number, rate: number): number {
  return uyuAmount / rate;
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
  | { type: 'sale'; date: string; data: SaleRecord; qty: number }
  | { type: 'transit'; date: string; data: BatchSummary; qty: number }
  | { type: 'arrived'; date: string; data: BatchSummary; qty: number };

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

export type ConversionRecord = {
  id: string;
  date: string;
  fromPerson: string;
  fromCur: 'UYU' | 'USD';
  toPerson: string;
  toCur: 'UYU' | 'USD';
  fromAmount: number;
  rate: number;
  toAmount: number;
};

export function fmtRate(n: number): string {
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(n);
}

export function convertAmount(
  fromAmount: number,
  fromCur: 'UYU' | 'USD',
  toCur: 'UYU' | 'USD',
  rate: number,
): number {
  if (!fromAmount) return 0;
  if (fromCur === toCur) return fromAmount;
  if (fromCur === 'UYU' && toCur === 'USD') return rate ? Math.round((fromAmount / rate) * 100) / 100 : 0;
  if (fromCur === 'USD' && toCur === 'UYU') return Math.round(fromAmount * rate);
  return fromAmount;
}

