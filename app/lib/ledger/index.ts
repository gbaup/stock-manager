import type { BatchSummary, ExpenseRecord, ConversionRecord, AdjustmentRecord, UserSummary } from '../domain';
import type { Movement, PersonBalance, SettleTransfer, SaleRow } from './types';
import { emptyBalance } from './types';
import { projectSale } from './sale-projection';
import { projectPurchase } from './purchase-projection';
import { projectExpense } from './expense-projection';
import { projectConversion } from './conversion-projection';
import { projectAdjustment } from './adjustment-projection';

export type { Movement, PersonBalance, SettleTransfer, MovementKind, SaleRow } from './types';

type LedgerEvents = {
  sales: SaleRow[];
  purchases: BatchSummary[];
  expenses: ExpenseRecord[];
  conversions?: ConversionRecord[];
  adjustments?: AdjustmentRecord[];
};

// Project every event of every kind into a flat, date-sorted Movement list.
// Each event type owns its own projection — see ./{kind}-projection.ts.
export function buildMovements(events: LedgerEvents): Movement[] {
  const movements: Movement[] = [
    ...events.sales.flatMap(projectSale),
    ...events.purchases.flatMap(projectPurchase),
    ...events.expenses.flatMap(projectExpense),
    ...(events.conversions ?? []).flatMap(projectConversion),
    ...(events.adjustments ?? []).flatMap(projectAdjustment),
  ];
  movements.sort((a, b) => b.date.localeCompare(a.date));
  return movements;
}

// Fold movements into per-person balances. Conversions are split here because
// their movement carries both sides on `conv` rather than as two separate rows.
export function balancesByPerson(
  movements: Movement[],
  users: UserSummary[],
): Record<string, PersonBalance> {
  const result: Record<string, PersonBalance> = {};
  for (const u of users) result[u.alias] = emptyBalance();

  for (const m of movements) {
    if (m.kind === 'cambio') {
      if (!m.conv) continue;
      const c = m.conv;
      const fb = result[c.fromUserAlias];
      const tb = result[c.toUserAlias];
      if (fb) {
        if (c.fromCur === 'USD') { fb.usd -= c.fromAmount; fb.outUsd += c.fromAmount; }
        else { fb.uyu -= c.fromAmount; fb.outUyu += c.fromAmount; }
      }
      if (tb) {
        if (c.toCur === 'USD') { tb.usd += c.toAmount; tb.inUsd += c.toAmount; }
        else { tb.uyu += c.toAmount; tb.inUyu += c.toAmount; }
      }
      continue;
    }

    const b = result[m.person];
    if (!b) continue;
    b.uyu += m.uyu;
    b.usd += m.usd;
    if (m.uyu > 0) b.inUyu += m.uyu;
    if (m.uyu < 0) b.outUyu += Math.abs(m.uyu);
    if (m.usd > 0) b.inUsd += m.usd;
    if (m.usd < 0) b.outUsd += Math.abs(m.usd);
  }

  return result;
}

export function hasUsdActivity(b: PersonBalance): boolean {
  return b.inUsd > 0 || b.outUsd > 0 || b.usd !== 0;
}

export function balanceTotals(
  balances: Record<string, PersonBalance>,
  users: UserSummary[],
): { uyu: number; usd: number } {
  return {
    uyu: users.reduce((s, u) => s + (balances[u.alias]?.uyu ?? 0), 0),
    usd: users.reduce((s, u) => s + (balances[u.alias]?.usd ?? 0), 0),
  };
}

export function settleBalances(
  balances: Record<string, PersonBalance>,
  users: UserSummary[],
): SettleTransfer[] {
  const [u1, u2] = users;
  if (!u1 || !u2) return [];

  const b1 = balances[u1.alias] ?? emptyBalance();
  const b2 = balances[u2.alias] ?? emptyBalance();
  const transfers: SettleTransfer[] = [];

  const diffUyu = b1.uyu - b2.uyu;
  if (Math.abs(diffUyu) >= 1) {
    transfers.push({
      from: diffUyu > 0 ? u1.alias : u2.alias,
      to: diffUyu > 0 ? u2.alias : u1.alias,
      amount: Math.abs(diffUyu) / 2,
      currency: 'UYU',
    });
  }

  const diffUsd = b1.usd - b2.usd;
  if (Math.abs(diffUsd) >= 0.01) {
    transfers.push({
      from: diffUsd > 0 ? u1.alias : u2.alias,
      to: diffUsd > 0 ? u2.alias : u1.alias,
      amount: Math.abs(diffUsd) / 2,
      currency: 'USD',
    });
  }

  return transfers;
}
