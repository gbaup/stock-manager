'use client';

import { useRouter } from 'next/navigation';
import { DetailHead, BottomNav } from '@/components/ui/chrome';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Empty } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { fmtDate, uyu, usd } from '@/app/lib/domain';
import { money } from '@/app/lib/money';
import type { ModelDetail, TimelineEvent } from '@/app/lib/domain';

export function ModelDetailScreen({
  model,
  transitCount,
  usdRate,
}: {
  model: ModelDetail;
  transitCount: number;
  usdRate: number;
}) {
  const router = useRouter();
  const cover = coverOf(model);

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
                {model.type ? ` · ${model.type}` : ''}
                {model.sleeve ? ` · manga ${model.sleeve.toLowerCase()}` : ''}
              </div>
              <div className="detail-tags capitalize">
                <Tag><ColorDot color={model.color} />{model.color}</Tag>
                {model.type && <Tag>{model.type}</Tag>}
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

          {model.revenue > 0 && (
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Ingresos:{' '}
              <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{uyu(model.revenue)}</strong>
              <span className="money-sec"> · {usd(money.toUsd(model.revenue, usdRate))}</span>
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 18 }}>
            <button className="btn btn-secondary" onClick={() => router.push(`/purchases/new?modelId=${model.id}`)}>
              <Icon name="truck" size={19} />Compra
            </button>
            <button
              className="btn btn-primary"
              onClick={() => router.push(`/inventory/${model.id}/sale`)}
              disabled={model.stock === 0}
            >
              <Icon name="tag" size={18} />Venta
            </button>
          </div>

          <div className="section-label">Movimientos</div>
          {model.events.length === 0 ? (
            <Empty icon="cart" title="Sin movimientos" desc="Registrá una compra para empezar." />
          ) : (
            <div className="timeline">
              {model.events.map((ev, i) => (
                <EventRow key={i} ev={ev} usdRate={usdRate} />
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav transitCount={transitCount} />
    </div>
  );
}

function EventRow({ ev, usdRate }: { ev: TimelineEvent; usdRate: number }) {
  if (ev.type === 'sale') {
    const s = ev.data;
    return (
      <div className="event">
        <div className="event-ico sale"><Icon name="tag" size={17} /></div>
        <div className="event-main">
          <div className="event-title">Venta{s.quantity > 1 ? ` ×${s.quantity}` : ''}</div>
          <div className="event-sub">
            {fmtDate(s.date)}
            {s.method ? ` · ${s.method}` : ''}
            {s.collectedByAlias ? ` · cobró ${s.collectedByAlias}` : ''}
            {s.description ? ` · ${s.description}` : ''}
          </div>
        </div>
        <div className="event-amt">
          +{uyu(s.price * s.quantity)}
          <span className="sec">{usd(money.toUsd(s.price * s.quantity, usdRate))}</span>
        </div>
      </div>
    );
  }

  if (ev.type === 'transit') {
    const b = ev.data;
    const meta = [b.supplier, `pedido ${fmtDate(b.purchaseDate)}`, b.trackingNumber].filter(Boolean).join(' · ');
    return (
      <div className="event">
        <div className="event-ico transit"><Icon name="truck" size={17} /></div>
        <div className="event-main">
          <div className="event-title">Compra en camino · {ev.qty} u.</div>
          <div className="event-sub">{meta}</div>
        </div>
      </div>
    );
  }

  const b = ev.data;
  const meta = [b.supplier, `llegó ${fmtDate(b.arrivalDate)}`, b.weight ? `${b.weight} kg` : null].filter(Boolean).join(' · ');
  return (
    <div className="event">
      <div className="event-ico buy"><Icon name="box" size={17} /></div>
      <div className="event-main">
        <div className="event-title">Compra recibida · {ev.qty} u.</div>
        <div className="event-sub">{meta}</div>
      </div>
      {b.shippingPriceUyu && b.shippingPriceUyu > 0 && (
        <div className="event-amt" style={{ color: 'var(--text-muted)' }}>
          envío {uyu(b.shippingPriceUyu)}
          {b.shippingPriceUsd && b.shippingPriceUsd > 0 && (
            <span className="sec">{usd(b.shippingPriceUsd)}</span>
          )}
        </div>
      )}
    </div>
  );
}
