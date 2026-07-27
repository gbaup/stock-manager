'use client';

export function ModalFooter({
  pending,
  canSave = true,
  onCancel,
  onConfirm,
  confirmLabel,
  pendingLabel = 'Registrando…',
}: {
  pending: boolean;
  canSave?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  pendingLabel?: string;
}) {
  return (
    <div className="dm-foot">
      <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
      <button className="btn btn-primary" onClick={onConfirm} disabled={pending || !canSave}>
        {pending ? pendingLabel : confirmLabel}
      </button>
    </div>
  );
}
