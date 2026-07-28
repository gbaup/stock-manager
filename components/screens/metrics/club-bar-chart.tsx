'use client';

import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import type { TooltipValueType } from 'recharts';
import { Empty } from '@/components/ui/empty';
import { uyu } from '@/app/lib/format';
import { compactUyu } from './aggregations';

export function ClubBarChart({ clubData }: { clubData: { team: string; revenue: number; profit: number }[] }) {
  return (
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
  );
}
