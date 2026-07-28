'use client';

import { useMemo, useState } from 'react';
import { TopBar, BottomNav, Sidebar } from '@/components/ui/chrome';
import { Empty } from '@/components/ui/empty';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { todayISO } from '@/app/lib/format';
import type { UserSummary } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';
import { useIsDesktop } from '@/app/lib/hooks';
import {
  defaultFrom, monthKey, monthsBetween, activeInRange, methodBucket,
  buildTopModels, buildClubBreakdown, buildSizeBreakdown,
} from '@/components/screens/metrics/aggregations';
import type { SortKey } from '@/components/screens/metrics/aggregations';
import { SellerLineChart } from '@/components/screens/metrics/seller-line-chart';
import { MarginChart } from '@/components/screens/metrics/margin-chart';
import { PaymentMethodChart } from '@/components/screens/metrics/payment-method-chart';
import { SizeBarChart } from '@/components/screens/metrics/size-bar-chart';
import { ClubBarChart } from '@/components/screens/metrics/club-bar-chart';
import { TopModelsTable } from '@/components/screens/metrics/top-models-table';

export function MetricsScreen({
  sales,
  users,
  transitCount,
}: {
  sales: HomeSaleItem[];
  users: UserSummary[];
  transitCount: number;
}) {
  const isDesktop = useIsDesktop();
  const [range, setRange] = useState({ from: defaultFrom(), to: todayISO() });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('quantity');

  const activeSales = useMemo(
    () => activeInRange(sales, range.from, range.to),
    [sales, range.from, range.to],
  );

  const hasUnassigned = useMemo(
    () => activeSales.some((s) => !s.collectedByUserId),
    [activeSales],
  );

  const months = useMemo(() => monthsBetween(range.from, range.to), [range.from, range.to]);

  const monthlySeries = useMemo(() => months.map((key) => {
    const monthSales = activeSales.filter((s) => monthKey(s.date) === key);
    const row: Record<string, number | string> = {
      month: key,
      total: monthSales.reduce((a, s) => a + s.price, 0),
    };
    users.forEach((u) => {
      row[u.id] = monthSales.filter((s) => s.collectedByUserId === u.id).reduce((a, s) => a + s.price, 0);
    });
    if (hasUnassigned) {
      row.unassigned = monthSales.filter((s) => !s.collectedByUserId).reduce((a, s) => a + s.price, 0);
    }
    return row;
  }), [months, activeSales, users, hasUnassigned]);

  const marginSeries = useMemo(() => months.map((key) => {
    const monthSales = activeSales.filter((s) => monthKey(s.date) === key);
    const revenue = monthSales.reduce((a, s) => a + s.price, 0);
    const profit = monthSales.reduce((a, s) => a + s.profit, 0);
    return { month: key, marginPct: revenue > 0 ? (profit / revenue) * 100 : 0 };
  }), [months, activeSales]);

  const methodData = useMemo(() => {
    const buckets: Record<string, number> = { MercadoPago: 0, MercadoLibre: 0, Otros: 0 };
    activeSales.forEach((s) => { buckets[methodBucket(s.method)] += s.price; });
    return (['MercadoPago', 'MercadoLibre', 'Otros'] as const)
      .map((name) => ({ name, value: buckets[name] }))
      .filter((b) => b.value > 0);
  }, [activeSales]);

  const topModels = useMemo(
    () => buildTopModels(activeSales).sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 10),
    [activeSales, sortKey],
  );

  const clubData = useMemo(() => buildClubBreakdown(activeSales), [activeSales]);
  const sizeData = useMemo(() => buildSizeBreakdown(activeSales), [activeSales]);

  const toggle = (key: string) => setHidden((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (!isDesktop) {
    return (
      <div className="screen">
        <TopBar title="Métricas" />
        <div className="body">
          <div className="body-pad">
            <Empty
              icon="tag"
              title="Disponible solo en escritorio"
              desc="Abrí StockControl en una computadora para ver los gráficos del negocio."
            />
          </div>
        </div>
        <Sidebar transitCount={transitCount} />
        <BottomNav transitCount={transitCount} />
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="main-header">
        <div className="mh-left">
          <div className="mh-title">Métricas</div>
          <div className="mh-sub">{activeSales.length} ventas en el período</div>
        </div>
        <div className="mh-actions">
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      </header>

      <div className="page">
        <div className="metrics-grid">
          <SellerLineChart
            monthlySeries={monthlySeries}
            users={users}
            hasUnassigned={hasUnassigned}
            hidden={hidden}
            onToggle={toggle}
          />
          <MarginChart marginSeries={marginSeries} />
          <PaymentMethodChart methodData={methodData} />
          <SizeBarChart sizeData={sizeData} />
          <ClubBarChart clubData={clubData} />
          <TopModelsTable topModels={topModels} sortKey={sortKey} onSortKeyChange={setSortKey} />
        </div>
      </div>

      <Sidebar transitCount={transitCount} />
      <BottomNav transitCount={transitCount} />
    </div>
  );
}
