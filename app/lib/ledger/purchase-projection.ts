import type { Movement } from './types';

// Structural shape of a batch that this projection needs. Any object that
// matches it works — BatchSummary (used by purchase listings) is a superset,
// and the saldos pipeline constructs an even leaner object straight from
// Prisma rows to avoid serializing photos/products it never reads.
export type ProjectableBatch = {
  id: string;
  purchaseDate: string;
  arrivalDate: string | null;
  supplier: string | null;
  quantity: number;
  shippingPriceUsd: number | null;
  shippingPriceUyu: number | null;
  supplierPaidByUserId: string | null;
  supplierPaidByAlias: string | null;
  shippingPaidByUserId: string | null;
  shippingPaidByAlias: string | null;
  items: Array<{ basePriceUsd: number }>;
};

// A batch produces up to two movements:
//   1. Supplier payment (USD outflow) attributed to whoever paid the supplier.
//      Recorded on purchaseDate, regardless of whether the batch has arrived.
//   2. Shipping payment (UYU and/or USD outflow) attributed to whoever paid
//      shipping. Recorded only once the batch has arrived (shipping isn't a
//      saldos event until the items physically land).
export function projectPurchase(batch: ProjectableBatch): Movement[] {
  const out: Movement[] = [];

  const baseUsd = batch.items.reduce((s, it) => s + it.basePriceUsd, 0);
  if (baseUsd > 0 && batch.supplierPaidByUserId) {
    out.push({
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
    out.push({
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

  return out;
}
