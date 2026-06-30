'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar, BottomNav } from '@/components/ui/chrome';
import { Swatch } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Empty } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { fmtDate, usd, uyu } from '@/app/lib/format';
import type { BatchSummary, ShipmentRecord } from '@/app/lib/domain';

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
  // The "pending" tab now bundles both transit and partial — anything still
  // expecting more items to arrive.
  const list =
    tab === 'pending'
      ? sorted.filter((b) => b.status !== 'arrived')
      : sorted.filter((b) => b.status === 'arrived');
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
  const [open, setOpen] = useState(false);
  const uniqueProducts = Array.from(new Map(batch.items.map((i) => [i.catalogProductId, i.product])).values());
  const qty = batch.items.length;
  const single = uniqueProducts.length === 1 ? uniqueProducts[0] : null;
  const isArrived = batch.status === 'arrived';
  const isPartial = batch.status === 'partial';

  const title = single
    ? `${single.team} · ${single.version}`
    : `${uniqueProducts.length} modelos · ${qty} items`;

  const sub = single
    ? batch.supplier || batch.description || `${qty} ${qty === 1 ? 'unidad' : 'unidades'}`
    : batch.description || uniqueProducts.map((m) => m.team).join(', ');

  const tag =
    batch.status === 'transit' ? <Tag kind="transit">en camino</Tag> :
      batch.status === 'partial' ? <Tag kind="partial">parcial</Tag> :
        <Tag kind="ok">recibida</Tag>;

  const totalShippingUsd = batch.shipments.reduce((s, sh) => s + (sh.shippingPriceUsd ?? 0), 0);
  const arrivalDate = batch.arrivalDate;
  const arriveLabel = isPartial ? 'Llegó más' : 'Llegó';

  return (
    <div className={`purchase-card${isArrived ? '' : ' pending'}`}>
      <div className="pc-head">
        <div className="pc-swatches">
          {uniqueProducts.slice(0, 3).map((m, i) => (
            <Swatch key={m.id} color={m.color} number={m.number} className="pc-sw" style={{ zIndex: 3 - i }} />
          ))}
          {uniqueProducts.length > 3 && <span className="pc-more">+{uniqueProducts.length - 3}</span>}
        </div>
        <div className="pc-main">
          <div className="pc-team capitalize">{title}</div>
          <div className="pc-sub capitalize">{sub}</div>
        </div>
        {tag}
      </div>
      <div className="pc-foot">
        <div className="pc-stat">
          <div className="l">Items</div>
          <div className="v">{isPartial ? `${batch.arrivedQuantity}/${qty}` : `${qty} u.`}</div>
        </div>
        <div className="pc-stat">
          <div className="l">{isArrived ? 'Lslegó' : 'Pedido'}</div>
          <div className="v">{fmtDate(isArrived ? arrivalDate : batch.purchaseDate)}</div>
        </div>
        {!isArrived ? (
          <button className="btn btn-primary btn-sm" onClick={() => onArrive(batch.id)}>
            <Icon name="check" size={16} />{arriveLabel}
          </button>
        ) : (
          <div className="pc-stat" style={{ flex: 0, textAlign: 'right' }}>
            <div className="l">Envío</div>
            <div className="v">{totalShippingUsd > 0 ? usd(totalShippingUsd) : '—'}</div>
          </div>
        )}
      </div>

      {batch.shipments.length > 0 && (
        <>
          <button type="button" className="pc-ships-toggle" onClick={() => setOpen((o) => !o)}>
            <Icon
              name="chevR"
              size={14}
              style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
            />
            {batch.shipments.length} {batch.shipments.length === 1 ? 'envío' : 'envíos'}
          </button>
          {open && (
            <div className="ship-list">
              {batch.shipments.map((sh, i) => (
                <ShipmentRow key={sh.id} sh={sh} index={i + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ShipmentRow({ sh, index }: { sh: ShipmentRecord; index: number }) {
  const n = sh.itemIds.length;
  const meta = [
    sh.trackingNumber,
    sh.shippingPriceUsd && sh.shippingPriceUsd > 0 ? `envío ${usd(sh.shippingPriceUsd)}` : null,
    sh.shippingPaidByAlias ? `pagó ${sh.shippingPaidByAlias}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="ship-row">
      <span className="ship-n">#{index}</span>
      <div className="ship-main">
        <div className="ship-top">{fmtDate(sh.date)} · {n} {n === 1 ? 'item' : 'items'}</div>
        <div className="ship-meta">{meta || 'sin datos de envío'}</div>
      </div>
    </div>
  );
}
