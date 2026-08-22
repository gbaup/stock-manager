'use client';

import { useTransition, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Swatch, coverOf } from '@/components/ui/swatch';
import { SizePicker } from '@/components/ui/size-picker';
import { Field, TextInput } from '@/components/ui/field';
import { sizeStockOf } from '@/app/lib/domain';
import type { ModelWithStats } from '@/app/lib/domain';
import { reserveStock } from '@/app/actions/reservations';
import { makeReserveSchema, type ReserveFormValues } from '@/app/lib/schemas';
import { ModalFooter } from '@/components/ui/modal-footer';

// Reserves N units of a size for a client (bought but not yet delivered).
// Same size+quantity, auto-FIFO shape as SaleForm, minus money/collector
// fields — reserving isn't a sale, just a hold on stock.
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
        <div className="detail-hero" style={{ marginBottom: 4 }}>
          <Swatch
            color={model.color}
            number={model.number}
            photo={coverOf(model)}
            style={{ width: 64, height: 74, fontSize: 24 }}
          />
          <div>
            <div className="detail-team" style={{ fontSize: 19 }}>{model.team}</div>
            <div className="detail-meta">{model.season} · {model.version} · {model.stock} en stock</div>
          </div>
        </div>

        <Field label="Talle" error={errors.size?.message}>
          <Controller
            name="size"
            control={control}
            render={({ field }) => (
              <SizePicker availableBySize={model.availableBySize} value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>

        <Field label="Cantidad" error={errors.quantity?.message}>
          <Controller
            name="quantity"
            control={control}
            render={({ field }) => (
              <TextInput
                value={field.value}
                onChange={(v) => field.onChange(v.replace(/[^\d]/g, ''))}
                mono
                inputMode="numeric"
              />
            )}
          />
        </Field>

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
