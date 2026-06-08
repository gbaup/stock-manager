import { uyu, usd, toUsd } from '@/app/lib/domain';

export function Money({
  uyuAmount,
  showUsd = true,
  className = '',
}: {
  uyuAmount: number;
  showUsd?: boolean;
  className?: string;
}) {
  return (
    <span className={className}>
      {uyu(uyuAmount)}
      {showUsd && <span className="money-sec"> · {usd(toUsd(uyuAmount))}</span>}
    </span>
  );
}
