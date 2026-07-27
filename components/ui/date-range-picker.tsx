'use client';

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  return (
    <div className="date-range">
      <input
        type="date"
        className="input"
        value={from}
        max={to}
        onChange={(e) => onChange({ from: e.target.value, to })}
      />
      <span className="date-range-sep">—</span>
      <input
        type="date"
        className="input"
        value={to}
        min={from}
        onChange={(e) => onChange({ from, to: e.target.value })}
      />
    </div>
  );
}
