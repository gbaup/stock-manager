'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Eye, Search, X, LayoutGrid, List, Filter, Shirt } from 'lucide-react';
import { Empty } from '@/components/ui/empty';
import { WhatsAppButton } from '@/components/ui/whatsapp-button';
import { fmtSize, fmtType, fmtVersion, ITEM_TYPES, VERSIONS, SIZES, KID_SIZES } from '@/app/lib/domain';
import { catalogFilterOptions, modelMatchesFacets } from '@/app/lib/catalog-filters';
import { colorByName } from '@/app/lib/format';
import { useIsDesktop } from '@/app/lib/hooks';
import type { ModelMeta } from '@/app/lib/domain';

type PublicModel = ModelMeta & { stock: number };
type View = 'grid' | 'list';

const VIEW_KEY = 'sc_pub_view';

// URL params for the catalog filters, so a filtered view can be shared as a link
// (e.g. /public?type=kidkit&size=24,26).
const PARAM = { query: 'q', types: 'type', sizes: 'size', versions: 'version', sort: 'sort' } as const;
const VALID_SIZES: readonly string[] = [...SIZES, ...KID_SIZES];

function readListParam(params: URLSearchParams, key: string, allowed: readonly string[]): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return [...new Set(raw.split(',').map((v) => v.trim()))].filter((v) => allowed.includes(v));
}

function SizeChips({ sizes }: { sizes: string[] }) {
  if (!sizes.length) return null;
  return (
    <div className="size-chips uppercase">
      {sizes.map((s) => <span key={s} className="size-chip">{fmtSize(s)}</span>)}
    </div>
  );
}

// With SHOW_ALL_MODELS the catalog includes 0-stock models; don't promise those.
function AvailBadge({ stock, style }: { stock: number; style?: React.CSSProperties }) {
  return stock > 0 ? (
    <div className="avail-badge" style={style}><span className="avail-dot" />Disponible</div>
  ) : (
    <div className="avail-badge is-ask" style={style}><span className="avail-dot" />Consultar</div>
  );
}

// Cards and rows are clickable divs; make them reachable and openable by keyboard.
function openable(onOpen: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    },
  };
}

