import { JERSEY_COLORS, type JerseyColor } from './domain';

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
  return `US$ ${new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
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

export function fmtRate(n: number): string {
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(n);
}
