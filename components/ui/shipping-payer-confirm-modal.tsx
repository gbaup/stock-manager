'use client';

import { Modal } from '@/components/ui/modal';

// Paired with useShippingPayerConfirm — same copy in both ArrivalForm and
// ShipmentEditForm, since it's the same warning either way.
export function ShippingPayerConfirmModal({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      icon={null}
      title="Sin responsable de envío"
      confirmLabel={pending ? 'Guardando…' : 'Confirmar igual'}
      cancelLabel="Volver"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      El costo del envío no se va a descontar del saldo de nadie.
    </Modal>
  );
}
