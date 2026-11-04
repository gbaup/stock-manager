'use client';

export function ModalFooter({
  pending,
  canSave = true,
  onCancel,
  onConfirm,
  confirmLabel,
  pendingLabel = 'Registrando…',
  cancelLabel = 'Cancelar',
}: {
  pending: boolean;
  canSave?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <div className="dm-foot">
      <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
      <button className="btn btn-primary" onClick={onConfirm} disabled={pending || !canSave}>
        {pending ? pendingLabel : confirmLabel}
      </button>
    </div>
  );
}
