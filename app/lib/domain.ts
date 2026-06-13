import type { Photo } from './photo';

export type UserSummary = { id: string; alias: string };

export const METHODS = ['Efectivo', 'Transferencia', 'MercadoPago', 'MercadoLibre'] as const;
export const VERSIONS = ['Home', 'Away', 'Third', 'Fourth', 'Arquero'] as const;
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
  supplierPaidByUserId: string | null;
  supplierPaidByAlias: string | null;
  shippingPaidByUserId: string | null;
  shippingPaidByAlias: string | null;
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
  collectedByUserId: string | null;
  collectedByAlias: string | null;
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


