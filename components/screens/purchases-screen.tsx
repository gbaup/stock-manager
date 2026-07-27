'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar, BottomNav, Sidebar } from '@/components/ui/chrome';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Empty } from '@/components/ui/empty';
import { DModal } from '@/components/ui/d-modal';
import { Plus, Check, ChevronRight, Pencil } from 'lucide-react';
import { fmtDate, usd } from '@/app/lib/format';
import { useIsDesktop } from '@/app/lib/hooks';
import type { BatchSummary, ShipmentRecord, ModelWithStats, UserSummary } from '@/app/lib/domain';
import type { RateResult } from '@/app/lib/exchange-rate';
import { PurchaseForm } from '@/components/screens/purchase-form';
import { PurchaseEditForm } from '@/components/screens/purchase-edit-form';
import { ArrivalForm } from '@/components/screens/arrival-form';

export function PurchasesScreen({
  batches,
  transitCount,
  models,
  users,
  rate,
}: {
  batches: BatchSummary[];
  transitCount: number;
  models: ModelWithStats[];
  users: UserSummary[];
  rate: RateResult;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<'pending' | 'arrived'>('pending');
  const [buySel, setBuySel] = useState<string | null>(null);
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [showArrival, setShowArrival] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const sorted = [...batches].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  // The "pending" tab now bundles both transit and partial — anything still
  // expecting more items to arrive.
  const list =
    tab === 'pending'
      ? sorted.filter((b) => b.status !== 'arrived')
      : sorted.filter((b) => b.status === 'arrived');
  const arrivedCount = batches.filter((b) => b.status === 'arrived').length;

  // Same modal on desktop and mobile, mirroring the sale edit in home-screen.
  const editBatch = batches.find((b) => b.id === editId) ?? null;
  const editModal = editBatch && (
    <DModal title="Editar compra" size="lg" onClose={() => setEditId(null)}>
      <PurchaseEditForm
        batch={editBatch}
        models={models}
        users={users}
        rate={rate}
        onDone={() => setEditId(null)}
      />
    </DModal>
  );

  if (isDesktop) {
    const selBatch = batches.find((b) => b.id === buySel) ?? null;
    return (
      <div className="screen">
        <header className="main-header">
          <div className="mh-left">
            <div className="mh-title">Compras</div>
            <div className="mh-sub">{transitCount} en camino · {arrivedCount} recibidas</div>
          </div>
          <div className="mh-actions">
            <button className="btn btn-primary" onClick={() => setShowNewPurchase(true)}>
              Nueva compra
            </button>
          </div>
        </header>

        <div className="split split-purchases">
          <div className="split-list">
            <div className="split-list-tools">
              <div className="seg" style={{ marginTop: 0 }}>
                <button className={tab === 'pending' ? 'is-active' : ''} onClick={() => setTab('pending')}>
                  En camino ({transitCount})
                </button>
                <button className={tab === 'arrived' ? 'is-active' : ''} onClick={() => setTab('arrived')}>
                  Recibidas
                </button>
              </div>
            </div>
            <div className="split-scroll">
              {list.length === 0 ? (
                <Empty
                  icon="truck"
                  title={tab === 'pending' ? 'Nada en camino' : 'Sin compras recibidas'}
                  desc={tab === 'pending' ? 'Todas las compras llegaron.' : ''}
                />
              ) : (
                <BuyTable list={list} selected={buySel} onOpen={setBuySel} />
              )}
            </div>
          </div>

          <div className="split-detail">
            {selBatch ? (
              <BuyDetailPanel
                batch={selBatch}
                onArrive={() => setShowArrival(true)}
                onEdit={() => setEditId(selBatch.id)}
              />
            ) : (
              <div className="detail-empty">
                <div className="detail-empty-ico">📦</div>
                <div className="detail-empty-t">Elegí un pedido</div>
                <div className="detail-empty-s">Seleccioná una compra para ver sus detalles, items y envíos.</div>
              </div>
            )}
          </div>
        </div>

        {showNewPurchase && (
          <DModal title="Nueva compra" size="lg" onClose={() => setShowNewPurchase(false)}>
            <PurchaseForm models={models} users={users} rate={rate} onDone={() => setShowNewPurchase(false)} />
          </DModal>
        )}
        {showArrival && selBatch && (
          <DModal title="Marcar llegada" size="lg" onClose={() => setShowArrival(false)}>
            <ArrivalForm batch={selBatch} users={users} rate={rate} onDone={() => setShowArrival(false)} />
          </DModal>
        )}
        {editModal}

        <Sidebar transitCount={transitCount} />
        <BottomNav transitCount={transitCount} />
      </div>
    );
  }

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
                  onEdit={setEditId}
                />
              ))
            )}
          </div>
        </div>
      </div>
      <button className="fab" onClick={() => router.push('/purchases/new')} aria-label="Registrar compra">
        <Plus size={26} strokeWidth={2.2} />
      </button>
      {editModal}
      <Sidebar transitCount={transitCount} />
      <BottomNav transitCount={transitCount} />
    </div>
  );
}

