import { NextResponse } from 'next/server';
import { isCronAuthorized, closeMonthToUsd } from '@/app/lib/month-close';
import { invalidateSaldosFromRoute } from '@/app/lib/cache-tags';

// Scheduled in vercel.json at 02:55 UTC on the 1st = 23:55 of the month's last
// day in Uruguay (UTC-3, no DST).
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await closeMonthToUsd();
    if (result.status === 'done' && result.converted.length > 0) invalidateSaldosFromRoute();
    return NextResponse.json(result);
  } catch (e) {
    console.error('month-close: failed, nothing recorded', e);
    return NextResponse.json({ error: 'month_close_failed' }, { status: 503 });
  }
}
