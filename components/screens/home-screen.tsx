'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Tag as TagIcon, Plus, Shirt, Pencil } from 'lucide-react';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Empty } from '@/components/ui/empty';
import { Tag } from '@/components/ui/tag';
import { DModal } from '@/components/ui/d-modal';
import { SaleEditForm } from '@/components/screens/sale-edit-form';
import { FixedPage } from '@/components/ui/fixed-page';
import { ScrollPanel } from '@/components/ui/scroll-panel';
import { fmtDate, uyu, todayISO } from '@/app/lib/format';
import { SALE_STATUS } from '@/app/lib/domain';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';
import { useIsDesktop } from '@/app/lib/hooks';
import { QuickSaleForm } from '@/components/screens/quick-sale-form';

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
  // UTC throughout: sale dates come from toISODate (d.toISOString()), so the
  // month key must be built on the same UTC basis or a sale near a month
  // boundary would bucket into the wrong month in UYU (UTC-3).
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; // "YYYY-MM"
  const label = MONTHS[d.getUTCMonth()];
  const showYear = d.getUTCFullYear() !== now.getUTCFullYear();
  return { key, label, year: d.getUTCFullYear(), showYear };
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

function MonthNav({
  offset,
  onStep,
  browsingPast,
}: {
  offset: number;
  onStep: (delta: number) => void;
  browsingPast: boolean;
}) {
  const { label, showYear, year } = monthFromOffset(offset);
  return (
    <div className="month-nav">
      <button className="month-nav-btn" onClick={() => onStep(-1)} aria-label="Mes anterior">
        <ChevronLeft size={14} strokeWidth={2} />
      </button>
      <span className="month-nav-label">
        {label}{showYear ? ` ${year}` : ''}
      </span>
      <button
        className="month-nav-btn"
        onClick={() => onStep(1)}
        disabled={!browsingPast}
        aria-label="Mes siguiente"
      >
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export function HomeScreen({
  models,
  sales,
  users,
  sessionUserId,
  usdRate,
}: {
  models: ModelWithStats[];
  sales: HomeSaleItem[];
  users: UserSummary[];
  sessionUserId: string;
  usdRate: number;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const currentUser = users.find((u) => u.id === sessionUserId) ?? users[0];
  const [showSaleModal, setShowSaleModal] = useState(false);

  if (isDesktop) {
    return (
      <>
        <HomeContent
          models={models}
          sales={sales}
          users={users}
          currentUser={currentUser}
          onQuickSale={() => setShowSaleModal(true)}
          // Desktop uses a one-time query param consumed by InventoryScreen's split view;
          // mobile (below) navigates to a dedicated /inventory/:id detail route instead.
          onOpenModel={(id) => router.push(`/inventory?model=${id}`)}
        />
        {showSaleModal && (
          <DModal title="Registrar venta" size="md" onClose={() => setShowSaleModal(false)}>
            <QuickSaleForm
              models={models}
              users={users}
              usdRate={usdRate}
              sessionUserId={sessionUserId}
              onDone={() => setShowSaleModal(false)}
            />
          </DModal>
        )}
      </>
    );
  }

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
  const [editingSale, setEditingSale] = useState<HomeSaleItem | null>(null);

  const pickPerson = (id: string) => { setPersonFilter(id); setVisible(PAGE); };
  const pickRange = (r: Range) => { setRange(r); setVisible(PAGE); };
  const stepMonth = (delta: number) => {
    setMonthOffset((o) => Math.min(0, o + delta));
    // Month navigation is inherently a whole-month view, and the range control
    // is disabled while browsing the past. Pin range to 'mes' so a previously
    // selected range (e.g. 'hoy') doesn't silently reactivate on return.
    setRange('mes');
    setVisible(PAGE);
  };

  const sel = monthFromOffset(monthOffset);
  const browsingPast = monthOffset !== 0;

  // Membership in the selected month has a single definition — the sel.key
  // from monthFromOffset. The hero total always uses it; the list uses it for
  // the 'mes' range and when browsing past, deferring to inDateRange only for
  // the other (non-month) ranges.
  const inSelectedMonth = (iso: string) => iso.slice(0, 7) === sel.key;

  // Cancelled sales stay visible in the list as history, but every aggregate
  // (totals, profit, per-partner split, avg ticket) counts active sales only.
  const activeSales = sales.filter((s) => s.status === SALE_STATUS.active);
  const monthSales = activeSales.filter((s) => inSelectedMonth(s.date));
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

  const totalStock = models.reduce((a, m) => a + m.stock, 0);
  const modelsWithStock = models.filter((m) => m.stock > 0).length;
  const transitUnits = models.reduce((a, m) => a + m.inTransit, 0);
  const avgTicket = monthSales.length > 0 ? monthTotal / monthSales.length : 0;

  const isDesktop = useIsDesktop();

  const editModal = editingSale && (
    <DModal title="Editar venta" size="md" onClose={() => setEditingSale(null)}>
      <SaleEditForm
        sale={editingSale}
        models={models}
        users={users}
        onDone={() => setEditingSale(null)}
      />
    </DModal>
  );

  if (isDesktop) {
    return (
      <div className="screen">
        <header className="main-header">
          <div className="mh-eyebrow">
            <span className="brand-dot" />STOCKCONTROL · PANEL
          </div>
          <h1 className="mh-title">Hola, {currentUser.alias}</h1>
          <div className="mh-actions">
            <MonthNav offset={monthOffset} onStep={stepMonth} browsingPast={browsingPast} />
            <button className="btn btn-primary" onClick={onQuickSale}>
              Registrar venta
            </button>
          </div>
        </header>

        <FixedPage>
          <div className="kpi-row shrink-0">
            <div className="kpi-card">
              <div className="kpi-label">Cobrado en {sel.label}{sel.showYear ? ` ${sel.year}` : ''}</div>
              <div className="kpi-value">{uyu(monthTotal)}</div>
              <div
                className="kpi-sub"
                style={{ color: monthProfit >= 0 ? 'var(--ok)' : 'var(--danger)' }}
              >
                {monthProfit >= 0 ? '+' : ''}{uyu(monthProfit)}
                {profitPending && <span style={{ opacity: 0.6 }}> · prov.</span>}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Ventas del mes</div>
              <div className="kpi-value neutral">{monthSales.length}</div>
              <div className="kpi-sub">
                Ticket prom. {avgTicket > 0 ? uyu(avgTicket) : '—'}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Stock disponible</div>
              <div className="kpi-value neutral">{totalStock}</div>
              <div className="kpi-sub">
                {modelsWithStock} {modelsWithStock === 1 ? 'modelo' : 'modelos'} con stock
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">En camino</div>
              <div className={`kpi-value${transitUnits > 0 ? ' warn' : ' neutral'}`}>
                {transitUnits}
              </div>
              <div className="kpi-sub">
                {transitUnits === 1 ? 'unidad en tránsito' : 'unidades en tránsito'}
              </div>
            </div>
          </div>

          <FixedPage.Fill className="grid-2">
            <ScrollPanel
              head={(
                <>
                  <div>
                    <div className="panel-title">
                      Ventas de {sel.label}{sel.showYear ? ` ${sel.year}` : ''}
                    </div>
                  </div>
                  <div className="panel-filter-chips">
                    <button
                      className={`chip${personFilter === 'all' ? ' is-active' : ''}`}
                      onClick={() => pickPerson('all')}
                    >
                      Todos
                    </button>
                    {users.map((u) => (
                      <button
                        key={u.id}
                        className={`chip${personFilter === u.id ? ' is-active' : ''}`}
                        onClick={() => pickPerson(u.id)}
                      >
                        <Avatar name={u.alias} size={16} />
                        {u.alias}
                      </button>
                    ))}
                  </div>
                </>
              )}
            >
              {list.length === 0 ? (
                <Empty title="Sin ventas" desc="Probá con otro filtro o navegá a otro mes." icon="tag" />
              ) : (
                <table className="dtable">
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th>Detalle</th>
                      <th>Cobró</th>
                      <th>Fecha</th>
                      <th className="num">Monto</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => {
                      const m = modelById(s.catalogProductId);
                      const cancelled = s.status === SALE_STATUS.cancelled;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => m && onOpenModel(m.id)}
                          style={{ cursor: m ? 'pointer' : 'default', opacity: cancelled ? 0.55 : 1 }}
                        >
                          <td>
                            <div className="dt-cell-model">
                              {m ? (
                                <Swatch
                                  color={s.color}
                                  number={s.number}
                                  photo={coverOf(m)}
                                  className="swatch"
                                />
                              ) : (
                                <div className="item-swatch-empty" style={{ width: 30, height: 34 }}>
                                  <Shirt size={14} strokeWidth={1.8} />
                                </div>
                              )}
                              <div className="dt-cell-main">
                                <div className="dt-team capitalize">{s.teamName}</div>
                                {m?.season && <div className="dt-meta capitalize">{m.season}</div>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="dt-meta capitalize">
                              <ColorDot color={s.color} />
                              {s.version ? ` ${s.version}` : ''}
                              {s.number ? ` · ${s.number}` : ''}{s.player ? ` ${s.player}` : ''}
                              {s.size ? ` · ${s.size.toUpperCase()}` : ''}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {s.collectedByAlias && (
                                <Avatar name={s.collectedByAlias} size={20} />
                              )}
                              <span style={{ fontSize: 13 }}>{s.collectedByAlias}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-faint)', fontSize: 13 }}>
                            {fmtDate(s.date)}
                          </td>
                          <td className="num">
                            <div style={{
                              color: cancelled ? 'var(--text-faint)' : 'var(--accent)',
                              textDecoration: cancelled ? 'line-through' : 'none',
                            }}>
                              {uyu(s.price)}
                            </div>
                            {cancelled ? (
                              <Tag>anulada</Tag>
                            ) : (
                              <div style={{
                                fontSize: 11,
                                color: s.profit >= 0 ? 'var(--ok)' : 'var(--danger)',
                                marginTop: 1,
                              }}>
                                {s.profit >= 0 ? '+' : ''}{uyu(s.profit)}
                                {s.profitPending && (
                                  <span style={{ opacity: 0.6 }}> · prov.</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ width: 36 }}>
                            {!cancelled && (
                              <button
                                className="iconbtn plain"
                                style={{ width: 28, height: 28 }}
                                aria-label="Editar venta"
                                onClick={(e) => { e.stopPropagation(); setEditingSale(s); }}
                              >
                                <Pencil size={14} strokeWidth={1.8} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </ScrollPanel>

            <div className="partner-rail scroll-y">
              <div className="panel-title" style={{ marginBottom: 4, paddingLeft: 2 }}>
                Cobrado por socio
              </div>
              {users.map((u) => {
                const amt = byUser[u.id] ?? 0;
                const pct = monthTotal > 0 ? (amt / monthTotal) * 100 : 0;
                return (
                  <div key={u.id} className="partner-rail-card">
                    <div className="pr-head">
                      <Avatar name={u.alias} size={32} />
                      <div className="pr-name">
                        {u.id === currentUser.id ? `${u.alias} · vos` : u.alias}
                      </div>
                    </div>
                    <div className="pr-amt">{uyu(amt)}</div>
                    <div className="pr-bar-wrap" style={{ marginTop: 10 }}>
                      <div className="pr-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <button className="sale-cta-card" onClick={onQuickSale}>
                <span className="sale-cta-t">Registrar una venta</span>
                <span className="sale-cta-s">Buscá la camiseta y cobrás en segundos</span>
              </button>
            </div>
          </FixedPage.Fill>
        </FixedPage>
        {editModal}
      </div>
    );
  }

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
                  <ChevronLeft size={12} strokeWidth={1.8} />
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
                  <ChevronRight size={12} strokeWidth={1.8} />
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
              <TagIcon size={20} strokeWidth={2} />
            </span>
            <span className="qs-tx">
              <span className="qs-t">Registrar una venta</span>
              <span className="qs-s">Buscá la camiseta y cobrás en segundos</span>
            </span>
            <span className="qs-plus">
              <Plus size={20} strokeWidth={2.4} />
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
                const cancelled = s.status === SALE_STATUS.cancelled;
                return (
                  <div
                    key={s.id}
                    className="sale-row"
                    onClick={() => m && onOpenModel(m.id)}
                    style={{ cursor: m ? 'pointer' : 'default', opacity: cancelled ? 0.55 : 1 }}
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
                        <Shirt size={18} strokeWidth={1.8} />
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
                      <div
                        className="sale-price"
                        style={cancelled ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : undefined}
                      >
                        {uyu(s.price)}
                      </div>
                      {cancelled ? (
                        <Tag>anulada</Tag>
                      ) : (
                        <div
                          className="sale-profit"
                          style={{ color: s.profit >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                        >
                          {s.profit >= 0 ? '+' : ''}{uyu(s.profit)}
                          {s.profitPending && <span className="money-sec"> · provisorio</span>}
                        </div>
                      )}
                      <div className="sale-by">
                        {s.collectedByAlias && <Avatar name={s.collectedByAlias} size={18} />}
                        <span>{fmtDate(s.date)}</span>
                      </div>
                    </div>
                    {!cancelled && (
                      <button
                        className="iconbtn plain"
                        style={{ width: 30, height: 30, alignSelf: 'center' }}
                        aria-label="Editar venta"
                        onClick={(e) => { e.stopPropagation(); setEditingSale(s); }}
                      >
                        <Pencil size={15} strokeWidth={1.8} />
                      </button>
                    )}
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
      {editModal}
    </div>
  );
}
