import { updateTag } from 'next/cache';

export const CACHE_TAGS = {
  users: 'users',
  teams: 'teams',
  models: 'models',
  purchases: 'purchases',
  saldos: 'saldos',
  exchangeRate: 'exchange-rate',
} as const;

export type CacheTag = typeof CACHE_TAGS[keyof typeof CACHE_TAGS];

export function invalidatePurchase() {
  updateTag(CACHE_TAGS.purchases);
  updateTag(CACHE_TAGS.models);
  updateTag(CACHE_TAGS.saldos);
}

export function invalidateSale() {
  updateTag(CACHE_TAGS.models);
  updateTag(CACHE_TAGS.saldos);
}

// A reservation only moves an item's status, no money — unlike invalidateSale,
// saldos isn't touched.
export function invalidateReservation() {
  updateTag(CACHE_TAGS.models);
}
