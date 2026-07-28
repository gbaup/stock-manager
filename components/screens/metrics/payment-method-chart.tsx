'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { TooltipValueType } from 'recharts';
import { Empty } from '@/components/ui/empty';
import { uyu } from '@/app/lib/format';
import { METHOD_COLORS } from './aggregations';

export function PaymentMethodChart({ methodData }: { methodData: { name: string; value: number }[] }) {
  const methodTotal = methodData.reduce((a, m) => a + m.value, 0);

  return (
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
  );
}
