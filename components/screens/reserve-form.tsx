'use client';

import { useTransition, useState } from 'react';
import { useForm, Controller, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field, TextInput } from '@/components/ui/field';
import { sizeStockOf } from '@/app/lib/domain';
import type { ModelWithStats } from '@/app/lib/domain';
import { reserveStock } from '@/app/actions/reservations';
import { makeReserveSchema, type ReserveFormValues } from '@/app/lib/schemas';
import { ModalFooter } from '@/components/ui/modal-footer';
import { ClaimFields } from '@/components/screens/claim-fields';

// Reserves N units of a size for a client (bought but not yet delivered).
// Shares its hero+size+quantity block with SaleForm via ClaimFields, minus
// money/collector fields — reserving isn't a sale, just a hold on stock.
export function ReserveForm({ model, onDone }: { model: ModelWithStats; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const sizeStock = sizeStockOf(model);
  const onlySize = model.availableBySize.length === 1 ? model.availableBySize[0].size : '';
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReserveFormValues>({
    resolver: zodResolver(makeReserveSchema(sizeStock)),
    defaultValues: { size: onlySize, quantity: '1', note: '' },
  });

  const { field: sizeField } = useController({ name: 'size', control });
  const { field: quantityField } = useController({ name: 'quantity', control });

  function onSubmit(data: ReserveFormValues) {
    setSaveError(null);
    startTransition(async () => {
      try {
        await reserveStock(model.id, data);
        onDone();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Error al reservar');
      }
    });
  }

  return (
    <>
      <div className="dm-body">
        <ClaimFields
          model={model}
          stock={model.stock}
          size={sizeField.value}
          onSizeChange={sizeField.onChange}
          sizeError={errors.size?.message}
          quantity={quantityField.value}
          onQuantityChange={quantityField.onChange}
          quantityError={errors.quantity?.message}
        />

        <Field label="Nota" optional>
          <Controller
            name="note"
            control={control}
            render={({ field }) => (
              <TextInput value={field.value ?? ''} onChange={field.onChange} placeholder="Nombre del cliente…" />
            )}
          />
        </Field>

        {saveError && (
          <div style={{ fontSize: 13, color: 'var(--danger)', margin: '8px 0', fontWeight: 600 }}>
            {saveError}
          </div>
        )}
      </div>
      <ModalFooter
        pending={pending}
        onCancel={onDone}
        onConfirm={handleSubmit(onSubmit)}
        confirmLabel="Reservar"
        pendingLabel="Reservando…"
      />
    </>
  );
}
