import type { BatchSummary, ExpenseRecord, ConversionRecord, UserSummary } from './domain';
import { fmtRate } from './domain';

export type MovementKind = 'cobro' | 'pago-prov' | 'pago-envio' | 'gasto' | 'cambio';

export type Movement = {
  id: string;
  kind: MovementKind;
  date: string;
  person: string;
  title: string;
  sub: string;
  uyu: number;
  usd: number;
  conv?: ConversionRecord;
};

export type PersonBalance = {
  uyu: number;
  usd: number;
  inUyu: number;
  outUyu: number;
  inUsd: number;
  outUsd: number;
};

export function buildMovements({
  sales,
  purchases,
  expenses,
  conversions = [],
}: {
  sales: Array<{ id: string; date: string; price: number; collectedByUserId: string | null; collectedByAlias: string | null; quantity: number; model: string }>;
  purchases: BatchSummary[];
  expenses: ExpenseRecord[];
  conversions?: ConversionRecord[];
}): Movement[] {
  const movements: Movement[] = [];

  for (const sale of sales) {
    if (!sale.collectedByUserId) continue;
    movements.push({
      id: `cobro-${sale.id}`,
      kind: 'cobro',
      date: sale.date,
      person: sale.collectedByAlias ?? '',
      title: `Venta ×${sale.quantity}`,
      sub: sale.model,
      uyu: sale.price,
      usd: 0,
    });
  }

  for (const batch of purchases) {
    const baseUsd = batch.items.reduce((s, it) => s + it.basePriceUsd, 0);
    if (baseUsd > 0 && batch.supplierPaidByUserId) {
      movements.push({
        id: `pago-prov-${batch.id}`,
        kind: 'pago-prov',
        date: batch.purchaseDate,
        person: batch.supplierPaidByAlias ?? '',
        title: batch.supplier ?? 'Proveedor',
        sub: `${batch.quantity} ${batch.quantity === 1 ? 'item' : 'items'}`,
        uyu: 0,
        usd: -baseUsd,
      });
    }

    const shippingUyu = batch.shippingPriceUyu ?? 0;
    const shippingUsd = batch.shippingPriceUsd ?? 0;
    if ((shippingUyu > 0 || shippingUsd > 0) && batch.shippingPaidByUserId && batch.arrivalDate) {
      movements.push({
        id: `pago-envio-${batch.id}`,
        kind: 'pago-envio',
        date: batch.arrivalDate,
        person: batch.shippingPaidByAlias ?? '',
        title: 'Envío',
        sub: batch.supplier ?? `${batch.quantity} items`,
        uyu: shippingUyu > 0 ? -shippingUyu : 0,
        usd: shippingUsd > 0 ? -shippingUsd : 0,
      });
    }
  }

  for (const expense of expenses) {
    movements.push({
      id: `gasto-${expense.id}`,
      kind: 'gasto',
      date: expense.date,
      person: expense.paidByAlias,
      title: expense.title,
      sub: expense.currency,
      uyu: expense.currency === 'UYU' ? -expense.amount : 0,
      usd: expense.currency === 'USD' ? -expense.amount : 0,
    });
  }

  for (const c of conversions) {
    const sameCur = c.fromCur === c.toCur;
    movements.push({
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
    });
  }

  movements.sort((a, b) => b.date.localeCompare(a.date));
  return movements;
}

export function balancesByPerson(
  movements: Movement[],
  conversions: ConversionRecord[],
  users: UserSummary[],
): Record<string, PersonBalance> {
  const result: Record<string, PersonBalance> = {};

  for (const u of users) {
    result[u.alias] = { uyu: 0, usd: 0, inUyu: 0, outUyu: 0, inUsd: 0, outUsd: 0 };
  }

  for (const m of movements) {
    if (m.kind === 'cambio') continue;
    const b = result[m.person];
    if (!b) continue;
    b.uyu += m.uyu;
    b.usd += m.usd;
    if (m.uyu > 0) b.inUyu += m.uyu;
    if (m.uyu < 0) b.outUyu += Math.abs(m.uyu);
    if (m.usd > 0) b.inUsd += m.usd;
    if (m.usd < 0) b.outUsd += Math.abs(m.usd);
  }

  for (const c of conversions) {
    const fAmt = c.fromAmount;
    const tAmt = c.toAmount;
    const fb = result[c.fromUserAlias];
    const tb = result[c.toUserAlias];
    if (fb) {
      if (c.fromCur === 'USD') { fb.usd -= fAmt; fb.outUsd += fAmt; }
      else { fb.uyu -= fAmt; fb.outUyu += fAmt; }
    }
    if (tb) {
      if (c.toCur === 'USD') { tb.usd += tAmt; tb.inUsd += tAmt; }
      else { tb.uyu += tAmt; tb.inUyu += tAmt; }
    }
  }

  return result;
}
