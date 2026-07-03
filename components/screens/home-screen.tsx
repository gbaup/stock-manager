'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Empty } from '@/components/ui/empty';
import { fmtDate, uyu, todayISO } from '@/app/lib/format';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';

const PAGE = 8;

type Range = 'hoy' | 'semana' | 'mes' | 'todas';

function inDateRange(iso: string, range: Range): boolean {
  if (!iso || range === 'todas') return true;
  const today = todayISO();
  if (range === 'hoy') return iso === today;
  if (range === 'mes') return iso.slice(0, 7) === today.slice(0, 7);
  if (range === 'semana') {
    const diff =
      (new Date(today + 'T00:00:00').getTime() - new Date(iso + 'T00:00:00').getTime()) /
      86400000;
    return diff >= 0 && diff < 7;
  }
  return true;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
];

function monthFromOffset(offset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // "YYYY-MM"
  const label = MONTHS[d.getMonth()];
  const showYear = d.getFullYear() !== now.getFullYear();
  return { key, label, year: d.getFullYear(), showYear };
}

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function HomeScreen({
  models,
  sales,
  users,
  sessionUserId,
}: {
  models: ModelWithStats[];
  sales: HomeSaleItem[];
  users: UserSummary[];
  sessionUserId: string;
}) {
  const router = useRouter();
  const currentUser = users.find((u) => u.id === sessionUserId) ?? users[0];

  return (
    <HomeContent
      models={models}
      sales={sales}
      users={users}
      currentUser={currentUser}
      onQuickSale={() => router.push('/home/sell')}
      onOpenModel={(id) => router.push(`/inventory/${id}`)}
    />
  );
}

