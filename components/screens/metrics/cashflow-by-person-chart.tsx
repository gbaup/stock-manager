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

export function CashflowByPersonChart({
  cashflowByPerson, users, hidden, onToggle,
}: {
  cashflowByPerson: Record<string, number | string>[];
  users: UserSummary[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  const hasData = cashflowByPerson.some((row) =>
    users.some((u) => Number(row[u.id] ?? 0) !== 0));

  return (
    <div className="chart-card span-2">
      <div className="chart-card-head">
        <div className="chart-title">Flujo de caja por persona</div>
        <div className="chart-sub">Neto (ingresos − gastos) por integrante</div>
      </div>
      <div className="chip-row">
        {users.map((u, i) => (
          <ChipToggle
            key={u.id}
            active={!hidden.has(u.id)}
            color={SELLER_PALETTE[i % SELLER_PALETTE.length]}
            label={u.alias}
            onClick={() => onToggle(u.id)}
          />
        ))}
      </div>
      {!hasData ? (
        <Empty icon="tag" title="Sin datos" desc="No hay movimientos en el rango elegido." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={cashflowByPerson}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={compactUyu} tick={{ fontSize: 11 }} width={56} />
            <Tooltip
              labelFormatter={(v: React.ReactNode) => monthLabel(String(v))}
              formatter={(v: TooltipValueType | undefined) => uyu(Number(v))}
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
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
