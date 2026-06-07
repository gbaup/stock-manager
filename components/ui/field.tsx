'use client';

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
