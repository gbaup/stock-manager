'use client';

import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import type { TooltipValueType } from 'recharts';
import { Empty } from '@/components/ui/empty';
import { ChipToggle } from '@/components/ui/chip-toggle';
import { uyu } from '@/app/lib/format';
import type { UserSummary } from '@/app/lib/domain';
import { monthLabel, compactUyu, SELLER_PALETTE } from './aggregations';

export function SellerLineChart({
  monthlySeries, users, hasUnassigned, hidden, onToggle,
}: {
  monthlySeries: Record<string, number | string>[];
  users: UserSummary[];
  hasUnassigned: boolean;
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
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
          onClick={() => onToggle('total')}
        />
        {users.map((u, i) => (
          <ChipToggle
            key={u.id}
            active={!hidden.has(u.id)}
            color={SELLER_PALETTE[i % SELLER_PALETTE.length]}
            label={u.alias}
            onClick={() => onToggle(u.id)}
          />
        ))}
        {hasUnassigned && (
          <ChipToggle
            active={!hidden.has('unassigned')}
            color="var(--text-faint)"
            label="Sin asignar"
            onClick={() => onToggle('unassigned')}
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
  );
}
