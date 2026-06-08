'use client';

import { useState, useRef, useEffect } from 'react';
import { JERSEY_COLORS } from '@/app/lib/domain';
import { Icon } from './icon';
import { Modal } from './modal';

export function Field({
  label,
  optional,
  error,
  children,
}: {
  label?: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      {label && (
        <label className="field-label">
          {label}
          {optional && <span className="opt"> · opcional</span>}
        </label>
      )}
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  type = 'text',
  inputMode,
  name,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  name?: string;
}) {
  return (
    <input
      className={`input${mono ? ' mono' : ''}`}
      value={value}
      type={type}
      inputMode={inputMode}
      placeholder={placeholder}
      name={name}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

export function MoneyInput({
  value,
  onChange,
  prefix = '$U',
  placeholder = '0',
  name,
}: {
  value: string;
  onChange?: (v: string) => void;
  prefix?: string;
  placeholder?: string;
  name?: string;
}) {
  return (
    <div className="input-prefix">
      <span className="pfx">{prefix}</span>
      <input
        className="input mono"
        value={value}
        inputMode="decimal"
        placeholder={placeholder}
        name={name}
        onChange={(e) => onChange?.(e.target.value.replace(/[^\d.]/g, ''))}
      />
    </div>
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  name,
  mono,
}: {
  value: string;
  onChange?: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  name?: string;
  mono?: boolean;
}) {
  return (
    <div className="select-wrap">
      <select
        className={`select${mono ? ' mono' : ''}`}
        value={value}
        name={name}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function TextAreaInput({
  value,
  onChange,
  placeholder,
  name,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  name?: string;
}) {
  return (
    <textarea
      className="textarea"
      value={value}
      placeholder={placeholder}
      name={name}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="color-grid">
      {JERSEY_COLORS.map((c) => (
        <button
          key={c.name}
          type="button"
          title={c.name}
          aria-label={c.name}
          className={`color-opt${value === c.name ? ' is-active' : ''}`}
          style={{ background: c.bg }}
          onClick={() => onChange(c.name)}
        />
      ))}
    </div>
  );
}

type TeamOption = { id: string; name: string; count?: number };

const normTeam = (s: string) => (s || '').trim().replace(/\s+/g, ' ');

export function TeamCombobox({
  value,
  onChange,
  teams,
  onCreateTeam,
}: {
  value: string;
  onChange: (id: string) => void;
  teams: TeamOption[];
  onCreateTeam: (name: string) => Promise<TeamOption>;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [pending, setPending] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTeam = teams.find((t) => t.id === value);

  useEffect(() => {
    if (!open) setQuery(selectedTeam?.name ?? '');
  }, [open, selectedTeam]);

  const q = normTeam(query);
  const ql = q.toLowerCase();
  const matches = teams
    .filter((t) => !ql || t.name.toLowerCase().includes(ql))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const exact = teams.some((t) => t.name.toLowerCase() === ql);
  const showCreate = q.length > 0 && !exact;
  const rows = matches.length + (showCreate ? 1 : 0);

  const openMenu = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  const closeMenu = () => { setOpen(false); setHi(-1); };
  const deferClose = () => { closeTimer.current = setTimeout(closeMenu, 120); };

  const pick = (t: TeamOption) => { onChange(t.id); setQuery(t.name); closeMenu(); };
  const askCreate = () => { setOpen(false); setPending(q); };
  const cancelCreate = () => setPending(null);

  async function confirmCreate() {
    if (!pending) return;
    setCreating(true);
    try {
      const team = await onCreateTeam(pending);
      onChange(team.id);
      setQuery(team.name);
    } finally {
      setCreating(false);
      setPending(null);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu();
      setHi((h) => Math.min(h + 1, rows - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      if (hi >= 0 && hi < matches.length) pick(matches[hi]);
      else if (showCreate && hi === matches.length) askCreate();
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  }

  return (
    <>
      <div className="combo">
        <input
          className="input"
          value={open ? query : (selectedTeam?.name ?? '')}
          placeholder="Buscá o creá un equipo…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          onChange={(e) => { setQuery(e.target.value); openMenu(); setHi(-1); }}
          onFocus={() => { setQuery(selectedTeam?.name ?? ''); openMenu(); }}
          onBlur={deferClose}
          onKeyDown={onKeyDown}
        />
        {(value || query) && (
          <button
            type="button"
            className="combo-clear"
            aria-label="Borrar"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(''); setQuery(''); openMenu(); }}
          >
            <Icon name="x" size={16} strokeWidth={2} />
          </button>
        )}
        {open && (matches.length > 0 || showCreate) && (
          <div className="combo-menu" onMouseDown={(e) => e.preventDefault()}>
            {matches.map((t, i) => {
              const isExact = t.name.toLowerCase() === ql;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`combo-opt${i === hi ? ' is-hi' : ''}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(t)}
                >
                  <span className="combo-team">{t.name}</span>
                  {(t.count ?? 0) > 0 && <span className="combo-count">{t.count}</span>}
                  {isExact && <Icon name="check" size={16} strokeWidth={2.2} className="combo-check" />}
                </button>
              );
            })}
            {showCreate && (
              <>
                {matches.length > 0 && <div className="combo-sep" />}
                <button
                  type="button"
                  className={`combo-create${hi === matches.length ? ' is-hi' : ''}`}
                  onMouseEnter={() => setHi(matches.length)}
                  onClick={askCreate}
                >
                  <span className="cc-ico"><Icon name="plus" size={16} strokeWidth={2.2} /></span>
                  <span>Crear equipo <strong>«{q}»</strong></span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {pending !== null && (
        <Modal
          icon="shirt"
          title="¿Crear un equipo nuevo?"
          confirmLabel={creating ? 'Creando…' : 'Sí, crear'}
          cancelLabel="Cancelar"
          onConfirm={confirmCreate}
          onCancel={cancelCreate}
        >
          Vas a crear el equipo{' '}
          <span className="modal-strong">«{normTeam(pending)}»</span>, que todavía no existe.
          Revisá que esté bien escrito para no duplicar uno que ya tengas guardado.
        </Modal>
      )}
    </>
  );
}

export function WeightInput({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange?: (v: string) => void;
  name?: string;
}) {
  return (
    <div className="input-prefix">
      <span className="pfx"><Icon name="scale" size={15} /></span>
      <input
        className="input mono"
        inputMode="decimal"
        value={value}
        placeholder="0.0"
        name={name}
        onChange={(e) => onChange?.(e.target.value.replace(/[^\d.]/g, ''))}
      />
    </div>
  );
}
