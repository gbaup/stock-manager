import { colorByName } from '@/app/lib/domain';
import type { Photo } from '@/app/lib/photo';
import { Icon } from './icon';

export function coverOf(model: { photos?: Photo[] }): string | null {
  return model.photos?.[0]?.url ?? null;
}

export function Swatch({
  color,
  number,
  photo,
  className = '',
  style,
}: {
  color: string;
  number?: string | null;
  photo?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = colorByName(color);

  if (photo) {
    return (
      <div
        className={`swatch ${className}`}
        style={{ background: c.bg, ...style, overflow: 'hidden' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
        />
      </div>
    );
  }

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
