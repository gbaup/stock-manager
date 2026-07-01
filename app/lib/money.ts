export type Currency = 'UYU' | 'USD';

export const money = {
  toUsd(uyuAmount: number, rate: number): number {
    if (!uyuAmount || !rate) return 0;
    return Math.round((uyuAmount / rate) * 100) / 100;
  },

  toUyu(usdAmount: number, rate: number): number {
    if (!usdAmount || !rate) return 0;
    return Math.round(usdAmount * rate);
  },

  convert(amount: number, from: Currency, to: Currency, rate: number): number {
    if (!amount) return 0;
    if (from === to) return amount;
    return from === 'UYU' ? money.toUsd(amount, rate) : money.toUyu(amount, rate);
  },
};

// A shipment's price from a per-kg USD rate and a weight, plus its UYU snapshot
// at the given exchange rate. Returns nulls when there's nothing billable so
// callers store "no cost" cleanly instead of a zero.
export function computeShippingPrice(input: {
  rateUsd: number;
  weight: number;
  exchangeRate: number;
}): { usd: number | null; uyu: number | null } {
  const usd = input.rateUsd > 0 && input.weight > 0 ? input.rateUsd * input.weight : 0;
  if (usd <= 0) return { usd: null, uyu: null };
  return { usd, uyu: money.toUyu(usd, input.exchangeRate) };
}
