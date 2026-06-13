import type { Movement, SaleRow } from './types';

// A sale produces one 'cobro' movement attributed to whoever collected the
// money. Sales with no collector (legacy data, pre-required) currently drop
// out of the saldos view — this skip becomes unreachable once
// Sale.collectedByUserId is migrated to NOT NULL.
export function projectSale(sale: SaleRow): Movement[] {
  if (!sale.collectedByUserId) {
    console.warn(`[ledger] sale ${sale.id} skipped — no collectedByUserId. Run backfill-sale-collectors.ts.`);
    return [];
  }
  return [{
    id: `cobro-${sale.id}`,
    kind: 'cobro',
    date: sale.date,
    person: sale.collectedByAlias ?? '',
    title: `Venta ×${sale.quantity}`,
    sub: sale.model,
    uyu: sale.price,
    usd: 0,
  }];
}
