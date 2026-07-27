'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import type { TooltipValueType } from 'recharts';
import { TopBar, BottomNav, Sidebar } from '@/components/ui/chrome';
import { Empty } from '@/components/ui/empty';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Swatch, ColorDot } from '@/components/ui/swatch';
import { uyu, todayISO } from '@/app/lib/format';
import { SALE_STATUS, fmtVersion, compareSizes } from '@/app/lib/domain';
import type { UserSummary } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';
import { useIsDesktop } from '@/app/lib/hooks';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`;
}

// Six months back from today, inclusive of the current month — the default
// window is wide enough to show a trend without listing years of history.
function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 5);
  return d.toISOString().slice(0, 10);
}

function monthsBetween(from: string, to: string): string[] {
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  const endKey = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}`;
  const months: string[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  while (months.length < 240) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    months.push(key);
    if (key === endKey) break;
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return months;
}

function compactUyu(n: number): string {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `$U ${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `$U ${Math.round(n)}`;
}

function inRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

function activeInRange(sales: HomeSaleItem[], from: string, to: string): HomeSaleItem[] {
  return sales.filter((s) => s.status === SALE_STATUS.active && inRange(s.date, from, to));
}

function methodBucket(method: string | null): 'MercadoPago' | 'MercadoLibre' | 'Otros' {
  const m = (method ?? '').trim().toLowerCase();
  if (m === 'mercadopago') return 'MercadoPago';
  if (m === 'mercadolibre') return 'MercadoLibre';
  return 'Otros';
}

const METHOD_COLORS: Record<string, string> = {
  MercadoPago: '#1d4fd7',
  MercadoLibre: '#f2c43d',
  Otros: '#94a3b8',
};

// A small fixed palette cycled across sellers — low cardinality in practice
// (a couple of partners), so a short list is enough.
const SELLER_PALETTE = ['#1d4fd7', '#1f9d57', '#e8702a', '#6b3fb5', '#da2332', '#4aa3e8'];

function modelLabel(s: HomeSaleItem): string {
  return [s.teamName, fmtVersion(s.version), s.number ? `#${s.number}` : null, s.player]
    .filter(Boolean)
    .join(' · ');
}

type ModelAgg = {
  id: string; team: string; color: string; version: string | null; number: string | null;
  label: string; quantity: number; revenue: number; profit: number;
};

function buildTopModels(sales: HomeSaleItem[]): ModelAgg[] {
  const map = new Map<string, ModelAgg>();
  sales.forEach((s) => {
    const cur = map.get(s.catalogProductId) ?? {
      id: s.catalogProductId, team: s.teamName, color: s.color, version: s.version,
      number: s.number, label: modelLabel(s), quantity: 0, revenue: 0, profit: 0,
    };
    cur.quantity += 1;
    cur.revenue += s.price;
    cur.profit += s.profit;
    map.set(s.catalogProductId, cur);
  });
  return [...map.values()];
}

