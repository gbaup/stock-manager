'use client';

import { MonthNav } from '@/components/ui/month-nav';
import { uyu, usd } from '@/app/lib/format';
import type { PersonFlows } from '@/app/lib/ledger/monthly-flows';

export function PersonFlowsSection({
  flows, unassignedUyu, monthOffset, onStepMonth,
}: {
  flows: PersonFlows[];
  unassignedUyu: number;
  monthOffset: number;
  onStepMonth: (delta: number) => void;
}) {
  return (
    <section className="flows-section">
      <div className="chart-card-head">
        <div>
          <div className="chart-title">Ingresos e inversión por persona</div>
          <div className="chart-sub">
            Flujo del mes, neto de transferencias entre socios · no sigue el rango de fechas de arriba
          </div>
        </div>
        <MonthNav offset={monthOffset} onStep={onStepMonth} browsingPast={monthOffset !== 0} />
      </div>

      <div className="flows-grid">
        {flows.map((f) => (
          <div key={f.alias} className="chart-card">
            <div className="flow-person capitalize">{f.alias}</div>
            <div className="flow-cols">
              <div className="flow-col">
                <div className="flow-label">Ingreso neto</div>
                <div className="flow-big">{uyu(f.ingresoUyu)}</div>
              </div>
              <div className="flow-col">
                <div className="flow-label">Inversión neta</div>
                <div className="flow-big">{usd(f.inversionUsd)}</div>
              </div>
            </div>
            {f.gastosMenoresUyu > 0 && (
              <div className="flow-note">
                Además, {uyu(f.gastosMenoresUyu)} en gastos menores.
              </div>
            )}
          </div>
        ))}
      </div>

      {unassignedUyu > 0 && (
        <div className="flow-note">
          Sin asignar: {uyu(unassignedUyu)} en ventas sin cobrador este mes.
        </div>
      )}
    </section>
  );
}
