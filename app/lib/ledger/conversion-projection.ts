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
  const fx = sameCur ? undefined : {
    uyu: c.fromCur === 'UYU' ? c.fromAmount : c.toAmount,
    usd: c.fromCur === 'USD' ? c.fromAmount : c.toAmount,
  };

  return [
    {
      id: `cambio-${c.id}-from`,
      kind: 'cambio',
      date: c.date,
      person: c.fromUserAlias,
      counterparty: c.toUserAlias,
      title,
      sub,
      uyu: c.fromCur === 'UYU' ? -c.fromAmount : 0,
      usd: c.fromCur === 'USD' ? -c.fromAmount : 0,
      fx,
    },
    {
      id: `cambio-${c.id}-to`,
      kind: 'cambio',
      date: c.date,
      person: c.toUserAlias,
      counterparty: c.fromUserAlias,
      title,
      sub,
      uyu: c.toCur === 'UYU' ? c.toAmount : 0,
      usd: c.toCur === 'USD' ? c.toAmount : 0,
    },
  ];
}
