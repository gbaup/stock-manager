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
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  canConfirm = true,
  isConfirming = false,
  children,
}: {
  size?: DModalSize;
  title: string;
  sub?: string;
  iconNode?: React.ReactNode;
  onClose: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  canConfirm?: boolean;
  isConfirming?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const content = (
    <div className="dm-scrim" onClick={onClose}>
      <div
        className={`dm-card dm-${size}`}
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

        {onConfirm && confirmLabel && (
          <div className="dm-foot">
            <button className="btn btn-secondary" onClick={onClose} disabled={isConfirming}>
              {cancelLabel}
            </button>
            <button
              className="btn btn-primary"
              onClick={onConfirm}
              disabled={!canConfirm || isConfirming}
            >
              {isConfirming ? 'Guardando…' : confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
