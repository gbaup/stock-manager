'use client';

export function Segmented({
  options,
  value,
  onChange,
  full = false,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <div className={`seg${full ? ' seg-full' : ''}`}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={value === opt ? 'is-active' : ''}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