export function PublicScreen({
  models, today, loggedIn, whatsappNumber, whatsappMessage,
}: {
  models: PublicModel[];
  today: string;
  loggedIn: boolean;
  whatsappNumber?: string;
  whatsappMessage?: string;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'team' | 'newest'>('team');
  const [view, setView] = useState<View>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(VIEW_KEY) : null;
    return saved === 'list' || saved === 'grid' ? (saved as View) : 'grid';
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterSizes, setFilterSizes] = useState<string[]>([]);
  const [filterVersions, setFilterVersions] = useState<string[]>([]);
  const [viewer, setViewer] = useState<{ model: PublicModel; idx: number } | null>(null);

  // Filters <-> URL. The page is prerendered, so state can't be seeded from the
  // URL during render (hydration mismatch, and useSearchParams would bail the
  // Suspense fallback). Instead: read once on mount, then mirror every change
  // back with replaceState (no history spam). The write effect is declared
  // first on purpose — on mount it runs before the read and must not wipe the
  // incoming params with the still-empty initial state.
  const urlLoaded = useRef(false);

  useEffect(() => {
    if (!urlLoaded.current) return;
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string) => (value ? params.set(key, value) : params.delete(key));
    setOrDelete(PARAM.query, query.trim());
    setOrDelete(PARAM.types, filterTypes.join(','));
    setOrDelete(PARAM.sizes, filterSizes.join(','));
    setOrDelete(PARAM.versions, filterVersions.join(','));
    setOrDelete(PARAM.sort, sort === 'newest' ? 'newest' : '');
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [query, filterTypes, filterSizes, filterVersions, sort]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const types = readListParam(params, PARAM.types, ITEM_TYPES);
    const sizes = readListParam(params, PARAM.sizes, VALID_SIZES);
    const versions = readListParam(params, PARAM.versions, VERSIONS);
    /* eslint-disable react-hooks/set-state-in-effect */
    setQuery(params.get(PARAM.query) ?? '');
    setFilterTypes(types);
    setFilterSizes(sizes);
    setFilterVersions(versions);
    if (params.get(PARAM.sort) === 'newest') setSort('newest');
    // Mobile hides the filter panel behind a toggle; open it so the shared
    // link shows which filters are applied.
    if (types.length + sizes.length + versions.length > 0) setFiltersOpen(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    urlLoaded.current = true;
  }, []);

  function setViewPersisted(v: View) {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }

  const { types: allTypes, sizes: allSizes, versions: allVersions, activeSizes } =
    catalogFilterOptions(models, { types: filterTypes, sizes: filterSizes });

  const q = query.trim().toLowerCase();
  const activeFilters = filterTypes.length + activeSizes.length + filterVersions.length;

  let list = models.filter((m) => {
    if (q) {
      const haystack = [m.team, m.season, m.version, fmtVersion(m.version), m.color, m.player, m.number, m.type]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return modelMatchesFacets(m, { types: filterTypes, sizes: activeSizes, versions: filterVersions });
  });

  list = list.slice().sort((a, b) =>
    sort === 'team'
      ? a.team.localeCompare(b.team)
      : b.season.localeCompare(a.season)
  );

  function toggleFilter(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function clearFilters() {
    setFilterTypes([]);
    setFilterSizes([]);
    setFilterVersions([]);
  }


  const filterGroups = (
    <FilterGroups
      types={allTypes} sizes={allSizes} versions={allVersions}
      filterTypes={filterTypes} filterSizes={filterSizes} filterVersions={filterVersions}
      onToggleType={(t) => toggleFilter(filterTypes, setFilterTypes, t)}
      onToggleSize={(s) => toggleFilter(filterSizes, setFilterSizes, s)}
      onToggleVersion={(v) => toggleFilter(filterVersions, setFilterVersions, v)}
    />
  );

  if (isDesktop) {
    return (
      <div className="screen pub-desk">
        <header className="pub-desk-head">
          <div className="pub-desk-inner pub-desk-head-row">
            <div className="pub-desk-brand">
              <span className="pub-desk-logo"><Shirt size={20} strokeWidth={1.8} /></span>
              <div>
                <div className="pub-desk-name">RetroPilchas</div>
                <div className="pub-desk-tag">Camisetas de fútbol</div>
              </div>
            </div>
            <div className="search pub-desk-search">
              <Search size={19} strokeWidth={1.8} />
              <input value={query} placeholder="Buscar por equipo, temporada, jugador…" onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button className="iconbtn plain" style={{ width: 26, height: 26 }} aria-label="Limpiar búsqueda" onClick={() => setQuery('')}>
                  <X size={16} strokeWidth={1.8} />
                </button>
              )}
            </div>
            {loggedIn && (
              <button className="btn btn-secondary pub-desk-back" onClick={() => router.push('/inventory')}>
                <ChevronLeft size={16} strokeWidth={1.8} /> Volver
              </button>
            )}
          </div>
        </header>

        <div className="pub-desk-scroll">
          <div className="pub-desk-inner pub-desk-body">
            <aside className="pub-desk-side">
              <div className="pub-filter-group">
                <div className="pub-filter-label">Ordenar por</div>
                <div className="multi-chips">
                  {([{ id: 'team', label: 'Equipo' }, { id: 'newest', label: 'Más nuevas' }] as const).map(({ id, label }) => (
                    <button key={id} className={`mchip${sort === id ? ' is-active' : ''}`} onClick={() => setSort(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {filterGroups}
              {activeFilters > 0 && (
                <button className="pub-filter-clear" onClick={clearFilters}>
                  Limpiar filtros ({activeFilters})
                </button>
              )}
            </aside>

            <main className="pub-desk-main">
              <div className="pub-desk-title-row">
                <h1 className="pub-desk-title">Camisetas disponibles</h1>
                <div className="pub-desk-count">
                  {list.length} {list.length === 1 ? 'modelo' : 'modelos'}
                </div>
              </div>

              {list.length === 0 ? (
                <Empty icon="search" title="Sin resultados" desc={activeFilters > 0 ? 'Probá quitando algún filtro.' : 'Volvé a consultar más tarde.'} />
              ) : (
                <div className="pub-grid pub-desk-grid">
                  {list.map((m) => (
                    <PublicCard key={m.id} model={m} onOpen={() => setViewer({ model: m, idx: 0 })} />
                  ))}
                </div>
              )}

              <div className="pub-desk-foot">Stock actualizado al {today}</div>
            </main>
          </div>
        </div>

        {viewer && (
          <GalleryViewer models={list} startModel={viewer.model} startIdx={viewer.idx} onClose={() => setViewer(null)} />
        )}

        {whatsappNumber && <WhatsAppButton phone={whatsappNumber} message={whatsappMessage} />}
      </div>
    );
  }

  return (
    <div className="screen" style={{ background: 'var(--bg)' }}>
      <div className="form-head" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {loggedIn && (
          <button
            className="link"
            style={{ position: 'absolute', left: 0, display: 'flex', alignItems: 'center' }}
            onClick={() => router.push('/inventory')}
          >
            <ChevronLeft size={20} strokeWidth={1.8} /> Atrás
          </button>
        )}
        <div className="public-badge">
          <Eye size={14} strokeWidth={1.8} />
          Catálogo público
        </div>
      </div>
      <div className='public-head'>
        <div className="public-sub">{list.length} modelos disponibles</div>

        <div className="search" style={{ marginTop: 14 }}>
          <Search size={19} strokeWidth={1.8} />
          <input
            value={query}
            placeholder="Buscar camiseta…"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="iconbtn plain" style={{ width: 26, height: 26 }} aria-label="Limpiar búsqueda" onClick={() => setQuery('')}>
              <X size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      <div className="pub-bar">
        <div className="pub-sort">
          {([{ id: 'team', label: 'Equipo' }, { id: 'newest', label: 'Más nuevas' }] as const).map(({ id, label }) => (
            <button
              key={id}
              className={`chip${sort === id ? ' is-active' : ''}`}
              style={{ height: 30, fontSize: 13 }}
              onClick={() => setSort(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="view-toggle">
          <button className={`view-btn${view === 'grid' ? ' is-active' : ''}`} aria-label="Vista en cuadrícula" aria-pressed={view === 'grid'} onClick={() => setViewPersisted('grid')}>
            <LayoutGrid size={16} strokeWidth={1.8} />
          </button>
          <button className={`view-btn${view === 'list' ? ' is-active' : ''}`} aria-label="Vista en lista" aria-pressed={view === 'list'} onClick={() => setViewPersisted('list')}>
            <List size={16} strokeWidth={1.8} />
          </button>
        </div>
        <button
          className={`pub-filter-btn${activeFilters > 0 ? ' has-filters' : ''}`}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <Filter size={15} strokeWidth={1.8} />
          Filtrar
          {activeFilters > 0 && <span className="filter-count-badge">{activeFilters}</span>}
        </button>
      </div>

      {filtersOpen && (
        <div className="pub-filters">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Filtrar por</span>
            {activeFilters > 0 && (
              <button className="pub-filter-clear" onClick={clearFilters}>
                Limpiar filtros ({activeFilters})
              </button>
            )}
          </div>
          {filterGroups}
        </div>
      )}

      {activeFilters > 0 && (
        <div className="filter-results">{list.length} resultados</div>
      )}

      <div className="body" style={{ background: 'var(--bg)' }}>
        {list.length === 0 ? (
          <div style={{ padding: '0 18px' }}>
            <Empty
              icon="search"
              title="Sin resultados"
              desc={activeFilters > 0 ? 'Probá quitando algún filtro.' : 'Volvé a consultar más tarde.'}
            />
          </div>
        ) : view === 'grid' ? (
          <div className="pub-grid">
            {list.map((m) => (
              <PublicCard key={m.id} model={m} onOpen={() => setViewer({ model: m, idx: 0 })} />
            ))}
          </div>
        ) : (
          <div className="pub-list">
            {list.map((m) => (
              <PublicRow key={m.id} model={m} onOpen={() => setViewer({ model: m, idx: 0 })} />
            ))}
          </div>
        )}

        <div className="pub-footer">
          <div className="pub-footer-note">Stock actualizado al {today}</div>
        </div>
      </div>

      {viewer && (
        <GalleryViewer
          models={list}
          startModel={viewer.model}
          startIdx={viewer.idx}
          onClose={() => setViewer(null)}
        />
      )}

      {whatsappNumber && <WhatsAppButton phone={whatsappNumber} message={whatsappMessage} />}
    </div>
  );
}

function FilterGroups({
  types, sizes, versions, filterTypes, filterSizes, filterVersions,
  onToggleType, onToggleSize, onToggleVersion,
}: {
  types: string[];
  sizes: string[];
  versions: string[];
  filterTypes: string[];
  filterSizes: string[];
  filterVersions: string[];
  onToggleType: (v: string) => void;
  onToggleSize: (v: string) => void;
  onToggleVersion: (v: string) => void;
}) {
  return (
    <>
      {types.length > 0 && (
        <div className="pub-filter-group">
          <div className="pub-filter-label">Tipo</div>
          <div className="multi-chips">
            {types.map((t) => (
              <button key={t} className={`mchip${filterTypes.includes(t) ? ' is-active' : ''}`}
                onClick={() => onToggleType(t)}>{fmtType(t)}</button>
            ))}
          </div>
        </div>
      )}
      {sizes.length > 0 && (
        <div className="pub-filter-group">
          <div className="pub-filter-label">Talle</div>
          <div className="multi-chips">
            {sizes.map((s) => (
              <button key={s} className={`mchip${filterSizes.includes(s) ? ' is-active' : ''}`}
                onClick={() => onToggleSize(s)}>{fmtSize(s)}</button>
            ))}
          </div>
        </div>
      )}
      {versions.length > 0 && (
        <div className="pub-filter-group">
          <div className="pub-filter-label">Versión</div>
          <div className="multi-chips">
            {versions.map((v) => (
              <button key={v} className={`mchip${filterVersions.includes(v) ? ' is-active' : ''}`}
                onClick={() => onToggleVersion(v)}>{fmtVersion(v)}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PublicCard({ model, onOpen }: { model: PublicModel; onOpen: () => void }) {
  const c = colorByName(model.color);
  const cover = model.photos[0]?.url ?? null;
  return (
    <div className="pub-card" {...openable(onOpen)}>
      <div className="pub-card-img" style={{ background: c.bg, color: c.fg }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" />
        ) : (
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 800,
            fontSize: 40, opacity: 0.85, position: 'relative', zIndex: 1,
          }}>
            {model.number || <Shirt size={40} strokeWidth={1.3} />}
          </span>
        )}
        {model.photos.length > 1 && (
          <span className="pub-photo-count">📷 {model.photos.length}</span>
        )}
      </div>
      <div className="pub-card-body">
        <div className="pub-card-team capitalize">{model.team}</div>
        <div className="pub-card-meta">
          {[model.season, fmtVersion(model.version), fmtType(model.type), [model.number, model.player].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
        </div>
        <SizeChips sizes={model.sizes} />
        <AvailBadge stock={model.stock} />
      </div>
    </div>
  );
}

function PublicRow({ model, onOpen }: { model: PublicModel; onOpen: () => void }) {
  const c = colorByName(model.color);
  const cover = model.photos[0]?.url ?? null;
  return (
    <div className="pub-row" {...openable(onOpen)}>
      <div style={{
        width: 46, height: 54, borderRadius: 'var(--r-sm)', flexShrink: 0,
        background: c.bg, color: c.fg, overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Shirt size={22} strokeWidth={1.5} style={{ position: 'relative', zIndex: 1, opacity: 0.85 }} />
        )}
      </div>
      <div className="pub-row-main">
        <div className="pub-row-team">{model.team} · {fmtVersion(model.version)}</div>
        <div className="pub-row-meta">
          {model.season}{model.type ? ` · ${fmtType(model.type)}` : ''}{model.player ? ` · ${model.player}` : ''}
        </div>
        <SizeChips sizes={model.sizes} />
      </div>
      {model.photos.length > 1 && (
        <span className="size-chip">📷 {model.photos.length}</span>
      )}
      <ChevronRight size={18} strokeWidth={1.8} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
    </div>
  );
}

function GalleryViewer({
  models,
  startModel,
  startIdx,
  onClose,
}: {
  models: PublicModel[];
  startModel: PublicModel;
  startIdx: number;
  onClose: () => void;
}) {
  // Arrows walk a single strip: every photo of the current model, then on to
  // the next model in the visible (filtered + sorted) list. The current model
  // is tracked by identity, so a list change can't swap it out from under us.
  const [pos, setPos] = useState({ model: startModel, p: startIdx });
  const { model } = pos;
  const photos = model.photos;
  const idx = Math.min(pos.p, Math.max(0, photos.length - 1));
  const c = colorByName(model.color);

  const m = models.findIndex((x) => x.id === model.id);
  const prevModel = m > 0 ? models[m - 1] : null;
  const nextModel = m >= 0 && m < models.length - 1 ? models[m + 1] : null;

  const hasPrev = idx > 0 || prevModel !== null;
  const hasNext = idx < photos.length - 1 || nextModel !== null;

  function setIdx(p: number) {
    setPos({ model, p });
  }

  function step(dir: 1 | -1) {
    if (dir === 1) {
      if (idx < photos.length - 1) setPos({ model, p: idx + 1 });
      else if (nextModel) setPos({ model: nextModel, p: 0 });
    } else if (idx > 0) {
      setPos({ model, p: idx - 1 });
    } else if (prevModel) {
      setPos({ model: prevModel, p: Math.max(0, prevModel.photos.length - 1) });
    }
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="pub-viewer" onClick={onClose}>
      <div className="viewer-head" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close" onClick={onClose}>
          <X size={20} strokeWidth={1.8} />
        </button>
      </div>

      <div className="viewer-img-wrap" onClick={(e) => e.stopPropagation()}>
        {photos.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="viewer-img" src={photos[idx].url} alt="" />
        ) : (
          <div style={{
            width: 200, height: 200, background: c.bg, color: c.fg,
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shirt size={72} strokeWidth={1.2} />
          </div>
        )}
        {hasPrev && (
          <button className="viewer-nav prev" aria-label="Anterior" onClick={() => step(-1)}>
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        )}
        {hasNext && (
          <button className="viewer-nav next" aria-label="Siguiente" onClick={() => step(1)}>
            <ChevronRight size={20} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className="viewer-thumbs" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <div
              key={i}
              className={`viewer-thumb${i === idx ? ' is-active' : ''}`}
              onClick={() => setIdx(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
            </div>
          ))}
        </div>
      )}

      <div className="viewer-info" onClick={(e) => e.stopPropagation()}>
        {m >= 0 && models.length > 1 && (
          <div className="viewer-pos">{m + 1} / {models.length}</div>
        )}
        <div className="viewer-team">{model.team}</div>
        <div className="viewer-meta">
          {model.season} · {fmtVersion(model.version)}{model.type ? ` · ${fmtType(model.type)}` : ''}
          {model.sleeve ? ` · manga ${model.sleeve.toLowerCase()}` : ''}
        </div>
        <div className="viewer-tags">
          <span className="viewer-tag" style={{ background: c.bg, color: c.fg }}>{model.color}</span>
          {model.player && <span className="viewer-tag">{model.player}</span>}
          {model.number && <span className="viewer-tag">#{model.number}</span>}
        </div>
        {model.sizes.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              Talles
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {model.sizes.map((s) => (
                <span key={s} className="viewer-tag" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtSize(s)}</span>
              ))}
            </div>
          </div>
        )}
        {model.description && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            {model.description}
          </div>
        )}
        <AvailBadge stock={model.stock} style={{ marginTop: 10 }} />
      </div>
    </div>
  );
}
