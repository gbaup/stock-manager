export const CACHE_TAGS = {
  users: 'users',
  teams: 'teams',
  models: 'models',
  purchases: 'purchases',
  saldos: 'saldos',
  exchangeRate: 'exchange-rate',
} as const;

export type CacheTag = typeof CACHE_TAGS[keyof typeof CACHE_TAGS];
