'use client';

export function ChipToggle({
  active, color, label, onClick,
}: {
  active: boolean; color: string; label: string; onClick: () => void;
}) {
  return (
    <button type="button" className={`chip${active ? '' : ' is-off'}`} onClick={onClick}>
      <span className="chip-dot" style={{ background: color }} />
      {label}
    </button>
  );
}
