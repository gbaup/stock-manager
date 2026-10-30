import type { UserSummary } from '../domain';
import type { Movement } from './types';

export type PersonFlows = {
  alias: string;
  // Sales collected in pesos, net of transfers between partners.
  ingresoUyu: number;
  // Real investment in dollars — supplier + shipping + USD expenses — net of
  // transfers between partners.
  inversionUsd: number;
  // Small peso expenses (tape, envelopes…) — shown as a note, not as outflow.
  gastosMenoresUyu: number;
};

const emptyFlows = (alias: string): PersonFlows => ({
  alias,
  ingresoUyu: 0,
  inversionUsd: 0,
  gastosMenoresUyu: 0,
});

// Income and investment per partner for one month ("YYYY-MM"), each currency
// on its own — nothing is converted. Partners often split a cost by one paying
// and the other transferring their half, so a transfer moves the number: pesos
// received add to income and pesos sent subtract; dollars received lower the
// investment and dollars sent raise it (the sender is covering their share).
// A transfer between partners is valued in the currency the receiver got: if
// one sends pesos and the other receives dollars, the sender bought those
// dollars for the business, so it counts as the sender's investment rather
// than lost income. That keeps the partners' sum equal to the real totals.
// A partner swapping their own currency is not a flow, and adjustments are
// manual corrections, so both are left out.
export function buildMonthlyFlows(
  movements: Movement[],
  monthKey: string,
  users: UserSummary[],
): PersonFlows[] {
  const byAlias = new Map(users.map((u) => [u.alias, emptyFlows(u.alias)]));

  for (const m of movements) {
    if (m.date.slice(0, 7) !== monthKey) continue;
    const f = byAlias.get(m.person);
    if (!f) continue;

    switch (m.kind) {
      case 'cobro':
        f.ingresoUyu += m.uyu;
        break;
      case 'pago-prov':
      case 'pago-envio':
        f.inversionUsd += Math.abs(m.usd);
        break;
      case 'gasto':
        f.inversionUsd += Math.abs(m.usd);
        f.gastosMenoresUyu += Math.abs(m.uyu);
        break;
      case 'cambio': {
        if (!m.counterparty || m.counterparty === m.person) break;
        // Only the receiving side (positive amount) drives the transfer; it
        // credits the receiver and debits the sender in that same currency.
        if (m.uyu <= 0 && m.usd <= 0) break;
        const sender = byAlias.get(m.counterparty);
        f.ingresoUyu += m.uyu;
        f.inversionUsd -= m.usd;
        if (sender) {
          sender.ingresoUyu -= m.uyu;
          sender.inversionUsd += m.usd;
        }
        break;
      }
      default:
        break;
    }
  }

  return [...byAlias.values()];
}
