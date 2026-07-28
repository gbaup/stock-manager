'use client';

import { Swatch, ColorDot } from '@/components/ui/swatch';
import { Empty } from '@/components/ui/empty';
import { uyu } from '@/app/lib/format';
import { fmtVersion } from '@/app/lib/domain';
import type { ModelAgg, SortKey } from './aggregations';

export function TopModelsTable({
  topModels, sortKey, onSortKeyChange,
}: {
  topModels: ModelAgg[];
  sortKey: SortKey;
  onSortKeyChange: (key: SortKey) => void;
}) {
  return (
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
              <th className="num" style={{ cursor: 'pointer' }} onClick={() => onSortKeyChange('quantity')}>
                Cantidad{sortKey === 'quantity' ? ' ▾' : ''}
              </th>
              <th className="num" style={{ cursor: 'pointer' }} onClick={() => onSortKeyChange('revenue')}>
                Monto{sortKey === 'revenue' ? ' ▾' : ''}
              </th>
              <th className="num" style={{ cursor: 'pointer' }} onClick={() => onSortKeyChange('profit')}>
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
  );
}
