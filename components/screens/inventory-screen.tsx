'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar, BottomNav } from '@/components/ui/chrome';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Tag } from '@/components/ui/tag';
import { Empty } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { colorByName } from '@/app/lib/format';
import type { ModelWithStats } from '@/app/lib/domain';

type Layout = 'cards' | 'rows' | 'grid';
type Filter = 'all' | 'instock' | 'transit' | 'out';

export function InventoryScreen({
  models,
  transitCount,
}: {
  models: ModelWithStats[];
  transitCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [layout, setLayout] = useState<Layout>('cards');

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
                <Icon
                  name={l === 'cards' ? 'box' : l === 'rows' ? 'list' : 'grid'}
                  size={16}
                  strokeWidth={1.8}
                />
              </button>
            ))}
          </div>
        }
      />

      <div className="body">
        <div className="body-pad">
          <div className="search">
            <Icon name="search" size={19} />
            <input
              value={query}
              placeholder="Buscar equipo, jugador, color…"
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="iconbtn plain" style={{ width: 26, height: 26 }} onClick={() => setQuery('')}>
                <Icon name="x" size={16} />
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
        <Icon name="plus" size={26} strokeWidth={2.2} />
      </button>
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
            <div className="mcard-meta">{m.season} · {m.version}</div>
            <div className="mcard-tags capitalize">
              <Tag><ColorDot color={m.color} />{m.color}</Tag>
              {m.player && <Tag kind="player" className="capitalize">{m.player}</Tag>}
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

function VisualGrid({ list, onOpen }: { list: ModelWithStats[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid">
      {list.map((m) => {
        const c = colorByName(m.color);
        const cover = coverOf(m);
        return (
          <div key={m.id} className="tile" onClick={() => onOpen(m.id)}>
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
                  <Icon name="shirt" size={42} strokeWidth={1.3} style={{ position: 'relative', zIndex: 1, opacity: 0.9 }} />
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
