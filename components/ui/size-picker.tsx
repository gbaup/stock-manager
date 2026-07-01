'use client';

import { Segmented } from './segmented';

type SizeStock = { size: string; count: number };

const sizeLabel = (s: SizeStock) => `${s.size.toUpperCase()} (${s.count})`;

// Size selector for the sale forms: shows each in-stock size with its unit
// count and reports the raw size string back. Owns the label<->size mapping
// both sale screens used to duplicate.
export function SizePicker({
  availableBySize,
  value,
  onChange,
}: {
  availableBySize: SizeStock[];
  value: string;
  onChange: (size: string) => void;
}) {
  const selected = availableBySize.find((s) => s.size === value);
  return (
    <Segmented
      options={availableBySize.map(sizeLabel)}
      value={selected ? sizeLabel(selected) : ''}
      onChange={(label) => onChange(availableBySize.find((s) => sizeLabel(s) === label)?.size ?? '')}
      full
    />
  );
}
