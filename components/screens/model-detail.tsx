'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DetailHead, BottomNav, Sidebar } from '@/components/ui/chrome';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Empty } from '@/components/ui/empty';
import { DModal } from '@/components/ui/d-modal';
import { Modal } from '@/components/ui/modal';
import { ChevronUp, ChevronDown, Tag as TagIcon, Truck, Package, ShoppingCart, Bookmark } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { fmtDate, uyu, usd, signedUyu } from '@/app/lib/format';
import { fmtType, compareSizes, sizeStockOf, costBySizeOf } from '@/app/lib/domain';
import type { ModelDetail, TimelineEvent, UserSummary } from '@/app/lib/domain';
import { ReserveForm } from '@/components/screens/reserve-form';
import { ReservedSaleForm } from '@/components/screens/reserved-sale-form';
import { releaseReservation } from '@/app/actions/reservations';

export function ModelDetailScreen({
  model,
  transitCount,
  users,
}: {
  model: ModelDetail;
  transitCount: number;
  users: UserSummary[];
}) {
  const router = useRouter();
  const cover = coverOf(model);
  const [filter, setFilter] = useState<'Ventas' | 'Todos'>('Ventas');
  const [showSizes, setShowSizes] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [sellingItemId, setSellingItemId] = useState<string | null>(null);
  const [releasingItemId, setReleasingItemId] = useState<string | null>(null);
  const [releasePending, startReleaseTransition] = useTransition();
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const reservedBySizeMap = Object.fromEntries(model.reservedBySize.map((s) => [s.size, s.count]));
  const sellingItem = model.reservedItems.find((i) => i.id === sellingItemId) ?? null;

  function confirmRelease() {
    if (!releasingItemId) return;
    setReleaseError(null);
    startReleaseTransition(async () => {
      try {
        await releaseReservation(releasingItemId);
        setReleasingItemId(null);
        router.refresh();
      } catch (e) {
        setReleaseError(e instanceof Error ? e.message : 'Error al liberar la reserva');
      }
    });
  }

  const events = filter === 'Ventas' ? model.events.filter((e) => e.type === 'sale') : model.events;

  const sizeStock = sizeStockOf(model);
  const sizeCost = costBySizeOf(model);
  const usesAdultSizes = ['fan', 'player', 'retro'].includes(model.type ?? '');
  const displaySizes: string[] = usesAdultSizes
    ? (() => {
      const core = ['s', 'm', 'l', 'xl'];
      const extended = ['xs', '2xl', '3xl'].filter((s) => (sizeStock[s] ?? 0) > 0);
      return [...core, ...extended].sort(compareSizes);
    })()
    : model.availableBySize.map((s) => s.size).sort(compareSizes);

  return (
    <div className="screen">
      <DetailHead
        onBack={() => router.push('/inventory')}
        title={model.team}
        editHref={`/inventory/${model.id}/edit`}
      />
      <div className="body">
        <div className="body-pad">
          <div className="detail-hero">
            <Swatch
              color={model.color}
              number={model.number}
              photo={cover}
              style={{ width: 88, height: 100, fontSize: 34, borderRadius: 'var(--r-md)' }}
            />
            <div style={{ minWidth: 0 }}>
              <div className="detail-team capitalize">{model.team}</div>
              <div className="detail-meta capitalize">
                {model.season} · {model.version}
                {model.type ? ` · ${fmtType(model.type)}` : ''}
                {model.sleeve ? ` · manga ${model.sleeve.toLowerCase()}` : ''}
              </div>
              <div className="detail-tags capitalize">
                <Tag><ColorDot color={model.color} />{model.color}</Tag>
                {model.type && <Tag>{fmtType(model.type)}</Tag>}
                {model.sleeve && <Tag>Manga {model.sleeve}</Tag>}
                {model.player && <Tag kind="player">{model.player}</Tag>}
                {model.number && <Tag kind="player">#{model.number}</Tag>}
              </div>
            </div>
          </div>

          {model.description && (
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
              {model.description}
            </div>
          )}

          {model.photos.length > 1 && (
            <div className="detail-gallery">
              {model.photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p.url} alt="" />
              ))}
            </div>
          )}

          <div className="stat-row">
            <div className="stat ok"><div className="v">{model.stock}</div><div className="l">En stock</div></div>
            <div className="stat warn"><div className="v">{model.inTransit}</div><div className="l">En camino</div></div>
            <div className="stat"><div className="v">{model.reserved}</div><div className="l">Reservado</div></div>
            <div className="stat"><div className="v">{model.sold}</div><div className="l">Vendidas</div></div>
          </div>

          {model.stock > 0 && (
            <div className="stat-row">
              <div className="stat">
                <div className="v" style={{ fontSize: 20 }}>{uyu(model.stockCostUyu)}</div>
                <div className="money-sec" style={{ marginTop: 2 }}>{usd(model.stockCostUsd)}</div>
                <div className="l">Costo en stock</div>
              </div>
              <div className="stat">
                <div className="v" style={{ fontSize: 20 }}>{uyu(model.avgCostUyu)}</div>
                <div className="money-sec" style={{ marginTop: 2 }}>{usd(model.avgCostUsd)}</div>
                <div className="l">Costo promedio</div>
              </div>
            </div>
          )}

          {displaySizes.length > 0 && (
            <>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                onClick={() => setShowSizes((v) => !v)}
              >
                <div className="section-label">Stock por talle</div>
                {showSizes ? <ChevronUp size={14} strokeWidth={1.8} style={{ color: 'var(--text-faint)', marginTop: 13 }} /> : <ChevronDown size={14} strokeWidth={1.8} style={{ color: 'var(--text-faint)', marginTop: 13 }} />}
              </div>
              {showSizes && (
                <div className="stat-row" style={{ flexWrap: 'wrap' }}>
                  {displaySizes.map((size) => {
                    const count = sizeStock[size] ?? 0;
                    const avgCostUyu = sizeCost[size]?.avgCostUyu;
                    const reservedCount = reservedBySizeMap[size] ?? 0;
                    return (
                      <div key={size} className={`stat${count > 0 ? ' ok' : ''}`}>
                        <div className="v" style={{ fontSize: '20px' }}>{count}</div>
                        <div className="l">{size.toUpperCase()}</div>
                        {count > 0 && avgCostUyu !== undefined && (
                          <div className="money-sec" style={{ fontSize: 9, marginTop: 3 }}>{uyu(avgCostUyu)}</div>
                        )}
                        {reservedCount > 0 && (
                          <div className="money-sec" style={{ fontSize: 9, marginTop: 2, color: 'oklch(0.44 0.13 310)' }}>
                            {reservedCount} res.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="btn-row" style={{ marginTop: 18 }}>
            <button
              className="btn btn-primary"
              onClick={() => router.push(`/inventory/${model.id}/sale`)}
              disabled={model.stock === 0}
            >
              <TagIcon size={18} strokeWidth={1.8} />Registrar venta
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowReserveModal(true)}
              disabled={model.stock === 0}
            >
              <Bookmark size={18} strokeWidth={1.8} />Reservar
            </button>
          </div>

          {model.reservedItems.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 18 }}>Reservado</div>
              <div className="timeline">
                {model.reservedItems.map((item) => (
                  <div key={item.id} className="event">
                    <div className="event-ico reserved"><Bookmark size={17} strokeWidth={1.8} /></div>
                    <div className="event-main">
                      <div className="event-title">Talle {item.size.toUpperCase()}</div>
                      <div className="event-sub">
                        {item.note ? item.note : 'Sin nota'} · desde {fmtDate(item.reservedAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => setReleasingItemId(item.id)}>
                        Liberar
                      </button>
                      <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => setSellingItemId(item.id)}>
                        Vender
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, fontSize: 13, marginTop: 18, marginBottom: 10 }}>
            {model.revenue > 0 && (
              <div style={{ color: 'var(--text-muted)' }}>
                Ingresos:{' '}
                <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{uyu(model.revenue)}</strong>
              </div>
            )}

            {model.sold > 0 && (
              <div style={{ color: 'var(--text-muted)' }}>
                Ganancia:{' '}
                <strong style={{ color: model.profit >= 0 ? 'var(--ok)' : 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                  {uyu(model.profit)}
                </strong>
                {model.profitPending && <span className="money-sec"> · provisorio</span>}
              </div>
            )}
          </div>

          <div className="section-head">
            <div className="section-label">Movimientos</div>
            <Segmented options={['Ventas', 'Todos'] as const} value={filter} onChange={(v) => setFilter(v as 'Ventas' | 'Todos')} />
          </div>
          {events.length === 0 ? (
            <Empty
              icon="cart"
              title={filter === 'Ventas' ? 'Sin ventas' : 'Sin movimientos'}
              desc={filter === 'Ventas' ? 'Todavía no se vendió ninguna unidad.' : 'Registrá una compra para empezar.'}
            />
          ) : (
            <div className="timeline">
              {events.map((ev, i) => (
                <EventRow key={i} ev={ev} />
              ))}
            </div>
          )}
        </div>
      </div>
      <Sidebar transitCount={transitCount} />
      <BottomNav transitCount={transitCount} />

      {showReserveModal && (
        <DModal title="Reservar stock" size="md" onClose={() => setShowReserveModal(false)}>
          <ReserveForm
            model={model}
            onDone={() => { setShowReserveModal(false); router.refresh(); }}
          />
        </DModal>
      )}

      {sellingItem && (
        <DModal title="Registrar venta" size="md" onClose={() => setSellingItemId(null)}>
          <ReservedSaleForm
            model={model}
            item={sellingItem}
            users={users}
            onDone={() => { setSellingItemId(null); router.refresh(); }}
          />
        </DModal>
      )}

      {releasingItemId && (
        <Modal
          icon="check"
          title="¿Liberar esta reserva?"
          confirmLabel={releasePending ? 'Liberando…' : 'Liberar'}
          onCancel={() => { setReleasingItemId(null); setReleaseError(null); }}
          onConfirm={confirmRelease}
        >
          {releaseError ?? 'La unidad vuelve a stock disponible y deja de estar reservada.'}
        </Modal>
      )}
    </div>
  );
}

export function EventRow({ ev }: { ev: TimelineEvent }) {
  if (ev.type === 'sale') {
    const s = ev.data;
    return (
      <div className="event">
        <div className="event-ico sale"><TagIcon size={17} strokeWidth={1.8} /></div>
        <div className="event-main">
          <div className="event-title">
            Venta{s.quantity > 1 ? ` ×${s.quantity}` : ''}
            {s.size ? ` · Talle ${s.size.toUpperCase()}` : ''}
          </div>
          <div className="event-sub">
            {fmtDate(s.date)}
            {s.method ? ` · ${s.method}` : ''}
            {s.collectedByAlias ? ` · cobró ${s.collectedByAlias}` : ''}
            {s.description ? ` · ${s.description}` : ''}
          </div>
        </div>
        <div className="event-amt">
          {uyu(s.price)}
          <span className="sec" style={{ color: s.profit >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
            {signedUyu(s.profit)}
          </span>
        </div>
      </div>
    );
  }

  if (ev.type === 'purchase') {
    const b = ev.data;
    const meta = [b.supplier, `pedido ${fmtDate(b.purchaseDate)}`].filter(Boolean).join(' · ');
    return (
      <div className="event">
        <div className="event-ico purchase"><ShoppingCart size={17} strokeWidth={1.8} /></div>
        <div className="event-main">
          <div className="event-title">Compra · {ev.qty} u.</div>
          <div className="event-sub">{meta}</div>
        </div>
        {ev.priceUyuPerUnit > 0 && (
          <div className="event-amt" style={{ color: 'var(--text-muted)' }}>
            {uyu(ev.priceUyuPerUnit)} c/u
            {ev.priceUsdPerUnit > 0 && <span className="sec">{usd(ev.priceUsdPerUnit)} c/u</span>}
          </div>
        )}
      </div>
    );
  }

  if (ev.type === 'transit') {
    const b = ev.data;
    const meta = [b.supplier, `pedido ${fmtDate(b.purchaseDate)}`].filter(Boolean).join(' · ');
    return (
      <div className="event">
        <div className="event-ico transit"><Truck size={17} strokeWidth={1.8} /></div>
        <div className="event-main">
          <div className="event-title">En camino · {ev.qty} u.</div>
          <div className="event-sub">{meta}</div>
        </div>
      </div>
    );
  }

  const b = ev.data;
  const meta = [b.supplier, `llegó ${fmtDate(ev.date)}`].filter(Boolean).join(' · ');
  return (
    <div className="event">
      <div className="event-ico buy"><Package size={17} strokeWidth={1.8} /></div>
      <div className="event-main">
        <div className="event-title">Recibida · {ev.qty} u.</div>
        <div className="event-sub">{meta}</div>
      </div>
      {ev.shipUyuPerUnit > 0 && (
        <div className="event-amt" style={{ color: 'var(--text-muted)' }}>
          envío {uyu(ev.shipUyuPerUnit)} c/u
          {ev.shipUsdPerUnit > 0 && <span className="sec">{usd(ev.shipUsdPerUnit)} c/u</span>}
        </div>
      )}
    </div>
  );
}
