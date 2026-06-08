import type { BatchSummary, ExpenseRecord } from './domain';
import { PEOPLE } from './domain';

export type MovementKind = 'cobro' | 'pago-prov' | 'pago-envio' | 'gasto';

export type Movement = {
  id: string;
  kind: MovementKind;
  date: string;
  person: string;
  title: string;
  sub: string;
  uyu: number;
  usd: number;
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
}: {
  sales: Array<{ id: string; date: string; price: number; collectedBy: string | null; quantity: number; model: string }>;
  purchases: BatchSummary[];
  expenses: ExpenseRecord[];
}): Movement[] {
  const movements: Movement[] = [];

  for (const sale of sales) {
    if (!sale.collectedBy) continue;
    movements.push({
      id: `cobro-${sale.id}`,
      kind: 'cobro',
      date: sale.date,
      person: sale.collectedBy,
      title: `Venta ×${sale.quantity}`,
      sub: sale.model,
      uyu: sale.price,
      usd: 0,
    });
  }

  for (const batch of purchases) {
    const baseUsd = batch.items.reduce((s, it) => s + it.basePriceUsd, 0);
    if (baseUsd > 0 && batch.supplierPaidBy) {
      movements.push({
        id: `pago-prov-${batch.id}`,
        kind: 'pago-prov',
        date: batch.purchaseDate,
        person: batch.supplierPaidBy,
        title: batch.supplier ?? 'Proveedor',
        sub: `${batch.quantity} ${batch.quantity === 1 ? 'item' : 'items'}`,
        uyu: 0,
        usd: -baseUsd,
      });
    }

    const shippingUyu = batch.shippingPriceUyu ?? 0;
    const shippingUsd = batch.shippingPriceUsd ?? 0;
    if ((shippingUyu > 0 || shippingUsd > 0) && batch.shippingPaidBy && batch.arrivalDate) {
      movements.push({
        id: `pago-envio-${batch.id}`,
        kind: 'pago-envio',
        date: batch.arrivalDate,
        person: batch.shippingPaidBy,
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
      person: expense.paidBy,
      title: expense.title,
      sub: expense.currency,
      uyu: expense.currency === 'UYU' ? -expense.amount : 0,
      usd: expense.currency === 'USD' ? -expense.amount : 0,
    });
  }

  movements.sort((a, b) => b.date.localeCompare(a.date));
  return movements;
}

export function balancesByPerson(movements: Movement[]): Record<string, PersonBalance> {
  const result: Record<string, PersonBalance> = {};

  for (const person of PEOPLE) {
    result[person] = { uyu: 0, usd: 0, inUyu: 0, outUyu: 0, inUsd: 0, outUsd: 0 };
  }

  for (const m of movements) {
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
