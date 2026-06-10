import type { Movement } from './types';
import type { AdjustmentRecord } from '../domain';

// An adjustment is a manual correction to a person's balance, recorded with
// its own UYU and USD deltas (either can be zero). Does not touch inventory.
export function projectAdjustment(a: AdjustmentRecord): Movement[] {
  return [{
    id: `ajuste-${a.id}`,
    kind: 'ajuste',
    date: a.date,
    person: a.userAlias,
    title: a.note ?? 'Ajuste',
    sub: '',
    uyu: a.amountUyu,
    usd: a.amountUsd,
  }];
}
