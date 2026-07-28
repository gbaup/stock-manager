import { SALE_STATUS, fmtVersion, compareSizes } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`;
}

// Six months back from today, inclusive of the current month — the default
// window is wide enough to show a trend without listing years of history.
export function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 5);
  return d.toISOString().slice(0, 10);
}

export function monthsBetween(from: string, to: string): string[] {
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  const endKey = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}`;
  const months: string[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  while (months.length < 240) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    months.push(key);
    if (key === endKey) break;
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return months;
}

export function compactUyu(n: number): string {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `$U ${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `$U ${Math.round(n)}`;
}

export function inRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

export function activeInRange(sales: HomeSaleItem[], from: string, to: string): HomeSaleItem[] {
  return sales.filter((s) => s.status === SALE_STATUS.active && inRange(s.date, from, to));
}

export function methodBucket(method: string | null): 'MercadoPago' | 'MercadoLibre' | 'Otros' {
  const m = (method ?? '').trim().toLowerCase();
  if (m === 'mercadopago') return 'MercadoPago';
  if (m === 'mercadolibre') return 'MercadoLibre';
  return 'Otros';
}

export const METHOD_COLORS: Record<string, string> = {
  MercadoPago: '#1d4fd7',
  MercadoLibre: '#f2c43d',
  Otros: '#94a3b8',
};

// A small fixed palette cycled across sellers — low cardinality in practice
// (a couple of partners), so a short list is enough.
export const SELLER_PALETTE = ['#1d4fd7', '#1f9d57', '#e8702a', '#6b3fb5', '#da2332', '#4aa3e8'];

function modelLabel(s: HomeSaleItem): string {
  return [s.teamName, fmtVersion(s.version), s.number ? `#${s.number}` : null, s.player]
    .filter(Boolean)
    .join(' · ');
}

export type ModelAgg = {
  id: string; team: string; color: string; version: string | null; number: string | null;
  label: string; quantity: number; revenue: number; profit: number;
};

export function buildTopModels(sales: HomeSaleItem[]): ModelAgg[] {
  const map = new Map<string, ModelAgg>();
  sales.forEach((s) => {
    const cur = map.get(s.catalogProductId) ?? {
      id: s.catalogProductId, team: s.teamName, color: s.color, version: s.version,
      number: s.number, label: modelLabel(s), quantity: 0, revenue: 0, profit: 0,
    };
    cur.quantity += 1;
    cur.revenue += s.price;
    cur.profit += s.profit;
    map.set(s.catalogProductId, cur);
  });
  return [...map.values()];
}

export function buildClubBreakdown(sales: HomeSaleItem[]): { team: string; revenue: number; profit: number }[] {
  const map = new Map<string, { team: string; revenue: number; profit: number }>();
  sales.forEach((s) => {
    const cur = map.get(s.teamName) ?? { team: s.teamName, revenue: 0, profit: 0 };
    cur.revenue += s.price;
    cur.profit += s.profit;
    map.set(s.teamName, cur);
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

export function buildSizeBreakdown(sales: HomeSaleItem[]): { size: string; quantity: number }[] {
  const map = new Map<string, number>();
  sales.forEach((s) => map.set(s.size, (map.get(s.size) ?? 0) + 1));
  return [...map.entries()]
    .map(([size, quantity]) => ({ size, quantity }))
    .sort((a, b) => compareSizes(a.size, b.size));
}

export type SortKey = 'quantity' | 'revenue' | 'profit';
