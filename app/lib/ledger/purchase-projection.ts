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
  weight: number | null;
  itemIds: string[];
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

  // When more than one partner pays the supplier, each card shows that
  // partner's share of the combined payment so a split is visible at a glance.
  const paying = batch.supplierPayments.filter((p) => p.amountUsd > 0);
  const totalUsd = paying.reduce((s, p) => s + p.amountUsd, 0);
  const itemsLabel = `${batch.quantity} ${batch.quantity === 1 ? 'item' : 'items'}`;

  for (const p of paying) {
    const pct = Math.round((p.amountUsd / totalUsd) * 100);
    out.push({
      id: `pago-prov-${batch.id}-${p.userId}`,
      kind: 'pago-prov',
      date: batch.purchaseDate,
      person: p.alias,
      title: batch.supplier ?? 'Proveedor',
      sub: paying.length > 1 ? `${itemsLabel} · ${pct}%` : itemsLabel,
      uyu: 0,
      usd: -p.amountUsd,
    });
  }

  for (const sh of batch.shipments) {
    const shippingUsd = sh.shippingPriceUsd ?? 0;
    if (shippingUsd > 0 && sh.shippingPaidByUserId) {
      const n = sh.itemIds.length;
      const itemsLabel = `${n} ${n === 1 ? 'item' : 'items'}`;
      out.push({
        id: `pago-envio-${batch.id}-${sh.id}`,
        kind: 'pago-envio',
        date: sh.date,
        person: sh.shippingPaidByAlias ?? '',
        title: 'Envío',
        sub: sh.weight ? `${itemsLabel} · ${sh.weight} kg` : itemsLabel,
        // Shipping is paid in USD only. The UYU price (sh.shippingPriceUyu) is
        // a reference for sale-profit calculations, not a balance movement.
        uyu: 0,
        usd: -shippingUsd,
      });
    }
  }

  return out;
}
