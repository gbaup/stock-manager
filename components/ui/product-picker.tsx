'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';
import { Swatch, coverOf } from './swatch';
import type { ModelWithStats } from '@/app/lib/domain';

// ---------- helpers ----------
const ppNorm = (s: string | null | undefined) =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ppLabel = (m: ModelWithStats) => [m.team, m.version, m.season].filter(Boolean).join(' · ');

function ppHaystack(m: ModelWithStats): string {
  return ppNorm(
    [m.team, m.version, m.season, m.player, m.number && '#' + m.number, m.type, m.sleeve, m.color, m.description]
      .filter(Boolean)
      .join(' '),
  );
}

type PpGroup = { key: string; label: string; items: ModelWithStats[] };

function ppByTeam(list: ModelWithStats[]): PpGroup[] {
  const map: Record<string, ModelWithStats[]> = {};
  list.forEach((m) => {
    (map[m.team] = map[m.team] || []).push(m);
  });
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((team) => ({
      key: 'team-' + team,
      label: team,
      items: map[team].sort((a, b) =>
        ((a.version ?? '') + a.season).localeCompare((b.version ?? '') + b.season, 'es'),
      ),
    }));
}

// agrupa por equipo; sin búsqueda, "En este batch" arriba.
function ppGroups(models: ModelWithStats[], q: string, recentIds: string[]): PpGroup[] {
  const ql = ppNorm(q.trim());
  if (ql) return ppByTeam(models.filter((m) => ppHaystack(m).includes(ql)));

  const seen = new Set<string>();
  const recents = recentIds
    .map((id) => models.find((m) => m.id === id))
    .filter((m): m is ModelWithStats => !!m && !seen.has(m.id) && !!seen.add(m.id));
  const rset = new Set(recents.map((m) => m.id));
  const groups: PpGroup[] = recents.length ? [{ key: 'recent', label: 'En este batch', items: recents }] : [];
  return groups.concat(ppByTeam(models.filter((m) => !rset.has(m.id))));
}

// ---------- fila de resultado ----------
function PpRow({ m, selected, onPick }: { m: ModelWithStats; selected: boolean; onPick: (id: string) => void }) {
  return (
    <button type="button" className={`picker-opt ${selected ? 'is-sel' : ''}`} onClick={() => onPick(m.id)}>
      <Swatch
        color={m.color}
        number={m.number}
        photo={coverOf(m)}
        style={{ width: 34, height: 40, fontSize: 13, borderRadius: 8 }}
      />
      <div className="po-text">
        <div className="po-team capitalize">
          {m.team}
          {m.player ? ` · ${m.player}` : ''}
        </div>
        <div className="po-sub capitalize">{[m.version, m.season, m.type].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="po-tags">
        {selected && <Icon name="check" size={17} strokeWidth={2.4} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
      </div>
    </button>
  );
}

function PpResults({
  groups,
  value,
  onPick,
  query,
}: {
  groups: PpGroup[];
  value: string;
  onPick: (id: string) => void;
  query: string;
}) {
  if (groups.length === 0) {
    return <div className="pp-none">Sin resultados para «{query.trim()}»</div>;
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className="picker-group">
          <div className="picker-group-head">
            <span>{g.label}</span>
            <span className="pg-count">{g.items.length}</span>
          </div>
          {g.items.map((m) => (
            <PpRow key={m.id} m={m} selected={m.id === value} onPick={onPick} />
          ))}
        </div>
      ))}
    </>
  );
}

function PpCreate({ query, onClick }: { query: string; onClick: () => void }) {
  const q = query.trim();
  return (
    <button type="button" className="pp-create" onClick={onClick}>
      <span className="cc-ico">
        <Icon name="plus" size={16} strokeWidth={2.2} />
      </span>
      <span>
        Crear modelo nuevo
        {q ? (
          <>
            {' '}
            <strong>«{q}»</strong>
          </>
        ) : (
          ''
        )}
      </span>
    </button>
  );
}

// ---------- selector (variante Sheet) ----------
export function ProductPicker({
  value,
  onChange,
  models,
  recentIds = [],
  onRequestCreate,
}: {
  value: string;
  onChange: (id: string) => void;
  models: ModelWithStats[];
  recentIds?: string[];
  onRequestCreate?: (prefill: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = models.find((m) => m.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const tid = setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(tid);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups = ppGroups(models, q, recentIds);
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };
  const requestCreate = (prefill: string) => {
    setOpen(false);
    onRequestCreate?.(prefill);
  };

  return (
    <>
      <button
        type="button"
        className={`item-trigger ${selected ? '' : 'is-empty'}`}
        onClick={() => {
          setQ('');
          setOpen(true);
        }}
      >
        <span className="it-label capitalize">{selected ? ppLabel(selected) : 'Elegí un producto…'}</span>
        <Icon name="chevR" size={15} strokeWidth={2} style={{ transform: 'rotate(90deg)', flexShrink: 0, color: 'var(--text-faint)' }} />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="picker-scrim" onMouseDown={() => setOpen(false)}>
            <div className="picker-sheet" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
              <div className="picker-grip" />
              <div className="picker-head">
                <div className="picker-search">
                  <Icon name="search" size={18} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                  <input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar equipo, jugador, nº…"
                    autoComplete="off"
                  />
                  {q && (
                    <button
                      type="button"
                      className="picker-clear"
                      aria-label="Borrar"
                      onClick={() => {
                        setQ('');
                        inputRef.current?.focus();
                      }}
                    >
                      <Icon name="x" size={15} strokeWidth={2} />
                    </button>
                  )}
                </div>
                <button type="button" className="picker-done" onClick={() => setOpen(false)}>
                  Listo
                </button>
              </div>
              <div className="picker-body">
                <PpResults groups={groups} value={value} onPick={pick} query={q} />
                <PpCreate query={q} onClick={() => requestCreate(q.trim())} />
              </div>
            </div>
          </div>,
          document.querySelector('.app-shell') ?? document.body,
        )}
    </>
  );
}
