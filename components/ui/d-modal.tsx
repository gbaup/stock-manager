'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type DModalSize = 'sm' | 'md' | 'lg';

export function DModal({
  size = 'md',
  title,
  sub,
  iconNode,
  onClose,
  children,
}: {
  size?: DModalSize;
  title: string;
  sub?: string;
  iconNode?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const content = (
    <div className="dm-scrim" onClick={onClose}>
      <div
        className={`dm-card dm-${size}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dm-head">
          {iconNode && <div className="dm-head-ico">{iconNode}</div>}
          <div className="dm-head-tx">
            <div className="dm-title">{title}</div>
            {sub && <div className="dm-sub">{sub}</div>}
          </div>
          <button className="dm-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
