import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
];

export function monthFromOffset(offset: number) {
  // UTC throughout: sale dates come from toISODate (d.toISOString()), so the
  // month key must be built on the same UTC basis or a sale near a month
  // boundary would bucket into the wrong month in UYU (UTC-3).
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; // "YYYY-MM"
  const label = MONTHS[d.getUTCMonth()];
  const showYear = d.getUTCFullYear() !== now.getUTCFullYear();
  return { key, label, year: d.getUTCFullYear(), showYear };
}

export function MonthNav({
  offset,
  onStep,
  browsingPast,
}: {
  offset: number;
  onStep: (delta: number) => void;
  browsingPast: boolean;
}) {
  const { label, showYear, year } = monthFromOffset(offset);
  return (
    <div className="month-nav">
      <button className="month-nav-btn" onClick={() => onStep(-1)} aria-label="Mes anterior">
        <ChevronLeft size={14} strokeWidth={2} />
      </button>
      <span className="month-nav-label">
        {label}{showYear ? ` ${year}` : ''}
      </span>
      <button
        className="month-nav-btn"
        onClick={() => onStep(1)}
        disabled={!browsingPast}
        aria-label="Mes siguiente"
      >
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
