'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Swatch } from '@/components/ui/swatch';
import { Icon } from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import { Field, MoneyInput, WeightInput } from '@/components/ui/field';
import { PEOPLE, usd, todayISO } from '@/app/lib/domain';
import type { BatchSummary } from '@/app/lib/domain';
import { markArrived } from '@/app/actions/purchases';
import { coverOf } from '@/components/ui/swatch';
import { arrivalSchema, type ArrivalFormValues } from '@/app/lib/schemas';

export function ArrivalForm({ batch }: { batch: BatchSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    control,
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm<ArrivalFormValues>({
    resolver: zodResolver(arrivalSchema),
    defaultValues: {
      arrivalDate: todayISO(),
      shippingPriceUsd: '',
      shippingPriceUyu: '',
      weight: '',
      shippingPaidBy: '',
    },
  });

  const shippingPriceUsd = watch('shippingPriceUsd');
  const shippingPriceUyu = watch('shippingPriceUyu');
  const hasShipping =
    (parseFloat(shippingPriceUsd ?? '') || 0) > 0 ||
    (parseFloat(shippingPriceUyu ?? '') || 0) > 0;
  const qty = batch.items.length;

  function onSubmit(data: ArrivalFormValues) {
    startTransition(async () => {
      await markArrived(batch.id, {
        arrivalDate: data.arrivalDate,
        shippingPriceUsd: data.shippingPriceUsd,
        shippingPriceUyu: data.shippingPriceUyu,
        weight: data.weight,
        shippingPaidBy: data.shippingPaidBy,
      });
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Marcar llegada"
        onSave={handleSubmit(onSubmit)}
        saveLabel="Confirmar"
        canSave={!pending}
      />
      <div className="body">
        <div className="body-pad">
          <div className="section-label">Batch · {qty} {qty === 1 ? 'item' : 'items'}</div>
          <div className="arrival-items">
            {batch.items.map((it, i) => (
              <div key={i} className="arrival-item">
                <Swatch
                  color={it.product.color}
                  number={it.product.number}
                  photo={coverOf(it.product)}
                  style={{ width: 30, height: 34, fontSize: 12, borderRadius: 7 }}
                />
                <div className="ai-main">
                  <div className="ai-team">{it.product.team} · {it.product.version}</div>
                  <div className="ai-meta">
                    {it.size ? `Talle ${it.size}` : 'Sin talle'}
                    {it.basePriceUsd > 0 ? ` · ${usd(it.basePriceUsd)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-label">Recepción</div>
          <Field label="Fecha de llegada" error={errors.arrivalDate?.message}>
            <input className="input mono" type="date" {...register('arrivalDate')} />
          </Field>
          <div className="field-row">
            <Field label="Envío (USD)" optional>
              <Controller
                name="shippingPriceUsd"
                control={control}
                render={({ field }) => (
                  <MoneyInput prefix="US$" value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
            </Field>
            <Field label="Envío (UYU)" optional>
              <Controller
                name="shippingPriceUyu"
                control={control}
                render={({ field }) => (
                  <MoneyInput prefix="$U" value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
            </Field>
          </div>
          <Field label="Peso (kg)" optional>
            <Controller
              name="weight"
              control={control}
              render={({ field }) => (
                <WeightInput value={field.value ?? ''} onChange={field.onChange} />
              )}
            />
          </Field>

          {hasShipping && (
            <div style={{ marginTop: 4, marginBottom: 4 }}>
              <Field label="¿Quién pagó el envío?" error={errors.shippingPaidBy?.message}>
                <Controller
                  name="shippingPaidBy"
                  control={control}
                  render={({ field }) => (
                    <Segmented
                      options={PEOPLE}
                      value={field.value ?? ''}
                      onChange={field.onChange}
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

          <div className="callout callout-ok">
            <Icon name="check" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Al confirmar, las <strong>{qty} unidades</strong> entran al stock disponible.</span>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={pending} onClick={handleSubmit(onSubmit)}>
            Confirmar llegada
          </button>
        </div>
      </div>
    </div>
  );
}