function buildClubBreakdown(sales: HomeSaleItem[]): { team: string; revenue: number; profit: number }[] {
  const map = new Map<string, { team: string; revenue: number; profit: number }>();
  sales.forEach((s) => {
    const cur = map.get(s.teamName) ?? { team: s.teamName, revenue: 0, profit: 0 };
    cur.revenue += s.price;
    cur.profit += s.profit;
    map.set(s.teamName, cur);
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

function buildSizeBreakdown(sales: HomeSaleItem[]): { size: string; quantity: number }[] {
  const map = new Map<string, number>();
  sales.forEach((s) => map.set(s.size, (map.get(s.size) ?? 0) + 1));
  return [...map.entries()]
    .map(([size, quantity]) => ({ size, quantity }))
    .sort((a, b) => compareSizes(a.size, b.size));
}

type SortKey = 'quantity' | 'revenue' | 'profit';

function ChipToggle({
  active, color, label, onClick,
}: {
  active: boolean; color: string; label: string; onClick: () => void;
}) {
  return (
    <button type="button" className={`chip${active ? '' : ' is-off'}`} onClick={onClick}>
      <span className="chip-dot" style={{ background: color }} />
      {label}
    </button>
  );
}

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
  const methodTotal = methodData.reduce((a, m) => a + m.value, 0);

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
          <div className="chart-card span-2">
            <div className="chart-card-head">
              <div className="chart-title">Ventas por mes</div>
              <div className="chart-sub">Por vendedor</div>
            </div>
            <div className="chip-row">
              <ChipToggle
                active={!hidden.has('total')}
                color="var(--accent)"
                label="Total"
                onClick={() => toggle('total')}
              />
              {users.map((u, i) => (
                <ChipToggle
                  key={u.id}
                  active={!hidden.has(u.id)}
                  color={SELLER_PALETTE[i % SELLER_PALETTE.length]}
                  label={u.alias}
                  onClick={() => toggle(u.id)}
                />
              ))}
              {hasUnassigned && (
                <ChipToggle
                  active={!hidden.has('unassigned')}
                  color="var(--text-faint)"
                  label="Sin asignar"
                  onClick={() => toggle('unassigned')}
                />
              )}
            </div>
            {monthlySeries.length === 0 ? (
              <Empty icon="tag" title="Sin datos" desc="No hay ventas en el rango elegido." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={compactUyu} tick={{ fontSize: 11 }} width={56} />
                  <Tooltip
                    labelFormatter={(v: React.ReactNode) => monthLabel(String(v))}
                    formatter={(v: TooltipValueType | undefined) => uyu(Number(v))}
                  />
                  <Line
                    dataKey="total"
                    name="Total"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={false}
                    hide={hidden.has('total')}
                  />
                  {users.map((u, i) => (
                    <Line
                      key={u.id}
                      dataKey={u.id}
                      name={u.alias}
                      stroke={SELLER_PALETTE[i % SELLER_PALETTE.length]}
                      strokeWidth={2}
                      dot={false}
                      hide={hidden.has(u.id)}
                    />
                  ))}
                  {hasUnassigned && (
                    <Line
                      dataKey="unassigned"
                      name="Sin asignar"
                      stroke="var(--text-faint)"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                      hide={hidden.has('unassigned')}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="chart-card span-2">
            <div className="chart-card-head">
              <div className="chart-title">Margen de ganancia</div>
              <div className="chart-sub">Ganancia como % de lo vendido</div>
            </div>
            {marginSeries.length === 0 ? (
              <Empty icon="tag" title="Sin datos" desc="No hay ventas en el rango elegido." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={marginSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `${Math.round(v)}%`} tick={{ fontSize: 11 }} width={44} />
                  <Tooltip
                    labelFormatter={(v: React.ReactNode) => monthLabel(String(v))}
                    formatter={(v: TooltipValueType | undefined) => `${Number(v).toFixed(1)}%`}
                  />
                  <Line dataKey="marginPct" name="Margen" stroke="var(--ok)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="chart-card">
            <div className="chart-card-head">
              <div className="chart-title">Métodos de pago</div>
            </div>
            {methodData.length === 0 ? (
              <Empty icon="tag" title="Sin datos" desc="No hay ventas en el rango elegido." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2}>
                      {methodData.map((d) => (
                        <Cell key={d.name} fill={METHOD_COLORS[d.name]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: TooltipValueType | undefined) => uyu(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="legend-row">
                  {methodData.map((d) => (
                    <div key={d.name} className="legend-item">
                      <span className="chip-dot" style={{ background: METHOD_COLORS[d.name] }} />
                      {d.name}
                      <span className="amount">
                        {methodTotal > 0 ? Math.round((d.value / methodTotal) * 100) : 0}% · {uyu(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="chart-card">
            <div className="chart-card-head">
              <div className="chart-title">Ventas por talle</div>
            </div>
            {sizeData.length === 0 ? (
              <Empty icon="tag" title="Sin datos" desc="No hay ventas en el rango elegido." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sizeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                  <XAxis dataKey="size" tickFormatter={(v: string) => v.toUpperCase()} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip formatter={(v: TooltipValueType | undefined) => `${Number(v)} unidades`} labelFormatter={(v: React.ReactNode) => String(v).toUpperCase()} />
                  <Bar dataKey="quantity" name="Unidades" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="chart-card span-2">
            <div className="chart-card-head">
              <div className="chart-title">Ingresos y ganancia por club</div>
              <div className="chart-sub">Top 10 por monto vendido</div>
            </div>
            {clubData.length === 0 ? (
              <Empty icon="tag" title="Sin datos" desc="No hay ventas en el rango elegido." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, clubData.length * 34)}>
                <BarChart data={clubData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                  <XAxis type="number" tickFormatter={compactUyu} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="team" tick={{ fontSize: 12 }} width={110} className="capitalize" />
                  <Tooltip formatter={(v: TooltipValueType | undefined) => uyu(Number(v))} />
                  <Bar dataKey="revenue" name="Ingresos" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="profit" name="Ganancia" fill="var(--ok)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="chart-card span-2">
            <div className="chart-card-head">
              <div className="chart-title">Top modelos</div>
              <div className="chart-sub">Top 10 en el período</div>
            </div>
            {topModels.length === 0 ? (
              <Empty icon="tag" title="Sin datos" desc="No hay ventas en el rango elegido." />
            ) : (
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th
                      className="num"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSortKey('quantity')}
                    >
                      Cantidad{sortKey === 'quantity' ? ' ▾' : ''}
                    </th>
                    <th
                      className="num"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSortKey('revenue')}
                    >
                      Monto{sortKey === 'revenue' ? ' ▾' : ''}
                    </th>
                    <th
                      className="num"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSortKey('profit')}
                    >
                      Ganancia{sortKey === 'profit' ? ' ▾' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topModels.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="dt-cell-model">
                          <Swatch color={m.color} number={m.number} className="swatch" />
                          <div className="dt-cell-main">
                            <div className="dt-team capitalize">{m.team}</div>
                            <div className="dt-meta capitalize">
                              <ColorDot color={m.color} /> {fmtVersion(m.version)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="num">{m.quantity}</td>
                      <td className="num">{uyu(m.revenue)}</td>
                      <td className="num">{uyu(m.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Sidebar transitCount={transitCount} />
      <BottomNav transitCount={transitCount} />
    </div>
  );
}
