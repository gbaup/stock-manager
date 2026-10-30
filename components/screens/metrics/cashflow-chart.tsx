'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import type { TooltipValueType } from 'recharts';
import { Empty } from '@/components/ui/empty';
import { uyu } from '@/app/lib/format';
import { monthLabel, compactUyu } from './aggregations';
import type { CashflowPoint } from './aggregations';

export function CashflowChart({
  cashflowSeries,
}: {
  cashflowSeries: CashflowPoint[];
}) {
  const hasData = cashflowSeries.some((m) => m.income > 0 || m.purchases > 0 || m.expenses > 0);

  return (
    <div className="chart-card span-2">
      <div className="chart-card-head">
        <div className="chart-title">Ingresos vs. egresos</div>
        <div className="chart-sub">
          Lo que entró y salió cada mes, en pesos · dólares al cambio que hicieron ese mes (o al de hoy si no cambiaron)
        </div>
      </div>
      {!hasData ? (
        <Empty icon="tag" title="Sin datos" desc="No hay movimientos en el rango elegido." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={cashflowSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={compactUyu} tick={{ fontSize: 11 }} width={56} />
            <Tooltip
              labelFormatter={(v: React.ReactNode) => monthLabel(String(v))}
              formatter={(v: TooltipValueType | undefined) => uyu(Number(v))}
            />
            <Bar dataKey="income" name="Ingresos" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="purchases" name="Compras y envíos" stackId="out" fill="var(--danger)" />
            <Bar dataKey="expenses" name="Gastos" stackId="out" fill="var(--warn)" radius={[4, 4, 0, 0]} />
            <Line dataKey="net" name="Neto" stroke="var(--ok)" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
