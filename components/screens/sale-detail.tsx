'use client';

import { Shirt } from 'lucide-react';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Avatar } from '@/components/ui/avatar';
import { ModalFooter } from '@/components/ui/modal-footer';
import { fmtDate, uyu } from '@/app/lib/format';
import { SALE_STATUS } from '@/app/lib/domain';
import type { ModelWithStats } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';

// "home · 10 messi · M" — the unit's identity after the color dot. Shared by
// the sales table rows and the sale detail modal.
export function saleDetailLine(
  s: Pick<HomeSaleItem, 'version' | 'number' | 'player' | 'size'>,
  { sizeLabel = '' }: { sizeLabel?: string } = {},
): string {
  return [
    s.version ? ` ${s.version}` : '',
    s.number ? ` · ${s.number}` : '',
    s.player ? ` ${s.player}` : '',
    s.size ? ` · ${sizeLabel}${s.size.toUpperCase()}` : '',
  ].join('');
}

// Body + footer for a DModal showing one sale. "Ver modelo" is the primary
// action; editing reuses the existing sale edit modal via `onEdit`.
export function SaleDetail({
  sale,
  model,
  onEdit,
  onOpenModel,
  onClose,
}: {
  sale: HomeSaleItem;
  model: ModelWithStats | undefined;
  onEdit: () => void;
  onOpenModel: (id: string) => void;
  onClose: () => void;
}) {
  const cancelled = sale.status === SALE_STATUS.cancelled;

  return (
    <>
      <div className="dm-body">
        <div className="sd-head">
          {model ? (
            <Swatch color={sale.color} number={sale.number} photo={coverOf(model)} className="sd-swatch" />
          ) : (
            <div className="item-swatch-empty sd-swatch">
              <Shirt size={20} strokeWidth={1.8} />
            </div>
          )}
          <div className="sd-head-tx">
            <div className="sd-team capitalize">{sale.teamName}</div>
            <div className="sd-meta capitalize">
              <ColorDot color={sale.color} />
              {saleDetailLine(sale, { sizeLabel: 'Talle ' })}
            </div>
            {model?.season && <div className="sd-meta">{model.season}</div>}
          </div>
          <div className="sd-amt">
            <div
              className="sd-price"
              style={cancelled ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : undefined}
            >
              {uyu(sale.price)}
            </div>
            {cancelled ? (
              <Tag>anulada</Tag>
            ) : (
              <div className="sd-profit" style={{ color: sale.profit >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {sale.profit >= 0 ? '+' : ''}{uyu(sale.profit)}
                {sale.profitPending && <span style={{ opacity: 0.6 }}> · provisorio</span>}
              </div>
            )}
          </div>
        </div>

        <dl className="sd-list">
          <div className="sd-row">
            <dt>Fecha</dt>
            <dd>{fmtDate(sale.date)}</dd>
          </div>
          <div className="sd-row">
            <dt>Cobró</dt>
            <dd className="sd-who">
              {sale.collectedByAlias ? (
                <>
                  <Avatar name={sale.collectedByAlias} size={20} />
                  {sale.collectedByAlias}
                </>
              ) : '—'}
            </dd>
          </div>
          {sale.method && (
            <div className="sd-row">
              <dt>Método</dt>
              <dd className="capitalize">{sale.method}</dd>
            </div>
          )}
          {sale.description && (
            <div className="sd-row">
              <dt>Nota</dt>
              <dd>{sale.description}</dd>
            </div>
          )}
        </dl>
      </div>

      <ModalFooter
        pending={false}
        canSave={!!model}
        cancelLabel={cancelled ? 'Cerrar' : 'Editar venta'}
        onCancel={cancelled ? onClose : onEdit}
        onConfirm={() => model && onOpenModel(model.id)}
        confirmLabel="Ver modelo"
      />
    </>
  );
}
