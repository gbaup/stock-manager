import { Icon } from './icon';

export function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="stepper">
      {labels.map((lbl, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'active' : 'todo';
        const dotStyle =
          state === 'active'
            ? { background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' }
            : state === 'done'
            ? { background: 'var(--accent-soft)', color: 'var(--accent-press)', borderColor: 'var(--accent-line)' }
            : {};
        const lblStyle = state === 'active' ? { color: 'var(--text)' } : state === 'done' ? { color: 'var(--text-muted)' } : {};
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: i > 0 ? 1 : 'none' }}>
            {i > 0 && (
              <span
                className="stepper-line"
                style={n <= step ? { background: 'var(--accent-line)', flex: 1 } : { flex: 1 }}
              />
            )}
            <div className="stepper-item">
              <span className="stepper-dot" style={dotStyle}>
                {state === 'done' ? <Icon name="check" size={13} strokeWidth={2.4} /> : n}
              </span>
              <span className="stepper-lbl" style={lblStyle}>{lbl}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
