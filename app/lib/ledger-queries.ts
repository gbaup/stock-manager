import { cacheTag, cacheLife } from 'next/cache';
import { prisma } from './prisma';
import { CACHE_TAGS } from './cache-tags';
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
  paidByUserId: string; paidByUser: { alias: string }; date: Date;
}): ExpenseRecord {
  return {
    id: e.id,
    title: e.title,
    amount: Number(e.amount),
    currency: e.currency as 'UYU' | 'USD',
    paidByUserId: e.paidByUserId,
    paidByAlias: e.paidByUser.alias,
    date: toISODate(e.date)!,
  };
}

function toConversionRecord(c: {
  id: string; date: Date;
  fromUserId: string; fromUser: { alias: string }; fromCur: string;
  toUserId: string; toUser: { alias: string }; toCur: string;
  fromAmount: unknown; rate: unknown; toAmount: unknown;
}): ConversionRecord {
  return {
    id: c.id,
    date: toISODate(c.date)!,
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
  amountUyu: unknown; amountUsd: unknown; date: Date; note: string | null;
}): AdjustmentRecord {
  return {
    id: a.id,
    userId: a.userId,
    userAlias: a.user.alias,
    amountUyu: Number(a.amountUyu),
    amountUsd: Number(a.amountUsd),
    date: toISODate(a.date)!,
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

  const [batchRows, saleRows, expenses, convRows, adjRows, userRows] = await Promise.all([
    prisma.batch.findMany({
      select: {
        id: true,
        purchaseDate: true,
        arrivalDate: true,
        supplier: true,
        supplierPayments: { select: { userId: true, amountUsd: true, user: { select: { alias: true } } } },
        items: { select: { basePriceUsd: true } },
        shipments: {
          select: {
            id: true,
            date: true,
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
    prisma.sale.findMany({
      select: {
        id: true,
        price: true,
        date: true,
        collectedByUserId: true,
        collectedByUser: { select: { alias: true } },
        item: {
          select: {
            product: { select: { team: { select: { name: true } } } },
          },
        },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.expense.findMany({ orderBy: { date: 'desc' }, include: { paidByUser: true } }),
    prisma.conversion.findMany({ orderBy: { date: 'desc' }, include: { fromUser: true, toUser: true } }),
    prisma.adjustment.findMany({ orderBy: { date: 'desc' }, include: { user: true } }),
    prisma.user.findMany({ select: { id: true, alias: true }, orderBy: { alias: 'asc' } }),
  ]);

  const purchases: ProjectableBatch[] = batchRows.map((b) => ({
    id: b.id,
    purchaseDate: toISODate(b.purchaseDate)!,
    arrivalDate: toISODate(b.arrivalDate),
    supplier: b.supplier,
    quantity: b.items.length,
    supplierPayments: b.supplierPayments.map((p) => ({
      userId: p.userId,
      alias: p.user.alias,
      amountUsd: Number(p.amountUsd),
    })),
    shipments: b.shipments.map((s) => ({
      id: s.id,
      date: toISODate(s.date)!,
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
    price: Number(s.price),
    collectedByUserId: s.collectedByUserId,
    collectedByAlias: s.collectedByUser?.alias ?? null,
    quantity: 1,
    model: s.item.product.team.name,
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
