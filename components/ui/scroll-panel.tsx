import type { ReactNode } from 'react';

export function ScrollPanel({
  head,
  children,
  className = '',
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel panel-scroll ${className}`.trim()}>
      <div className="panel-head">{head}</div>
      <div className="panel-body-scroll">{children}</div>
    </div>
  );
}
