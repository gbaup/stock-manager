'use client';

import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import type { TooltipValueType } from 'recharts';
import { Empty } from '@/components/ui/empty';
import { monthLabel } from './aggregations';

export function MarginChart({ marginSeries }: { marginSeries: { month: string; marginPct: number }[] }) {
  return (
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
  );
}
