'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DetailHead, BottomNav, Sidebar } from '@/components/ui/chrome';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Empty } from '@/components/ui/empty';
import { ChevronUp, ChevronDown, Tag as TagIcon, Truck, Package } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { fmtDate, uyu, usd, signedUyu } from '@/app/lib/format';
import { fmtType, compareSizes, sizeStockOf } from '@/app/lib/domain';
import type { ModelDetail, TimelineEvent } from '@/app/lib/domain';

export function ModelDetailScreen({
  model,
  transitCount,
}: {
  model: ModelDetail;
  transitCount: number;
}) {
  const router = useRouter();
  const cover = coverOf(model);
  const [filter, setFilter] = useState<'Ventas' | 'Todos'>('Ventas');
  const [showSizes, setShowSizes] = useState(false);

  const events = filter === 'Ventas' ? model.events.filter((e) => e.type === 'sale') : model.events;

  const sizeStock = sizeStockOf(model);
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
            <div className="stat"><div className="v">{model.sold}</div><div className="l">Vendidas</div></div>
          </div>

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
                    return (
                      <div key={size} className={`stat${count > 0 ? ' ok' : ''}`}>
                        <div className="v" style={{ fontSize: '20px' }}>{count}</div>
                        <div className="l">{size.toUpperCase()}</div>
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
          </div>

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
  const shipUyu = b.shipments.reduce((s, sh) => s + (sh.shippingPriceUyu ?? 0), 0);
  const shipUsd = b.shipments.reduce((s, sh) => s + (sh.shippingPriceUsd ?? 0), 0);
  const meta = [b.supplier, `llegó ${fmtDate(b.arrivalDate)}`].filter(Boolean).join(' · ');
  return (
    <div className="event">
      <div className="event-ico buy"><Package size={17} strokeWidth={1.8} /></div>
      <div className="event-main">
        <div className="event-title">Recibida · {ev.qty} u.</div>
        <div className="event-sub">{meta}</div>
      </div>
      {shipUyu > 0 && (
        <div className="event-amt" style={{ color: 'var(--text-muted)' }}>
          envío {uyu(shipUyu)}
          {shipUsd > 0 && <span className="sec">{usd(shipUsd)}</span>}
        </div>
      )}
    </div>
  );
}
