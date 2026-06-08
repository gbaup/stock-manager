'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar, BottomNav } from '@/components/ui/chrome';
import { Swatch } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Empty } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { fmtDate, uyu } from '@/app/lib/domain';
import type { BatchSummary } from '@/app/lib/domain';

export function PurchasesScreen({
  batches,
  transitCount,
}: {
  batches: BatchSummary[];
  transitCount: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'arrived'>('pending');

  const sorted = [...batches].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  const list = tab === 'pending' ? sorted.filter((b) => b.status === 'transit') : sorted.filter((b) => b.status === 'arrived');
  const arrivedCount = batches.filter((b) => b.status === 'arrived').length;

  return (
    <div className="screen">
      <TopBar
        eyebrow="STOCKCONTROL"
        title="Compras"
        sub={`${transitCount} en camino · ${arrivedCount} recibidas`}
      />
      <div className="body">
        <div className="body-pad">
          <div className="seg" style={{ marginTop: 4 }}>
            <button className={tab === 'pending' ? 'is-active' : ''} onClick={() => setTab('pending')}>
              En camino ({transitCount})
            </button>
            <button className={tab === 'arrived' ? 'is-active' : ''} onClick={() => setTab('arrived')}>
              Recibidas
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            {list.length === 0 ? (
              <Empty
                icon="truck"
                title={tab === 'pending' ? 'Nada en camino' : 'Sin compras recibidas'}
                desc={tab === 'pending' ? 'Todas las compras llegaron.' : ''}
              />
            ) : (
              list.map((b) => (
                <PurchaseCard
                  key={b.id}
                  batch={b}
                  onArrive={(id) => router.push(`/purchases/${id}/arrival`)}
                />
              ))
            )}
          </div>
        </div>
      </div>
      <button className="fab" onClick={() => router.push('/purchases/new')} aria-label="Registrar compra">
        <Icon name="plus" size={26} strokeWidth={2.2} />
      </button>
      <BottomNav transitCount={transitCount} />
    </div>
  );
}

function PurchaseCard({
  batch,
  onArrive,
}: {
  batch: BatchSummary;
  onArrive: (id: string) => void;
}) {
  const uniqueProducts = Array.from(new Map(batch.items.map((i) => [i.catalogProductId, i.product])).values());
  const qty = batch.items.length;
  const single = uniqueProducts.length === 1 ? uniqueProducts[0] : null;
  const isTransit = batch.status === 'transit';

  const title = single
    ? `${single.team} · ${single.version}`
    : `${uniqueProducts.length} modelos · ${qty} items`;

  const sub = single
    ? batch.supplier || batch.description || (batch.trackingNumber ? `Tracking ${batch.trackingNumber}` : `${qty} ${qty === 1 ? 'unidad' : 'unidades'}`)
    : batch.description || uniqueProducts.map((m) => m.team).join(', ');

  return (
    <div className={`purchase-card${isTransit ? ' pending' : ''}`}>
      <div className="pc-head">
        <div className="pc-swatches">
          {uniqueProducts.slice(0, 3).map((m, i) => (
            <Swatch key={m.id} color={m.color} number={m.number} className="pc-sw" style={{ zIndex: 3 - i }} />
          ))}
          {uniqueProducts.length > 3 && <span className="pc-more">+{uniqueProducts.length - 3}</span>}
        </div>
        <div className="pc-main">
          <div className="pc-team">{title}</div>
          <div className="pc-sub">{sub}</div>
        </div>
        {isTransit ? <Tag kind="transit">en camino</Tag> : <Tag kind="ok">recibida</Tag>}
      </div>
      <div className="pc-foot">
        <div className="pc-stat">
          <div className="l">Cantidad</div>
          <div className="v">{qty} u.</div>
        </div>
        <div className="pc-stat">
          <div className="l">{isTransit ? 'Pedido' : 'Llegó'}</div>
          <div className="v">{fmtDate(isTransit ? batch.purchaseDate : batch.arrivalDate)}</div>
        </div>
        {isTransit ? (
          <button className="btn btn-primary btn-sm" onClick={() => onArrive(batch.id)}>
            <Icon name="check" size={16} />Llegó
          </button>
        ) : (
          <div className="pc-stat" style={{ flex: 0, textAlign: 'right' }}>
            <div className="l">Envío</div>
            <div className="v">{batch.shippingPriceUyu && batch.shippingPriceUyu > 0 ? uyu(batch.shippingPriceUyu) : '—'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
