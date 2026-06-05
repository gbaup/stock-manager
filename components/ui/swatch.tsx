import { colorByName } from '@/app/lib/domain';
import { Icon } from './icon';

export function Swatch({
  color,
  number,
  className = '',
  style,
}: {
  color: string;
  number?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = colorByName(color);
  return (
    <div
      className={`swatch ${className}`}
      style={{ background: c.bg, color: c.fg, ...style }}
    >
      {number ? (
        <span className="num">{number}</span>
      ) : (
        <Icon name="shirt" size={20} strokeWidth={1.6} style={{ position: 'relative', zIndex: 1, opacity: 0.85 }} />
      )}
    </div>
  );
}

export function ColorDot({ color }: { color: string }) {
  return <span className="dot" style={{ background: colorByName(color).bg }} />;
}
