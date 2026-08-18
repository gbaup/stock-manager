'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar, BottomNav, Sidebar } from '@/components/ui/chrome';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Empty } from '@/components/ui/empty';
import { DModal } from '@/components/ui/d-modal';
import { Package, List, LayoutGrid, Search, X, Plus, Shirt, Pencil, Tag as TagIcon, Truck, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';
import { colorByName, fmtDate, uyu, usd, signedUyu } from '@/app/lib/format';
import { fmtType, compareSizes, sizeStockOf } from '@/app/lib/domain';
import type { ModelWithStats, ModelDetail, TimelineEvent, UserSummary } from '@/app/lib/domain';
import { useIsDesktop } from '@/app/lib/hooks';
import { fetchModelDetail } from '@/app/actions/read';
import { ModelForm } from '@/components/screens/model-form';
import { SaleForm } from '@/components/screens/sale-form';

type Layout = 'cards' | 'rows' | 'grid';
type Filter = 'all' | 'instock' | 'transit' | 'out';

export function InventoryScreen({
  models,
  transitCount,
  teams,
  users,
  usdRate,
}: {
  models: ModelWithStats[];
  transitCount: number;
  teams: { id: string; name: string }[];
  users: UserSummary[];
  usdRate: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [layout, setLayout] = useState<Layout>('cards');
  const [invSel, setInvSel] = useState<string | null>(null);
  const [selDetail, setSelDetail] = useState<ModelDetail | null>(null);
  const [detailPending, startDetailTransition] = useTransition();
  const [showNewModel, setShowNewModel] = useState(false);
  const [showEditModel, setShowEditModel] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('inv-expanded-teams') ?? '[]'));
    } catch {
      return new Set();
    }
  });

  function toggleTeam(team: string) {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      localStorage.setItem('inv-expanded-teams', JSON.stringify([...next]));
      return next;
    });
  }

  const q = query.trim().toLowerCase();
  let list = models.filter((m) => {
    if (!q) return true;
    return [m.team, m.season, m.version, m.color, m.player, m.number, m.type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  if (filter === 'instock') list = list.filter((m) => m.stock > 0);
  else if (filter === 'out') list = list.filter((m) => m.stock === 0);
  else if (filter === 'transit') list = list.filter((m) => m.inTransit > 0);

  list = [...list].sort((a, b) => {
    if (a.stock > 0 !== b.stock > 0) return a.stock > 0 ? -1 : 1;
    return a.team.localeCompare(b.team);
  });

  const groupedList = [...list].sort((a, b) => {
    if (a.team !== b.team) return a.team.localeCompare(b.team);
    if (a.stock > 0 !== b.stock > 0) return a.stock > 0 ? -1 : 1;
    return a.season.localeCompare(b.season);
  });

  const counts = {
    all: models.length,
    instock: models.filter((m) => m.stock > 0).length,
    transit: models.filter((m) => m.inTransit > 0).length,
    out: models.filter((m) => m.stock === 0).length,
  };
  const totalUnits = models.reduce((s, m) => s + m.stock, 0);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'instock', label: 'En stock' },
    { id: 'transit', label: 'En camino' },
    { id: 'out', label: 'Sin stock' },
  ];

  function selectModel(id: string) {
    if (id === invSel) return;
    setInvSel(id);
    startDetailTransition(async () => {
      const detail = await fetchModelDetail(id);
      setSelDetail(detail);
    });
  }

  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isDesktop) return;
    const params = new URLSearchParams(window.location.search);
    const modelId = params.get('model');
    if (!modelId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    selectModel(modelId);
    params.delete('model');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `/inventory?${qs}` : '/inventory');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  if (isDesktop) {
    return (
      <div className="screen">
        <header className="main-header">
          <h1 className="mh-title">Inventario</h1>
          <span className="mh-sub">
            {models.length} modelos · {totalUnits} u. en stock
          </span>
          <div className="mh-actions">
            <button
              className={`iconbtn${layout === 'grid' ? '' : ' plain'}`}
              style={{ width: 32, height: 32 }}
              onClick={() => setLayout(layout === 'grid' ? 'cards' : 'grid')}
              title={layout === 'grid' ? 'Vista tabla' : 'Vista cuadrícula'}
            >
              {layout === 'grid'
                ? <List size={16} strokeWidth={1.8} />
                : <LayoutGrid size={16} strokeWidth={1.8} />
              }
            </button>
            <button className="btn btn-primary" onClick={() => setShowNewModel(true)}>
              Nuevo modelo
            </button>
          </div>
        </header>

        <div className="split split-inventory">
          <div className="split-list">
            <div className="split-list-tools">
              <div className="search" style={{ marginTop: 0 }}>
                <Search size={18} strokeWidth={1.8} />
                <input
                  value={query}
                  placeholder="Buscar equipo, jugador, color…"
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="iconbtn plain"
                    style={{ width: 26, height: 26 }}
                    onClick={() => setQuery('')}
                  >
                    <X size={16} strokeWidth={1.8} />
                  </button>
                )}
              </div>
              <div className="chips">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className={`chip${filter === f.id ? ' is-active' : ''}`}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                    <span className="count">{counts[f.id]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="split-scroll">
              {list.length === 0 ? (
                <Empty icon="search" title="Sin resultados" desc="Probá con otro filtro o búsqueda." />
              ) : layout === 'grid' ? (
                <VisualGrid list={list} onOpen={selectModel} selected={invSel} />
              ) : (
                <InvTable
                  list={groupedList}
                  onOpen={selectModel}
                  selected={invSel}
                  expandedTeams={expandedTeams}
                  onToggleTeam={toggleTeam}
                />
              )}
            </div>
          </div>

          <div className="split-detail">
            {invSel && selDetail ? (
              <ModelDetailPanel
                model={selDetail}
                loading={detailPending}
                onSell={() => setShowSaleModal(true)}
                onEdit={() => setShowEditModel(true)}
              />
            ) : (
              <DetailEmpty />
            )}
          </div>
        </div>

        {showNewModel && (
          <DModal title="Nuevo modelo" size="lg" onClose={() => setShowNewModel(false)}>
            <ModelForm teams={teams} onDone={() => setShowNewModel(false)} />
          </DModal>
        )}
        {showEditModel && selDetail && (
          <DModal title="Editar modelo" size="lg" onClose={() => setShowEditModel(false)}>
            <ModelForm initial={selDetail} teams={teams} onDone={() => setShowEditModel(false)} />
          </DModal>
        )}
        {showSaleModal && selDetail && (
          <DModal title="Registrar venta" size="md" onClose={() => setShowSaleModal(false)}>
            <SaleForm model={selDetail} stock={selDetail.stock} usdRate={usdRate} users={users} onDone={() => setShowSaleModal(false)} />
          </DModal>
        )}

        <Sidebar transitCount={transitCount} />
        <BottomNav transitCount={transitCount} />
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar
        eyebrow="STOCKCONTROL"
        title="Inventario"
        sub={`${models.length} modelos · ${totalUnits} unidades en stock`}
        right={
          <div style={{ display: 'flex', gap: 4 }}>
            {(['cards', 'rows', 'grid'] as Layout[]).map((l) => (
              <button
                key={l}
                className={`iconbtn${layout === l ? '' : ' plain'}`}
                style={{ width: 32, height: 32 }}
                onClick={() => setLayout(l)}
                title={l}
              >
                {l === 'cards' ? <Package size={16} strokeWidth={1.8} /> : l === 'rows' ? <List size={16} strokeWidth={1.8} /> : <LayoutGrid size={16} strokeWidth={1.8} />}
              </button>
            ))}
          </div>
        }
      />

      <div className="body">
        <div className="body-pad">
          <div className="search">
            <Search size={19} strokeWidth={1.8} />
            <input
              value={query}
              placeholder="Buscar equipo, jugador, color…"
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="iconbtn plain" style={{ width: 26, height: 26 }} onClick={() => setQuery('')}>
                <X size={16} strokeWidth={1.8} />
              </button>
            )}
          </div>

          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`chip${filter === f.id ? ' is-active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className="count">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <Empty icon="search" title="Sin resultados" desc="Probá con otro filtro o búsqueda." />
          ) : layout === 'rows' ? (
            <DenseRows list={list} onOpen={(id) => router.push(`/inventory/${id}`)} />
          ) : layout === 'grid' ? (
            <VisualGrid list={list} onOpen={(id) => router.push(`/inventory/${id}`)} />
          ) : (
            <CardList list={list} onOpen={(id) => router.push(`/inventory/${id}`)} />
          )}
        </div>
      </div>

      <button className="fab" onClick={() => router.push('/inventory/new')} aria-label="Agregar modelo">
        <Plus size={26} strokeWidth={2.2} />
      </button>
      <Sidebar transitCount={transitCount} />
      <BottomNav transitCount={transitCount} />
    </div>
  );
}

function CardList({ list, onOpen }: { list: ModelWithStats[]; onOpen: (id: string) => void }) {
  return (
    <div className="card-list">
      {list.map((m) => (
        <div key={m.id} className="mcard" onClick={() => onOpen(m.id)}>
          <Swatch color={m.color} number={m.number} photo={coverOf(m)} style={{ width: 56, height: 64, fontSize: 21 }} />
          <div className="mcard-main">
            <div className="mcard-team capitalize">{m.team}</div>
            <div className="mcard-meta">{m.season} · {m.version} · {m.type}</div>
            <div className="mcard-tags capitalize">
              <Tag><ColorDot color={m.color} />{m.color}</Tag>
              {m.player && <Tag kind="player" className="capitalize">{m.number} {m.player}</Tag>}
              {m.inTransit > 0 && <Tag kind="transit">+{m.inTransit} en camino</Tag>}
            </div>
          </div>
          <div className="mcard-stock">
            <div className="stock-num" style={{ color: m.stock === 0 ? 'var(--text-faint)' : 'var(--text)' }}>
              {m.stock}
            </div>
            <div className="stock-lbl">en stock</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DenseRows({ list, onOpen }: { list: ModelWithStats[]; onOpen: (id: string) => void }) {
  return (
    <div className="rows">
      <div className="rows-head">
        <span style={{ width: 30 }} />
        <span style={{ flex: 1 }}>Modelo</span>
        <span style={{ width: 34, textAlign: 'right' }}>Cam.</span>
        <span style={{ width: 26, textAlign: 'right' }}>Stk</span>
      </div>
      {list.map((m) => (
        <div key={m.id} className="row" onClick={() => onOpen(m.id)}>
          <Swatch color={m.color} number={m.number} photo={coverOf(m)} style={{ width: 30, height: 30, fontSize: 12 }} />
          <div className="row-main">
            <div className="row-team capitalize">{m.team} · {m.version}</div>
            <div className="row-meta capitalize">{m.season}{m.player ? ` · ${m.player}` : ''} · {m.color}</div>
          </div>
          <div className="row-transit">{m.inTransit > 0 ? `+${m.inTransit}` : ''}</div>
          <div className="row-stock" style={{ color: m.stock === 0 ? 'var(--text-faint)' : 'var(--text)' }}>
            {m.stock}
          </div>
        </div>
      ))}
    </div>
  );
}

function InvTable({
  list,
  onOpen,
  selected,
  expandedTeams,
  onToggleTeam,
}: {
  list: ModelWithStats[];
  onOpen: (id: string) => void;
  selected?: string | null;
  expandedTeams: Set<string>;
  onToggleTeam: (team: string) => void;
}) {
  const teamCounts = new Map<string, number>();
  list.forEach((m) => teamCounts.set(m.team, (teamCounts.get(m.team) ?? 0) + 1));

  const rows: ReactNode[] = [];
  let currentTeam: string | null = null;

  list.forEach((m) => {
    if (m.team !== currentTeam) {
      currentTeam = m.team;
      const collapsed = !expandedTeams.has(m.team);
      rows.push(
        <tr key={`group-${m.team}`} className="dtable-group" onClick={() => onToggleTeam(m.team)}>
          <td colSpan={4}>
            <div className="dtable-group-inner">
              <span className="dtable-group-chevron">
                {collapsed ? <ChevronRight size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
              </span>
              <span className="dtable-group-name capitalize">{m.team}</span>
              <span className="dtable-group-count">{teamCounts.get(m.team)}</span>
            </div>
          </td>
        </tr>
      );
    }

    if (!expandedTeams.has(m.team)) return;

    rows.push(
      <tr
        key={m.id}
        className={`${selected === m.id ? 'is-selected' : ''}${m.stock === 0 ? ' is-out' : ''}`}
        onClick={() => onOpen(m.id)}
      >
        <td>
          <div className="dt-cell-model">
            <Swatch
              color={m.color}
              number={m.number}
              photo={coverOf(m)}
              className="swatch"
            />
            <div className="dt-cell-main">
              <div className="dt-team capitalize">{m.team}</div>
              <div className="dt-meta capitalize">
                {m.version}
                {m.color ? ` · ${m.color}` : ''}
                {m.player ? ` · ${m.player}` : ''}
              </div>
            </div>
          </div>
        </td>
        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.season}</td>
        <td className="num">
          {m.inTransit > 0 ? (
            <span className="transit-pill">+{m.inTransit}</span>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>—</span>
          )}
        </td>
        <td className="num">
          <span className={`stock-pill${m.stock === 0 ? ' zero' : ''}`}>{m.stock}</span>
        </td>
      </tr>
    );
  });

  return (
    <table className="dtable">
      <thead>
        <tr>
          <th>Modelo</th>
          <th>Temporada</th>
          <th className="num">Camino</th>
          <th className="num">Stock</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

function DetailEmpty() {
  return (
    <div className="detail-empty">
      <div className="detail-empty-ico">
        <Package size={24} strokeWidth={1.5} />
      </div>
      <div className="detail-empty-t">Elegí un modelo</div>
      <div className="detail-empty-s">
        Seleccioná una camiseta de la lista para ver su stock, talles y movimientos.
      </div>
    </div>
  );
}

function ModelDetailPanel({
  model,
  loading,
  onSell,
  onEdit,
}: {
  model: ModelDetail;
  loading?: boolean;
  onSell: () => void;
  onEdit: () => void;
}) {
  const [evFilter, setEvFilter] = useState<'Ventas' | 'Todos'>('Ventas');
  const cover = coverOf(model);
  const events = evFilter === 'Ventas'
    ? model.events.filter((e) => e.type === 'sale')
    : model.events;

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
    <>
      <div className="d-hero" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <Swatch color={model.color} number={model.number} photo={cover} className="swatch" />
        <div className="d-hero-tx">
          <div className="d-hero-team capitalize">{model.team}</div>
          <div className="d-hero-meta capitalize">
            {model.season} · {model.version}
            {model.type ? ` · ${fmtType(model.type)}` : ''}
            {model.sleeve ? ` · manga ${model.sleeve.toLowerCase()}` : ''}
          </div>
          <div className="d-hero-tags">
            <Tag><ColorDot color={model.color} />{model.color}</Tag>
            {model.player && <Tag kind="player" className="capitalize">{model.player}</Tag>}
            {model.number && <Tag kind="player">#{model.number}</Tag>}
          </div>
        </div>
        <button className="d-hero-edit" onClick={onEdit} aria-label="Editar modelo">
          <Pencil size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="d-body">
        {model.description && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {model.description}
          </div>
        )}

        <div className="d-statgrid">
          <div className="d-stat ok">
            <div className="v">{model.stock}</div>
            <div className="l">En stock</div>
          </div>
          <div className="d-stat warn">
            <div className="v">{model.inTransit}</div>
            <div className="l">En camino</div>
          </div>
          <div className="d-stat">
            <div className="v">{model.sold}</div>
            <div className="l">Vendidas</div>
          </div>
        </div>

        <div className="d-actions">
          <button
            className="btn btn-primary"
            onClick={onSell}
            disabled={model.stock === 0}
            style={{ flex: 1 }}
          >
            <TagIcon size={16} strokeWidth={1.8} />Registrar venta
          </button>
        </div>

        {displaySizes.length > 0 && (
          <div>
            <div className="d-section-label" style={{ marginBottom: 8 }}>Stock por talle</div>
            <div className="d-sizes">
              {displaySizes.map((size) => {
                const count = sizeStock[size] ?? 0;
                return (
                  <div key={size} className="d-size-cell">
                    <span className="sz-l">{size.toUpperCase()}</span>
                    <span
                      className="sz-n"
                      style={{ color: count > 0 ? 'var(--text)' : 'var(--text-faint)' }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="d-section-head">
          <div className="d-section-label">Movimientos</div>
          <div className="mov-toggle">
            <button
              className={evFilter === 'Ventas' ? 'is-active' : ''}
              onClick={() => setEvFilter('Ventas')}
            >
              Ventas
            </button>
            <button
              className={evFilter === 'Todos' ? 'is-active' : ''}
              onClick={() => setEvFilter('Todos')}
            >
              Todos
            </button>
          </div>
        </div>

        {events.length === 0 ? (
          <Empty
            icon="cart"
            title={evFilter === 'Ventas' ? 'Sin ventas' : 'Sin movimientos'}
            desc={
              evFilter === 'Ventas'
                ? 'Todavía no se vendió ninguna unidad.'
                : 'Registrá una compra para empezar.'
            }
          />
        ) : (
          <div className="timeline">
            {events.map((ev, i) => (
              <PanelEventRow key={i} ev={ev} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PanelEventRow({ ev }: { ev: TimelineEvent }) {
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

function VisualGrid({ list, onOpen, selected }: { list: ModelWithStats[]; onOpen: (id: string) => void; selected?: string | null }) {
  return (
    <div className="grid">
      {list.map((m) => {
        const c = colorByName(m.color);
        const cover = coverOf(m);
        return (
          <div key={m.id} className={`tile${selected === m.id ? ' is-selected' : ''}`} onClick={() => onOpen(m.id)}>
            <div className="tile-top" style={{ background: c.bg, color: c.fg, overflow: 'hidden' }}>
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
                />
              )}
              <span className="tile-badge" style={{ zIndex: 2 }}>{m.stock} stk</span>
              {!cover && (
                m.number ? (
                  <span className="tile-num">{m.number}</span>
                ) : (
                  <Shirt size={42} strokeWidth={1.3} style={{ position: 'relative', zIndex: 1, opacity: 0.9 }} />
                )
              )}
            </div>
            <div className="tile-body">
              <div className="tile-team capitalize">{m.team}</div>
              <div className="tile-meta">{m.season} · {m.version}</div>
              {m.inTransit > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Tag kind="transit">+{m.inTransit} en camino</Tag>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
