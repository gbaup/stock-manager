'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, ChevronRight, Search, X } from 'lucide-react';
import { Swatch, coverOf } from './swatch';
import type { ModelWithStats } from '@/app/lib/domain';
import { groupModels, modelLabel, type ModelGroup } from '@/app/lib/model-groups';

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
          {m.number ? ` · ${m.number}` : ''}
          {m.player ? ` ${m.player}` : ''}
        </div>
        <div className="po-sub capitalize">{[m.version, m.season, m.type].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="po-tags">
        {selected && <Check size={17} strokeWidth={2.4} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
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
  groups: ModelGroup[];
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
        <Plus size={16} strokeWidth={2.2} />
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

  const groups = groupModels(models, q, recentIds);
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
        <span className="it-label capitalize">{selected ? modelLabel(selected) : 'Elegí un producto…'}</span>
        <ChevronRight size={15} strokeWidth={2} style={{ transform: 'rotate(90deg)', flexShrink: 0, color: 'var(--text-faint)' }} />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="picker-scrim" onMouseDown={() => setOpen(false)}>
            <div className="picker-sheet" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
              <div className="picker-grip" />
              <div className="picker-head">
                <div className="picker-search">
                  <Search size={18} strokeWidth={1.8} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
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
                      <X size={15} strokeWidth={2} />
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
