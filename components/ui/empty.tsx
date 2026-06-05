import { Icon } from './icon';

export function Empty({
  icon = 'box' as const,
  title,
  desc,
}: {
  icon?: 'box' | 'search' | 'truck' | 'cart' | 'shirt';
  title: string;
  desc?: string;
}) {
  return (
    <div className="empty">
      <div className="ico">
        <Icon name={icon} size={26} />
      </div>
      <div className="t">{title}</div>
      {desc && <div className="d">{desc}</div>}
    </div>
  );
}
