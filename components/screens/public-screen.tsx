'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Eye, Search, X, LayoutGrid, List, Filter, Shirt } from 'lucide-react';
import { Empty } from '@/components/ui/empty';
import { fmtSize, fmtType } from '@/app/lib/domain';
import { catalogFilterOptions, modelMatchesFacets } from '@/app/lib/catalog-filters';
import { colorByName } from '@/app/lib/format';
import type { ModelMeta } from '@/app/lib/domain';

type PublicModel = ModelMeta & { stock: number };
type View = 'grid' | 'list';

const VIEW_KEY = 'sc_pub_view';

function SizeChips({ sizes }: { sizes: string[] }) {
  if (!sizes.length) return null;
  return (
    <div className="size-chips uppercase">
      {sizes.map((s) => <span key={s} className="size-chip">{fmtSize(s)}</span>)}
    </div>
  );
}

export function PublicScreen({ models, today, loggedIn }: { models: PublicModel[]; today: string; loggedIn: boolean }) {
  const router = useRouter();
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
      const haystack = [m.team, m.season, m.version, m.color, m.player, m.number, m.type]
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
            <button className="iconbtn plain" style={{ width: 26, height: 26 }} onClick={() => setQuery('')}>
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
          <button className={`view-btn${view === 'grid' ? ' is-active' : ''}`} onClick={() => setViewPersisted('grid')}>
            <LayoutGrid size={16} strokeWidth={1.8} />
          </button>
          <button className={`view-btn${view === 'list' ? ' is-active' : ''}`} onClick={() => setViewPersisted('list')}>
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
          {allTypes.length > 0 && (
            <div className="pub-filter-group">
              <div className="pub-filter-label">Tipo</div>
              <div className="multi-chips">
                {allTypes.map((t) => (
                  <button key={t} className={`mchip${filterTypes.includes(t) ? ' is-active' : ''}`}
                    onClick={() => toggleFilter(filterTypes, setFilterTypes, t)}>{fmtType(t)}</button>
                ))}
              </div>
            </div>
          )}
          {allSizes.length > 0 && (
            <div className="pub-filter-group">
              <div className="pub-filter-label">Talle</div>
              <div className="multi-chips">
                {allSizes.map((s) => (
                  <button key={s} className={`mchip${filterSizes.includes(s) ? ' is-active' : ''}`}
                    onClick={() => toggleFilter(filterSizes, setFilterSizes, s)}>{fmtSize(s)}</button>
                ))}
              </div>
            </div>
          )}
          {allVersions.length > 0 && (
            <div className="pub-filter-group">
              <div className="pub-filter-label">Versión</div>
              <div className="multi-chips">
                {allVersions.map((v) => (
                  <button key={v} className={`mchip${filterVersions.includes(v) ? ' is-active' : ''}`}
                    onClick={() => toggleFilter(filterVersions, setFilterVersions, v)}>{v}</button>
                ))}
              </div>
            </div>
          )}
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
          model={viewer.model}
          startIdx={viewer.idx}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function PublicCard({ model, onOpen }: { model: PublicModel; onOpen: () => void }) {
  const c = colorByName(model.color);
  const cover = model.photos[0]?.url ?? null;
  return (
    <div className="pub-card" onClick={onOpen}>
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
          {model.season} · {model.version}{model.type ? ` · ${model.type}` : ''} {model.number ? ` · ${model.number}` : ''} {model.player ? ` ${model.player}` : ''}
        </div>
        <SizeChips sizes={model.sizes} />
        <div className="avail-badge"><span className="avail-dot" />Disponible</div>
      </div>
    </div>
  );
}

function PublicRow({ model, onOpen }: { model: PublicModel; onOpen: () => void }) {
  const c = colorByName(model.color);
  const cover = model.photos[0]?.url ?? null;
  return (
    <div className="pub-row" onClick={onOpen}>
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
        <div className="pub-row-team">{model.team} · {model.version}</div>
        <div className="pub-row-meta">
          {model.season}{model.type ? ` · ${model.type}` : ''}{model.player ? ` · ${model.player}` : ''}
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
  model,
  startIdx,
  onClose,
}: {
  model: PublicModel;
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const photos = model.photos;
  const c = colorByName(model.color);

  const hasPrev = idx > 0;
  const hasNext = idx < photos.length - 1;

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
          <button className="viewer-nav prev" onClick={() => setIdx(idx - 1)}>
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        )}
        {hasNext && (
          <button className="viewer-nav next" onClick={() => setIdx(idx + 1)}>
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
        <div className="viewer-team">{model.team}</div>
        <div className="viewer-meta">
          {model.season} · {model.version}{model.type ? ` · ${model.type}` : ''}
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
        <div className="avail-badge" style={{ marginTop: 10, color: 'var(--accent)' }}>
          <span className="avail-dot" />Disponible
        </div>
      </div>
    </div>
  );
}
