'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Swatch, coverOf } from '@/components/ui/swatch';
import { groupModels } from '@/app/lib/model-groups';
import type { ModelWithStats } from '@/app/lib/domain';
import { DModal } from '@/components/ui/d-modal';
import { ModelForm } from '@/components/screens/model-form';

// Left pane of the desktop purchase builder: an always-visible, searchable
// grid of catalog models. Clicking a card (or Enter on the search box, for the
// first result) adds it to the batch. `counts` badges models already added.
// "Crear modelo nuevo" opens the model form in a modal on top and adds the
// created model to the batch — no navigation, so the batch isn't lost.
export function PurchaseCatalog({
  models,
  teams,
  counts,
  onAdd,
}: {
  models: ModelWithStats[];
  teams: { id: string; name: string }[];
  counts: Map<string, number>;
  onAdd: (modelId: string) => void;
}) {
  const [q, setQ] = useState('');
  const [createPrefill, setCreatePrefill] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const groups = groupModels(models, q, [...counts.keys()]);
  const first = groups[0]?.items[0];

  // "/" focuses the search from anywhere on the page, unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="pcat">
      <div className="pcat-tools">
        <div className="search" style={{ marginTop: 0 }}>
          <Search size={18} strokeWidth={1.8} />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q.trim() && first) {
                e.preventDefault();
                onAdd(first.id);
              } else if (e.key === 'Escape' && q) {
                e.preventDefault();
                setQ('');
              }
            }}
            placeholder="Buscar equipo, jugador, nº…  ( / )"
            autoComplete="off"
          />
          {q && (
            <button
              type="button"
              className="picker-clear"
              aria-label="Borrar búsqueda"
              onClick={() => {
                setQ('');
                inputRef.current?.focus();
              }}
            >
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="pcat-hint">
          {q.trim() && first ? 'Enter agrega el primer resultado' : 'Click en un modelo para agregarlo a la compra'}
        </div>
      </div>

      <div className="pcat-scroll">
        {groups.length === 0 && <div className="pp-none">Sin resultados para «{q.trim()}»</div>}
        {groups.map((g) => (
          <section key={g.key} className="pcat-group">
            <div className="picker-group-head">
              <span>{g.label}</span>
              <span className="pg-count">{g.items.length}</span>
            </div>
            <div className="pcat-grid">
              {g.items.map((m) => {
                const count = counts.get(m.id) ?? 0;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`pcat-card${count ? ' is-in' : ''}${m.id === first?.id && q.trim() ? ' is-first' : ''}`}
                    onClick={() => onAdd(m.id)}
                    title="Agregar a la compra"
                  >
                    <div className="pcat-img">
                      <Swatch
                        color={m.color}
                        number={m.number}
                        photo={coverOf(m)}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 0, fontSize: 22 }}
                      />
                      {count > 0 && <span className="pcat-count">×{count}</span>}
                      <span className="pcat-add"><Plus size={16} strokeWidth={2.4} /></span>
                    </div>
                    <div className="pcat-body">
                      <div className="pcat-team capitalize">
                        {m.team}
                        {m.number ? ` · ${m.number}` : ''}
                        {m.player ? ` ${m.player}` : ''}
                      </div>
                      <div className="pcat-meta capitalize">{[m.version, m.season, m.type].filter(Boolean).join(' · ')}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <button type="button" className="pp-create" onClick={() => setCreatePrefill(q.trim())}>
          <span className="cc-ico"><Plus size={16} strokeWidth={2.2} /></span>
          <span>
            Crear modelo nuevo
            {q.trim() && <> <strong>«{q.trim()}»</strong></>}
          </span>
        </button>
      </div>

      {createPrefill !== null && (
        <DModal title="Nuevo modelo" size="lg" onClose={() => setCreatePrefill(null)}>
          <ModelForm
            teams={teams}
            prefillTeam={createPrefill || undefined}
            onDone={(createdId) => {
              setCreatePrefill(null);
              if (createdId) {
                setQ('');
                onAdd(createdId);
              }
            }}
          />
        </DModal>
      )}
    </div>
  );
}
