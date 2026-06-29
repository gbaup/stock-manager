export function Tag({
  children,
  kind = '',
  className = '',
}: {
  children: React.ReactNode;
  kind?: 'ok' | 'transit' | 'partial' | 'player' | '';
  className?: string;
}) {
  return <span className={`tag ${kind} ${className}`.trim()}>{children}</span>;
}
