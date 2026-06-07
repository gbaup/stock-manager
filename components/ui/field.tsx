'use client';

import { useState, useRef, useEffect } from 'react';
import { JERSEY_COLORS } from '@/app/lib/domain';
import { Icon } from './icon';

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

type TeamOption = { id: string; name: string };

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
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedTeam = teams.find((t) => t.id === value);

  useEffect(() => {
    if (!open && selectedTeam) setQuery(selectedTeam.name);
  }, [open, selectedTeam]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? teams.filter((t) => t.name.toLowerCase().includes(normalized))
    : teams;
  const exactMatch = teams.find((t) => t.name.toLowerCase() === normalized);
  const showCreate = normalized.length > 0 && !exactMatch;

  async function handleCreate() {
    setCreating(true);
    try {
      const team = await onCreateTeam(query.trim());
      onChange(team.id);
      setQuery(team.name);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="combobox" ref={ref}>
      <input
        className="input"
        value={open ? query : (selectedTeam?.name ?? '')}
        placeholder="Ej: Peñarol, Real Madrid…"
        onFocus={() => {
          setQuery(selectedTeam?.name ?? '');
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="combobox-drop">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`combobox-opt${t.id === value ? ' is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(t.id);
                setQuery(t.name);
                setOpen(false);
              }}
            >
              {t.name}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              className="combobox-opt combobox-create"
              disabled={creating}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
            >
              {creating ? 'Creando…' : `Crear "${query.trim()}"`}
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <div className="combobox-empty">Sin resultados</div>
          )}
        </div>
      )}
    </div>
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
