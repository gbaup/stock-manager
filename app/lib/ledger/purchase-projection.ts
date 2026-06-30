import type { Movement } from './types';

// Structural shape of a batch that this projection needs. Any object that
// matches it works — BatchSummary (used by purchase listings) is a superset,
// and the saldos pipeline constructs an even leaner object straight from
// Prisma rows to avoid serializing photos/products it never reads.
export type ProjectableShipment = {
  id: string;
  date: string;
  shippingPriceUsd: number | null;
  shippingPriceUyu: number | null;
  shippingPaidByUserId: string | null;
  shippingPaidByAlias: string | null;
};

export type ProjectableBatch = {
  id: string;
  purchaseDate: string;
  arrivalDate: string | null;
  supplier: string | null;
  quantity: number;
  supplierPayments: Array<{ userId: string; alias: string; amountUsd: number }>;
  shipments: ProjectableShipment[];
};

// A batch produces:
//   1. ONE supplier-payment movement (USD outflow) PER partner who paid,
//      recorded on purchaseDate. The two amounts together cover the base cost.
//   2. ONE shipping-payment movement PER shipment that has a cost AND a
//      payer. With partial deliveries a single batch can yield several
//      shipping movements on different dates.
export function projectPurchase(batch: ProjectableBatch): Movement[] {
  const out: Movement[] = [];

  for (const p of batch.supplierPayments) {
    if (p.amountUsd > 0) {
      out.push({
        id: `pago-prov-${batch.id}-${p.userId}`,
        kind: 'pago-prov',
        date: batch.purchaseDate,
        person: p.alias,
        title: batch.supplier ?? 'Proveedor',
        sub: `${batch.quantity} ${batch.quantity === 1 ? 'item' : 'items'}`,
        uyu: 0,
        usd: -p.amountUsd,
      });
    }
  }

  for (const sh of batch.shipments) {
    const shippingUyu = sh.shippingPriceUyu ?? 0;
    const shippingUsd = sh.shippingPriceUsd ?? 0;
    if ((shippingUyu > 0 || shippingUsd > 0) && sh.shippingPaidByUserId) {
      out.push({
        id: `pago-envio-${batch.id}-${sh.id}`,
        kind: 'pago-envio',
        date: sh.date,
        person: sh.shippingPaidByAlias ?? '',
        title: 'Envío',
        sub: batch.supplier ?? `${batch.quantity} items`,
        uyu: shippingUyu > 0 ? -shippingUyu : 0,
        usd: shippingUsd > 0 ? -shippingUsd : 0,
      });
    }
  }

  return out;
}
