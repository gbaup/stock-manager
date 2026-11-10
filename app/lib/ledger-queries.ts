import { cacheTag, cacheLife } from 'next/cache';
import { prisma } from './prisma';
import { CACHE_TAGS } from './cache-tags';
import { getActiveSalesForLedger } from './queries';
import type { ExpenseRecord, ConversionRecord, AdjustmentRecord, UserSummary } from './domain';
import {
  buildMovements,
  balancesByPerson,
  balanceTotals,
  settleBalances,
} from './ledger';
import type { Movement, PersonBalance, SettleTransfer, ProjectableBatch } from './ledger';

export type BuiltSaldos = {
  movements: Movement[];
  balances: Record<string, PersonBalance>;
  totals: { uyu: number; usd: number };
  settle: SettleTransfer[];
  users: UserSummary[];
};

function toISODate(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().split('T')[0];
}

function toExpenseRecord(e: {
  id: string; title: string; amount: unknown; currency: string;
  paidByUserId: string; paidByUser: { alias: string }; date: Date; createdAt: Date;
}): ExpenseRecord {
  return {
    id: e.id,
    title: e.title,
    amount: Number(e.amount),
    currency: e.currency as 'UYU' | 'USD',
    paidByUserId: e.paidByUserId,
    paidByAlias: e.paidByUser.alias,
    date: toISODate(e.date)!,
    createdAt: e.createdAt.toISOString(),
  };
}

function toConversionRecord(c: {
  id: string; date: Date; createdAt: Date;
  fromUserId: string; fromUser: { alias: string }; fromCur: string;
  toUserId: string; toUser: { alias: string }; toCur: string;
  fromAmount: unknown; rate: unknown; toAmount: unknown;
}): ConversionRecord {
  return {
    id: c.id,
    date: toISODate(c.date)!,
    createdAt: c.createdAt.toISOString(),
    fromUserId: c.fromUserId,
    fromUserAlias: c.fromUser.alias,
    fromCur: c.fromCur as 'UYU' | 'USD',
    toUserId: c.toUserId,
    toUserAlias: c.toUser.alias,
    toCur: c.toCur as 'UYU' | 'USD',
    fromAmount: Number(c.fromAmount),
    rate: Number(c.rate),
    toAmount: Number(c.toAmount),
  };
}

function toAdjustmentRecord(a: {
  id: string; userId: string; user: { alias: string };
  amountUyu: unknown; amountUsd: unknown; date: Date; createdAt: Date; note: string | null;
}): AdjustmentRecord {
  return {
    id: a.id,
    userId: a.userId,
    userAlias: a.user.alias,
    amountUyu: Number(a.amountUyu),
    amountUsd: Number(a.amountUsd),
    date: toISODate(a.date)!,
    createdAt: a.createdAt.toISOString(),
    note: a.note,
  };
}

// Fetches all ledger events, projects them into Movements, folds balances,
// and computes settle transfers. Tagged with saldos, purchases, and users so
// any of those invalidations clears the result.
export async function getBuiltSaldos(): Promise<BuiltSaldos> {
  'use cache';
  cacheLife('hours');
  cacheTag(CACHE_TAGS.saldos);
  cacheTag(CACHE_TAGS.purchases);
  cacheTag(CACHE_TAGS.users);

  return buildSaldos();
}

// Uncached read, for writers that act on the balances (the month-close cron)
// and can't risk a stale cache entry.
export async function buildSaldos(): Promise<BuiltSaldos> {
  const [batchRows, saleRows, expenses, convRows, adjRows, userRows] = await Promise.all([
    prisma.batch.findMany({
      select: {
        id: true,
        purchaseDate: true,
        createdAt: true,
        arrivalDate: true,
        supplier: true,
        supplierPayments: { select: { userId: true, amountUsd: true, cardTaxPct: true, user: { select: { alias: true } } } },
        _count: { select: { items: true } },
        shipments: {
          select: {
            id: true,
            date: true,
            createdAt: true,
            shippingPriceUsd: true,
            shippingPriceUyu: true,
            shippingPaidByUserId: true,
            shippingPaidByUser: { select: { alias: true } },
            weight: true,
            items: { select: { id: true } },
          },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { purchaseDate: 'desc' },
    }),
    getActiveSalesForLedger(),
    prisma.expense.findMany({ orderBy: { date: 'desc' }, include: { paidByUser: true } }),
    prisma.conversion.findMany({ orderBy: { date: 'desc' }, include: { fromUser: true, toUser: true } }),
    prisma.adjustment.findMany({ orderBy: { date: 'desc' }, include: { user: true } }),
    prisma.user.findMany({ select: { id: true, alias: true }, orderBy: { alias: 'asc' } }),
  ]);

  const purchases: ProjectableBatch[] = batchRows.map((b) => ({
    id: b.id,
    purchaseDate: toISODate(b.purchaseDate)!,
    createdAt: b.createdAt.toISOString(),
    arrivalDate: toISODate(b.arrivalDate),
    supplier: b.supplier,
    quantity: b._count.items,
    supplierPayments: b.supplierPayments.map((p) => ({
      userId: p.userId,
      alias: p.user.alias,
      amountUsd: Number(p.amountUsd),
      cardTaxPct: p.cardTaxPct != null ? Number(p.cardTaxPct) : null,
    })),
    shipments: b.shipments.map((s) => ({
      id: s.id,
      date: toISODate(s.date)!,
      createdAt: s.createdAt.toISOString(),
      shippingPriceUsd: s.shippingPriceUsd ? Number(s.shippingPriceUsd) : null,
      shippingPriceUyu: s.shippingPriceUyu ? Number(s.shippingPriceUyu) : null,
      shippingPaidByUserId: s.shippingPaidByUserId,
      shippingPaidByAlias: s.shippingPaidByUser?.alias ?? null,
      weight: s.weight ? Number(s.weight) : null,
      itemIds: s.items.map((i) => i.id),
    })),
  }));

  const users: UserSummary[] = userRows.map((u) => ({ id: u.id, alias: u.alias }));

  const sales = saleRows.map((s) => ({
    id: s.id,
    date: toISODate(s.date)!,
    createdAt: s.created_at.toISOString(),
    price: Number(s.price),
    collectedByUserId: s.collected_by_user_id,
    collectedByAlias: s.collected_by_alias,
    quantity: 1,
    model: s.team_name,
  }));

  const movements = buildMovements({
    sales,
    purchases,
    expenses: expenses.map(toExpenseRecord),
    conversions: convRows.map(toConversionRecord),
    adjustments: adjRows.map(toAdjustmentRecord),
  });

  const balances = balancesByPerson(movements, users);
  const totals = balanceTotals(balances, users);
  const settle = users.length === 2 ? settleBalances(balances, users) : [];

  return { movements, balances, totals, settle, users };
}
