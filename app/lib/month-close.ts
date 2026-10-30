import { timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma';
import { buildSaldos } from './ledger-queries';
import { fetchExchangeRate } from './exchange-rate';
import { money } from './money';

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. /api/cron skips the
// session cookie (see proxy.ts), so this is the only gate.
export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization');
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The business runs on Uruguay time; the cron fires in UTC.
function montevideoToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(now);
}

function isLastDayOfMonth(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() === d;
}

export type MonthCloseResult =
  | { status: 'skipped'; reason: 'not_last_day'; date: string }
  | { status: 'done'; date: string; rate: number; converted: { alias: string; uyu: number; usd: number }[] };

// Closes the month by swapping each partner's whole positive peso balance into
// their own dollars (a self-conversion, never cross-partner) at the BCU rate.
// Throws if BCU is down: nothing is recorded rather than using a guessed rate.
// Safe to re-run: after a close the peso balances are ~0, so a retry is a no-op.
export async function closeMonthToUsd(now = new Date()): Promise<MonthCloseResult> {
  const date = montevideoToday(now);
  if (!isLastDayOfMonth(date)) return { status: 'skipped', reason: 'not_last_day', date };

  const { compra: rate } = await fetchExchangeRate();

  return prisma.$transaction(async (tx) => {
    // Serialize overlapping runs: the second waits, then reads the first one's
    // committed conversions and finds nothing left to convert.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('month-close'))`;

    const { balances, users } = await buildSaldos();
    const converted: { alias: string; uyu: number; usd: number }[] = [];

    for (const u of users) {
      const uyu = Math.round((balances[u.alias]?.uyu ?? 0) * 100) / 100;
      const usd = money.toUsd(uyu, rate);
      // Negative pesos means the partner is owed, there's nothing to swap.
      if (usd <= 0) continue;

      await tx.conversion.create({
        data: {
          date: new Date(date),
          fromUserId: u.id,
          fromCur: 'UYU',
          toUserId: u.id,
          toCur: 'USD',
          fromAmount: uyu,
          rate,
          toAmount: usd,
          userId: null,
        },
      });
      converted.push({ alias: u.alias, uyu, usd });
    }

    return { status: 'done', date, rate, converted };
  }, { timeout: 20_000 }); // rebuilding every balance outlasts the 5s default
}