function HomeContent({
  models,
  sales,
  users,
  currentUser,
  onQuickSale,
  onOpenModel,
}: {
  models: ModelWithStats[];
  sales: HomeSaleItem[];
  users: UserSummary[];
  currentUser: UserSummary;
  onQuickSale: () => void;
  onOpenModel: (id: string) => void;
}) {
  const [personFilter, setPersonFilter] = useState('all');
  const [range, setRange] = useState<Range>('mes');
  const [visible, setVisible] = useState(PAGE);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, negative = past

  const pickPerson = (id: string) => { setPersonFilter(id); setVisible(PAGE); };
  const pickRange = (r: Range) => { setRange(r); setVisible(PAGE); };
  const stepMonth = (delta: number) => {
    setMonthOffset((o) => Math.min(0, o + delta));
    setVisible(PAGE);
  };

  const sel = monthFromOffset(monthOffset);
  const browsingPast = monthOffset !== 0;

  // Membership in the selected month has a single definition — the sel.key
  // from monthFromOffset. The hero total always uses it; the list uses it for
  // the 'mes' range and when browsing past, deferring to inDateRange only for
  // the other (non-month) ranges.
  const inSelectedMonth = (iso: string) => iso.slice(0, 7) === sel.key;

  const monthSales = sales.filter((s) => inSelectedMonth(s.date));
  const monthTotal = monthSales.reduce((a, s) => a + s.price, 0);
  const monthProfit = monthSales.reduce((a, s) => a + s.profit, 0);
  const profitPending = monthSales.some((s) => s.profitPending);
  const byUser: Record<string, number> = {};
  users.forEach((u) => {
    byUser[u.id] = monthSales
      .filter((s) => s.collectedByUserId === u.id)
      .reduce((a, s) => a + s.price, 0);
  });

  const list = [...sales
    .filter((s) =>
      (personFilter === 'all' || s.collectedByUserId === personFilter) &&
      (browsingPast || range === 'mes' ? inSelectedMonth(s.date) : inDateRange(s.date, range))
    )]
    .sort((a, b) => b.date.localeCompare(a.date));

  const shown = list.slice(0, visible);
  const remaining = list.length - shown.length;

  const modelById = (id: string) => models.find((m) => m.id === id);

  const rangeOpts: { label: string; value: Range }[] = [
    { label: 'Hoy', value: 'hoy' },
    { label: 'Semana', value: 'semana' },
    { label: 'Mes', value: 'mes' },
    { label: 'Todas', value: 'todas' },
  ];

  return (
    <div className="screen">
      <header className="home-head">
        <div className="home-greet">
          <div className="topbar-eyebrow">
            <span className="brand-dot" />STOCKCONTROL
          </div>
          <h1 className="home-hi">Hola, {currentUser.alias}</h1>
        </div>
        <div className="home-avatar">
          <Avatar name={currentUser.alias} size={44} />
        </div>
      </header>

      <div className="body">
        <div className="body-pad">
          <div className="cobro-hero">
            <div className="ch-top">
              <div className="ch-nav">
                <button
                  type="button"
                  className="avatar"
                  style={{ width: 24, height: 24, fontSize: 12 }}
                  onClick={() => stepMonth(-1)}
                  aria-label="Mes anterior"
                >
                  <Icon name="chevL" size={12} />
                </button>
                <span className="ch-l">
                  Cobrado en {sel.label}{sel.showYear ? ` ${sel.year}` : ''}
                </span>
                <button
                  type="button"
                  className="avatar"
                  style={{ width: 24, height: 24, fontSize: 12, opacity: browsingPast ? 1 : 0.35, pointerEvents: browsingPast ? 'auto' : 'none' }}
                  onClick={() => stepMonth(1)}
                  disabled={!browsingPast}
                  aria-label="Mes siguiente"
                >
                  <Icon name="chevR" size={12} />
                </button>
              </div>
              <span className="ch-n">
                {monthSales.length} {monthSales.length === 1 ? 'venta' : 'ventas'}
              </span>
            </div>
            <div className="ch-amt">{uyu(monthTotal)}</div>
            <div
              className="ch-profit"
              style={{ color: monthProfit >= 0 ? 'var(--ok)' : 'var(--danger)' }}
            >
              <span className="ch-profit-a">
                {monthProfit >= 0 ? '+' : ''}{uyu(monthProfit)}
                {profitPending && <span className="money-sec"> · provisorio</span>}
              </span>
            </div>
            <div className="ch-split">
              {users.map((u) => (
                <div key={u.id} className="chs">
                  <Avatar name={u.alias} size={24} />
                  <div className="chs-tx">
                    <div className="chs-n">{u.id === currentUser.id ? 'Vos' : u.alias}</div>
                    <div className="chs-a">{uyu(byUser[u.id] ?? 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="quicksale-cta" onClick={onQuickSale}>
            <span className="qs-ico">
              <Icon name="tag" size={20} strokeWidth={2} />
            </span>
            <span className="qs-tx">
              <span className="qs-t">Registrar una venta</span>
              <span className="qs-s">Buscá la camiseta y cobrás en segundos</span>
            </span>
            <span className="qs-plus">
              <Icon name="plus" size={20} strokeWidth={2.4} />
            </span>
          </button>

          <div className="section-label" style={{ marginTop: 22 }}>Ventas</div>

          <div className="chips">
            <button
              className={`chip ${personFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => pickPerson('all')}
            >
              Todos
            </button>
            {users.map((u) => (
              <button
                key={u.id}
                className={`chip ${personFilter === u.id ? 'is-active' : ''}`}
                onClick={() => pickPerson(u.id)}
              >
                <Avatar name={u.alias} size={18} />
                {u.alias}
              </button>
            ))}
          </div>

          <div
            className="seg"
            style={{ marginTop: 9, opacity: browsingPast ? 0.4 : 1, pointerEvents: browsingPast ? 'none' : 'auto' }}
          >
            {rangeOpts.map((o) => (
              <button
                key={o.value}
                type="button"
                className={!browsingPast && range === o.value ? 'is-active' : ''}
                onClick={() => pickRange(o.value)}
                disabled={browsingPast}
              >
                {o.label}
              </button>
            ))}
          </div>

          {list.length > 0 && (
            <div className="sales-tally">
              <span>
                {remaining > 0
                  ? `Mostrando ${shown.length} de ${list.length}`
                  : `${list.length} ${list.length === 1 ? 'venta' : 'ventas'}${browsingPast
                    ? ` · ${sel.label}${sel.showYear ? ` ${sel.year}` : ''}`
                    : ''
                  }${personFilter !== 'all'
                    ? ` · ${users.find((u) => u.id === personFilter)?.alias ?? ''}`
                    : ''
                  }`}
              </span>
            </div>
          )}

          {list.length === 0 ? (
            <Empty
              title="Sin ventas"
              desc="Probá con otro filtro o registrá una venta nueva."
              icon="tag"
            />
          ) : (
            <div className="sales-list">
              {shown.map((s) => {
                const m = modelById(s.catalogProductId);
                return (
                  <div
                    key={s.id}
                    className="sale-row"
                    onClick={() => m && onOpenModel(m.id)}
                    style={{ cursor: m ? 'pointer' : 'default' }}
                  >
                    {m ? (
                      <Swatch
                        color={s.color}
                        number={s.number}
                        photo={coverOf(m)}
                        className="sale-sw"
                      />
                    ) : (
                      <div className="item-swatch-empty" style={{ width: 40, height: 46 }}>
                        <Icon name="shirt" size={18} />
                      </div>
                    )}
                    <div className="sale-main">
                      <div className="sale-team capitalize">{s.teamName}</div>
                      <div className="sale-meta capitalize">
                        <ColorDot color={s.color} />
                        {s.version ? ` ${s.version}` : ''}
                        {s.number ? ` · ${s.number}` : ''}{s.player ? ` ${s.player}` : ''}
                        {s.size ? ` · Talle ${s.size.toUpperCase()}` : ''}
                      </div>
                    </div>
                    <div className="sale-end">
                      <div className="sale-price">{uyu(s.price)}</div>
                      <div
                        className="sale-profit"
                        style={{ color: s.profit >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                      >
                        {s.profit >= 0 ? '+' : ''}{uyu(s.profit)}
                        {s.profitPending && <span className="money-sec"> · provisorio</span>}
                      </div>
                      <div className="sale-by">
                        {s.collectedByAlias && <Avatar name={s.collectedByAlias} size={18} />}
                        <span>{fmtDate(s.date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {remaining > 0 && (
            <button className="sales-more" onClick={() => setVisible((v) => v + PAGE)}>
              Ver más ventas
              <span className="sm-n">
                {remaining > PAGE ? `+${PAGE}` : `+${remaining}`} · quedan {remaining}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
