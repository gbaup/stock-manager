import type { ReactNode } from 'react';

export function FixedPage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`page page-fixed ${className}`.trim()}>{children}</div>;
}

FixedPage.Fill = function Fill({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex-fill ${className}`.trim()}>{children}</div>;
};
