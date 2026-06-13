import type { Movement } from './types';
import type { ConversionRecord } from '../domain';
import { fmtRate } from '../format';

// Each side of a conversion becomes its own Movement so the balance fold and
// the UI treat conversions uniformly — no special `conv` field needed.
export function projectConversion(c: ConversionRecord): Movement[] {
  const sameCur = c.fromCur === c.toCur;
  const title = sameCur
    ? 'Transferencia entre socios'
    : c.fromCur === 'UYU'
      ? 'Cambio · Pesos → Dólares'
      : 'Cambio · Dólares → Pesos';
  const sub = sameCur ? '' : `TC ${fmtRate(c.rate)}`;

  return [
    {
      id: `cambio-${c.id}-from`,
      kind: 'cambio',
      date: c.date,
      person: c.fromUserAlias,
      title,
      sub,
      uyu: c.fromCur === 'UYU' ? -c.fromAmount : 0,
      usd: c.fromCur === 'USD' ? -c.fromAmount : 0,
    },
    {
      id: `cambio-${c.id}-to`,
      kind: 'cambio',
      date: c.date,
      person: c.toUserAlias,
      title,
      sub,
      uyu: c.toCur === 'UYU' ? c.toAmount : 0,
      usd: c.toCur === 'USD' ? c.toAmount : 0,
    },
  ];
}