function PurchaseCard({
  batch,
  onArrive,
  onEdit,
}: {
  batch: BatchSummary;
  onArrive: (id: string) => void;
  onEdit: (id: string) => void;
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
        <button
          className="iconbtn plain"
          style={{ width: 28, height: 28, flexShrink: 0 }}
          aria-label="Editar compra"
          onClick={() => onEdit(batch.id)}
        >
          <Pencil size={14} strokeWidth={1.8} />
        </button>
      </div>
      <div className="pc-foot">
        <div className="pc-stat">
          <div className="l">Items</div>
          <div className="v">{isPartial ? `${batch.arrivedQuantity}/${qty}` : `${qty} u.`}</div>
        </div>
        <div className="pc-stat">
          <div className="l">{isArrived ? 'Llegó' : 'Pedido'}</div>
          <div className="v">{fmtDate(isArrived ? arrivalDate : batch.purchaseDate)}</div>
        </div>
        {!isArrived ? (
          <button className="btn btn-primary btn-sm" onClick={() => onArrive(batch.id)}>
            <Check size={16} strokeWidth={1.8} />{arriveLabel}
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
            <ChevronRight size={14} strokeWidth={1.8} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
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

function BuyTable({
  list,
  selected,
  onOpen,
}: {
  list: BatchSummary[];
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <table className="dtable">
      <thead>
        <tr>
          <th>Pedido</th>
          <th className="num">Items</th>
          <th>Fecha</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {list.map((b) => {
          const uniqueProducts = Array.from(
            new Map(b.items.map((i) => [i.catalogProductId, i.product])).values()
          );
          const qty = b.items.length;
          const single = uniqueProducts.length === 1 ? uniqueProducts[0] : null;
          const isPartial = b.status === 'partial';
          const title = single
            ? `${single.team} · ${single.version}`
            : `${uniqueProducts.length} modelos`;
          const sub = single ? (b.supplier || b.description || '') : (b.description || '');
          const tag =
            b.status === 'transit' ? <Tag kind="transit">en camino</Tag> :
            b.status === 'partial' ? <Tag kind="partial">parcial</Tag> :
            <Tag kind="ok">recibida</Tag>;
          return (
            <tr
              key={b.id}
              className={selected === b.id ? 'is-selected' : ''}
              onClick={() => onOpen(b.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(b.id);
                }
              }}
            >
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="sw-stack">
                    {uniqueProducts.slice(0, 3).map((m, i) => (
                      <Swatch
                        key={m.id}
                        color={m.color}
                        number={m.number}
                        className="swatch"
                        style={{ zIndex: 3 - i }}
                      />
                    ))}
                    {uniqueProducts.length > 3 && (
                      <span className="sw-stack-more">+{uniqueProducts.length - 3}</span>
                    )}
                  </div>
                  <div className="dt-cell-main">
                    <div className="dt-team capitalize">{title}</div>
                    {sub && <div className="dt-meta capitalize">{sub}</div>}
                  </div>
                </div>
              </td>
              <td className="num">{isPartial ? `${b.arrivedQuantity ?? 0}/${qty}` : qty}</td>
              <td style={{ color: 'var(--text-faint)', fontSize: 13 }}>{fmtDate(b.purchaseDate)}</td>
              <td>{tag}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BuyDetailPanel({
  batch,
  onArrive,
  onEdit,
}: {
  batch: BatchSummary;
  onArrive: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const isArrived = batch.status === 'arrived';
  const isPartial = batch.status === 'partial';
  const qty = batch.items.length;
  const totalShipUsd = batch.shipments.reduce((s, sh) => s + (sh.shippingPriceUsd ?? 0), 0);
  const totalCostUsd = batch.items.reduce((s, i) => s + ((i as BatchSummary['items'][number] & { basePriceUsd?: number }).basePriceUsd ?? 0), 0);

  const tag =
    batch.status === 'transit' ? <Tag kind="transit">en camino</Tag> :
    batch.status === 'partial' ? <Tag kind="partial">parcial</Tag> :
    <Tag kind="ok">recibida</Tag>;

  const groupMap = new Map<string, { product: BatchSummary['items'][number]['product']; size: string; count: number; finalUsdTotal: number }>();
  batch.items.forEach((item) => {
    const key = `${item.catalogProductId}-${item.size}`;
    const existing = groupMap.get(key) ?? { product: item.product, size: item.size, count: 0, finalUsdTotal: 0 };
    existing.count++;
    // basePriceUsd is already gross (card surcharge baked in at purchase time, see app/lib/pricing.ts)
    existing.finalUsdTotal += item.basePriceUsd;
    groupMap.set(key, existing);
  });

  return (
    <>
      <div className="pd-head">
        <div>
          <div className="pd-title">Pedido {fmtDate(batch.purchaseDate)}</div>
          <div style={{ marginTop: 6 }}>{tag}</div>
          {batch.supplier && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Proveedor: <span className="capitalize">{batch.supplier}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            style={{ height: 34, fontSize: 13 }}
            onClick={() => onEdit(batch.id)}
          >
            <Pencil size={13} strokeWidth={2} />
            Editar
          </button>
          {!isArrived && (
            <button
              className="btn btn-primary"
              style={{ height: 34, fontSize: 13 }}
              onClick={() => onArrive(batch.id)}
            >
              <Check size={14} strokeWidth={2} />
              {isPartial ? 'Llegó más' : 'Marcar llegada'}
            </button>
          )}
        </div>
      </div>

      <div className="pd-body">
        <div className="pd-statgrid">
          <div className="d-stat">
            <div className="v">{isPartial ? `${batch.arrivedQuantity ?? 0}/${qty}` : qty}</div>
            <div className="l">Items</div>
          </div>
          <div className="d-stat">
            <div className="v" style={{ fontSize: 15 }}>{fmtDate(batch.purchaseDate)}</div>
            <div className="l">Pedido</div>
          </div>
          {totalCostUsd > 0 && (
            <div className="d-stat">
              <div className="v" style={{ fontSize: 16 }}>{usd(totalCostUsd)}</div>
              <div className="l">Costo base</div>
            </div>
          )}
        </div>

        <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
          Items del pedido
        </div>
        <table className="dtable" style={{ fontSize: 13, marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Detalle</th>
              <th className="num">Cant.</th>
              <th className="num">Costo final</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(groupMap.values())
              .sort((a, b) => a.product.team.localeCompare(b.product.team))
              .map((g, i) => (
              <tr key={i}>
                <td>
                  <div className="dt-cell-model">
                    <Swatch color={g.product.color} number={g.product.number} photo={coverOf(g.product)} className="swatch" />
                    <div className="dt-cell-main">
                      <div className="dt-team capitalize">{g.product.team}</div>
                      {g.product.season && <div className="dt-meta capitalize">{g.product.season}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="dt-meta capitalize">
                    <ColorDot color={g.product.color} />
                    {g.product.version ? ` ${g.product.version}` : ''}
                    {g.product.number ? ` · ${g.product.number}` : ''}{g.product.player ? ` ${g.product.player}` : ''}
                    {g.size ? ` · ${g.size.toUpperCase()}` : ''}
                  </div>
                </td>
                <td className="num">{g.count}</td>
                <td className="num">{usd(g.finalUsdTotal / g.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {batch.shipments.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Envíos ({batch.shipments.length})
              {totalShipUsd > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 500, textTransform: 'none' }}>
                  {usd(totalShipUsd)} total
                </span>
              )}
            </div>
            {batch.shipments.map((sh, i) => {
              const n = sh.itemIds.length;
              const meta = [
                sh.trackingNumber,
                sh.shippingPriceUsd && sh.shippingPriceUsd > 0 ? `envío ${usd(sh.shippingPriceUsd)}` : null,
                sh.shippingPaidByAlias ? `pagó ${sh.shippingPaidByAlias}` : null,
              ].filter(Boolean).join(' · ');
              return (
                <div key={sh.id} className="ship-card">
                  <div className="ship-card-head">
                    #{i + 1} · {fmtDate(sh.date)} · {n} {n === 1 ? 'item' : 'items'}
                  </div>
                  {meta && <div className="ship-card-meta">{meta}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
