import { uyu, usd } from '@/app/lib/domain';
import { money } from '@/app/lib/money';

export function Money({
  uyuAmount,
  usdRate,
  showUsd = true,
  className = '',
}: {
  uyuAmount: number;
  usdRate: number;
  showUsd?: boolean;
  className?: string;
}) {
  return (
    <span className={className}>
      {uyu(uyuAmount)}
      {showUsd && <span className="money-sec"> · {usd(money.toUsd(uyuAmount, usdRate))}</span>}
    </span>
  );
}
