// Card surcharge bake-in — the single owner of the rule that card surcharges
// ("recargo de tarjeta") are never stored as their own column: at purchase
// time they're folded proportionally into each item's stored basePriceUsd
// (making it a GROSS price), and the edit flow reverses them back out to
// recover the supplier's pre-tax prices. See CONTEXT.md "Card surcharge
// bake-in". Both directions and all rounding live here and nowhere else:
// stored gross prices keep 4 decimals (so the bake-in round-trips without
// drift); recovered pre-tax prices are cents, matching what the supplier
// charged.

export type SupplierPaymentLike = { amountUsd: number; cardTaxPct?: number | null };

// Applies a card surcharge percentage to a USD amount, returning the gross
// cost. pct is a whole-number percentage (5 means 5%); 0 or absent means
// the amount is returned unchanged.
export function applyCardTax(amountUsd: number, pct: number | null | undefined): number {
  return Math.round(amountUsd * (1 + (pct ?? 0) / 100) * 100) / 100;
}

// The bake-in ratio: gross cost (base + all card surcharges) over base cost.
// Because payments must reconcile to the base cost, the multiplier is exactly
// recoverable from the stored payment rows — that's what makes the bake-in
// reversible without a schema change.
function grossMultiplier(payments: SupplierPaymentLike[]): number {
  const paid = payments.filter((p) => p.amountUsd > 0);
  const baseTotal = paid.reduce((s, p) => s + p.amountUsd, 0);
  const totalCardTax = paid.reduce((s, p) => s + p.amountUsd * ((p.cardTaxPct ?? 0) / 100), 0);
  return totalCardTax > 0 && baseTotal > 0 ? (baseTotal + totalCardTax) / baseTotal : 1;
}

// Bakes the payments' card surcharges into each unit's PRE-TAX base price,
// returning the gross prices ready to store. Items with a higher base price
// bear a proportionally larger share of the surcharge. Throws when a
// surcharge exists but there is no base cost to spread it over.
export function bakeCardTaxIntoItems<T extends { basePriceUsd: number }>(
  items: T[],
  payments: SupplierPaymentLike[],
  baseTotal: number,
): T[] {
  const g = grossMultiplier(payments);
  if (g > 1 && baseTotal === 0) {
    throw new Error('No se puede aplicar recargo de tarjeta cuando el costo base es cero');
  }
  return items.map((it) => ({
    ...it,
    basePriceUsd: Math.round(it.basePriceUsd * g * 10000) / 10000,
  }));
}

export type UnbakedBatch<T> = {
  // The batch's items split by editability (shipped items are locked), each
  // annotated with its recovered pre-tax price.
  editable: Array<T & { preTaxPriceUsd: number }>;
  locked: Array<T & { preTaxPriceUsd: number }>;
  lockedPreTaxTotal: number;
  // The batch's implicit UYU/USD rate, derived from any item storing both
  // currencies. Null when no item carries a UYU price — callers fall back to
  // the live rate.
  impliedRate: number | null;
};

// Reverses the bake-in for a whole batch: given its stored (gross) items and
// payment rows, recovers the pre-tax view the edit flow works in.
export function unbakeBatch<
  T extends { basePriceUsd: number; basePriceUyu?: number | null; shipmentId: string | null },
>(items: T[], payments: SupplierPaymentLike[]): UnbakedBatch<T> {
  const g = grossMultiplier(payments);
  const editable: Array<T & { preTaxPriceUsd: number }> = [];
  const locked: Array<T & { preTaxPriceUsd: number }> = [];
  for (const it of items) {
    const annotated = { ...it, preTaxPriceUsd: Math.round((it.basePriceUsd / g) * 100) / 100 };
    (it.shipmentId === null ? editable : locked).push(annotated);
  }
  const lockedPreTaxTotal = locked.reduce((s, i) => s + i.preTaxPriceUsd, 0);
  const rateSource = items.find((i) => i.basePriceUyu != null && i.basePriceUyu > 0 && i.basePriceUsd > 0);
  const impliedRate = rateSource
    ? Math.round((rateSource.basePriceUyu! / rateSource.basePriceUsd) * 100) / 100
    : null;
  return { editable, locked, lockedPreTaxTotal, impliedRate };
}
