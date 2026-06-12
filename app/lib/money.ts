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
