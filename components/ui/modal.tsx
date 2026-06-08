'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';

export function Modal({
  icon = 'check',
  title,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'accent',
  onConfirm,
  onCancel,
}: {
  icon?: 'check' | 'shirt' | 'x' | 'trash' | null;
  title?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'accent' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onConfirmRef.current = onConfirm; }, [onConfirm]);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancelRef.current(); }
      else if (e.key === 'Enter') { e.preventDefault(); onConfirmRef.current(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (typeof document === 'undefined') return null;
  const host = document.querySelector('.app-shell') ?? document.body;

  return createPortal(
    <div className="modal-scrim" onMouseDown={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {icon && (
          <div
            className="modal-ico"
            style={tone === 'danger' ? { background: 'var(--danger-soft)', color: 'var(--danger)' } : undefined}
          >
            <Icon name={icon} size={22} strokeWidth={2} />
          </div>
        )}
        {title && <div className="modal-title">{title}</div>}
        {children && <div className="modal-body">{children}</div>}
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            type="button"
            autoFocus
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    host,
  );
}
