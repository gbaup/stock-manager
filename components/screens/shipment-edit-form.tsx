'use client';

import { useTransition } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Segmented } from '@/components/ui/segmented';
import { Field, MoneyInput, WeightInput } from '@/components/ui/field';
import { fmtRate } from '@/app/lib/format';
import type { ShipmentRecord, UserSummary } from '@/app/lib/domain';
import type { RateResult } from '@/app/lib/exchange-rate';
import { updateShipment } from '@/app/actions/purchases';
import { shipmentEditSchema, type ShipmentEditFormValues } from '@/app/lib/schemas';
import { Modal } from '@/components/ui/modal';
import { ModalFooter } from '@/components/ui/modal-footer';
import { useConfirmGate } from '@/app/lib/hooks';

// Reconstructs a display-only USD/kg rate from the stored price + weight —
// the rate itself isn't persisted, only weight and the computed prices are.
function derivedRate(sh: ShipmentRecord): string {
  if (!sh.shippingPriceUsd || !sh.weight) return '';
  return (sh.shippingPriceUsd / sh.weight).toFixed(2);
}

export function ShipmentEditForm({
  shipment,
  batchUpdatedAt,
  users,
  rate,
  onDone,
}: {
  shipment: ShipmentRecord;
  batchUpdatedAt: string;
  users: UserSummary[];
  rate: RateResult;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const { control, handleSubmit } = useForm<ShipmentEditFormValues>({
    resolver: zodResolver(shipmentEditSchema),
    defaultValues: {
      shippingRateUsd: derivedRate(shipment),
      weight: shipment.weight != null ? String(shipment.weight) : '',
      shippingPaidByUserId: shipment.shippingPaidByUserId ?? '',
    },
  });

  const watchedShipUsd = useWatch({ control, name: 'shippingRateUsd' });
  const watchedWeight = useWatch({ control, name: 'weight' });
  const hasShip = (parseFloat(watchedShipUsd || '') || 0) > 0 && (parseFloat(watchedWeight || '') || 0) > 0;

  function doSubmit(data: ShipmentEditFormValues) {
    startTransition(async () => {
      await updateShipment(shipment.id, {
        shippingRateUsd: data.shippingRateUsd,
        weight: data.weight,
        shippingPaidByUserId: data.shippingPaidByUserId,
        exchangeRate: rate.value,
        expectedUpdatedAt: batchUpdatedAt,
      }, { skipRedirect: true });
      onDone();
    });
  }

  const { showConfirm, requestConfirm, confirm, cancel } = useConfirmGate(doSubmit);

  function onSubmit(data: ShipmentEditFormValues) {
    if (hasShip && !data.shippingPaidByUserId) {
      requestConfirm(data);
      return;
    }
    doSubmit(data);
  }

  return (
    <>
      <div className="dm-body">
        <div className="section-label" style={{ marginTop: 0 }}>Tipo de cambio: $U {fmtRate(rate.value)}</div>
        <div className="field-row">
          <Field label="Envío (USD/kg)" optional>
            <Controller
              name="shippingRateUsd"
              control={control}
              render={({ field }) => (
                <MoneyInput prefix="US$" value={field.value ?? ''} onChange={field.onChange} />
              )}
            />
          </Field>
          <Field label="Peso (kg)" optional>
            <Controller
              name="weight"
              control={control}
              render={({ field }) => (
                <WeightInput value={field.value ?? ''} onChange={field.onChange} />
              )}
            />
          </Field>
        </div>

        {hasShip && (
          <div style={{ marginTop: 4, marginBottom: 4 }}>
            <Field label="¿Quién pagó el envío?" optional>
              <Controller
                name="shippingPaidByUserId"
                control={control}
                render={({ field }) => (
                  <Segmented
                    options={users.map((u) => u.alias)}
                    value={users.find((u) => u.id === field.value)?.alias ?? ''}
                    onChange={(alias) => field.onChange(users.find((u) => u.alias === alias)?.id ?? '')}
                    full
                  />
                )}
              />
            </Field>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -6, marginBottom: 8 }}>
              Se descuenta del saldo de quien pagó (puede ser distinto a quien pagó el proveedor).
            </div>
          </div>
        )}
      </div>
      <ModalFooter
        pending={pending}
        canSave
        onCancel={onDone}
        onConfirm={handleSubmit(onSubmit)}
        confirmLabel="Guardar"
        pendingLabel="Guardando…"
      />
      {showConfirm && (
        <Modal
          icon={null}
          title="Sin responsable de envío"
          confirmLabel={pending ? 'Guardando…' : 'Confirmar igual'}
          cancelLabel="Volver"
          onConfirm={confirm}
          onCancel={cancel}
        >
          El costo del envío no se va a descontar del saldo de nadie.
        </Modal>
      )}
    </>
  );
}
