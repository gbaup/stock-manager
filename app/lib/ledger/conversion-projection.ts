import type { Movement } from './types';
import type { ConversionRecord } from '../domain';
import { fmtRate } from '../format';

// A conversion is a single event that affects two people in two currencies.
// We project it as one 'cambio' movement carrying the raw record on `conv`
// so the saldos UI can render the cross-currency chip pair, and the balance
// fold can split the two sides correctly.
export function projectConversion(c: ConversionRecord): Movement[] {
  const sameCur = c.fromCur === c.toCur;
  return [{
    id: `cambio-${c.id}`,
    kind: 'cambio',
    date: c.date,
    person: c.fromUserAlias,
    title: sameCur
      ? 'Transferencia entre socios'
      : c.fromCur === 'UYU'
        ? 'Cambio · Pesos → Dólares'
        : 'Cambio · Dólares → Pesos',
    sub: sameCur ? '' : `TC ${fmtRate(c.rate)}`,
    uyu: 0,
    usd: 0,
    conv: c,
  }];
}
