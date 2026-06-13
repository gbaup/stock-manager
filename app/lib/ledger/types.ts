// Kinds of events that produce movements in the saldos screen.
export type MovementKind = 'cobro' | 'pago-prov' | 'pago-envio' | 'gasto' | 'cambio' | 'ajuste';

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

export type SettleTransfer = {
  from: string;
  to: string;
  amount: number;
  currency: 'UYU' | 'USD';
};

export type SaleRow = {
  id: string;
  date: string;
  price: number;
  collectedByUserId: string | null;
  collectedByAlias: string | null;
  quantity: number;
  model: string;
};

export const emptyBalance = (): PersonBalance => ({
  uyu: 0, usd: 0, inUyu: 0, outUyu: 0, inUsd: 0, outUsd: 0,
});
