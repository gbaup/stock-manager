'use client';

import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import type { TooltipValueType } from 'recharts';
import { Empty } from '@/components/ui/empty';

export function SizeBarChart({ sizeData }: { sizeData: { size: string; quantity: number }[] }) {
  return (
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
            <Tooltip
              formatter={(v: TooltipValueType | undefined) => `${Number(v)} unidades`}
              labelFormatter={(v: React.ReactNode) => String(v).toUpperCase()}
            />
            <Bar dataKey="quantity" name="Unidades" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
