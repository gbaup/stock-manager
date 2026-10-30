'use client';

import { useMemo, useState } from 'react';
import { TopBar, BottomNav, Sidebar } from '@/components/ui/chrome';
import { Empty } from '@/components/ui/empty';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { todayISO } from '@/app/lib/format';
import { SALE_STATUS } from '@/app/lib/domain';
import type { UserSummary } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';
import type { Movement } from '@/app/lib/ledger';
import { buildMonthlyFlows } from '@/app/lib/ledger/monthly-flows';
import { monthFromOffset } from '@/components/ui/month-nav';
import { PersonFlowsSection } from '@/components/screens/metrics/person-flows';
import { useIsDesktop } from '@/app/lib/hooks';
import {
  defaultFrom, monthKey, monthsBetween, activeInRange, methodBucket,
  buildTopModels, buildClubBreakdown, buildSizeBreakdown,
  buildCashflowSeries,
} from '@/components/screens/metrics/aggregations';
import type { SortKey } from '@/components/screens/metrics/aggregations';
import { SellerLineChart } from '@/components/screens/metrics/seller-line-chart';
import { CashflowChart } from '@/components/screens/metrics/cashflow-chart';
import { MarginChart } from '@/components/screens/metrics/margin-chart';
import { PaymentMethodChart } from '@/components/screens/metrics/payment-method-chart';
import { SizeBarChart } from '@/components/screens/metrics/size-bar-chart';
import { ClubBarChart } from '@/components/screens/metrics/club-bar-chart';
import { TopModelsTable } from '@/components/screens/metrics/top-models-table';

export function MetricsScreen({
  sales,
  users,
  transitCount,
  exchangeRate,
  movements,
}: {
  sales: HomeSaleItem[];
  users: UserSummary[];
  transitCount: number;
  exchangeRate: number;
  movements: Movement[];
}) {
  const isDesktop = useIsDesktop();
  const [range, setRange] = useState({ from: defaultFrom(), to: todayISO() });
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, negative = past
  const flowMonth = monthFromOffset(monthOffset).key;

  const personFlows = useMemo(
    () => buildMonthlyFlows(movements, flowMonth, users),
    [movements, flowMonth, users],
  );

  // The ledger drops sales with no collector, so surface them from the sales list.
  const unassignedUyu = useMemo(
    () => sales
      .filter((s) => s.status === SALE_STATUS.active && !s.collectedByUserId && monthKey(s.date) === flowMonth)
      .reduce((a, s) => a + s.price, 0),
    [sales, flowMonth],
  );

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

  const cashflowSeries = useMemo(
    () => buildCashflowSeries(activeSales, movements, months, range.from, range.to, exchangeRate),
    [activeSales, movements, months, range.from, range.to, exchangeRate],
  );

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
        <PersonFlowsSection
          flows={personFlows}
          unassignedUyu={unassignedUyu}
          monthOffset={monthOffset}
          onStepMonth={(delta) => setMonthOffset((o) => Math.min(0, o + delta))}
        />
        <div className="metrics-grid">
          <SellerLineChart
            monthlySeries={monthlySeries}
            users={users}
            hasUnassigned={hasUnassigned}
            hidden={hidden}
            onToggle={toggle}
          />
          <CashflowChart cashflowSeries={cashflowSeries} />
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
