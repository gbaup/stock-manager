'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Swatch } from '@/components/ui/swatch';
import { Segmented } from '@/components/ui/segmented';
import { Field, TextInput, SelectInput, TextAreaInput, MoneyInput } from '@/components/ui/field';
import { METHODS } from '@/app/lib/domain';
import { usd, uyu, todayISO } from '@/app/lib/format';
import { money } from '@/app/lib/money';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import { createSale } from '@/app/actions/sales';
import { coverOf } from '@/components/ui/swatch';
import { makeSaleSchema, type SaleFormValues } from '@/app/lib/schemas';

export function SaleForm({ model, stock, usdRate, users }: { model: ModelWithStats; stock: number; usdRate: number; users: UserSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const sizeStock = Object.fromEntries(model.availableBySize.map((s) => [s.size, s.count]));
  const onlySize = model.availableBySize.length === 1 ? model.availableBySize[0].size : '';
  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<SaleFormValues>({
    resolver: zodResolver(makeSaleSchema(sizeStock)),
    defaultValues: {
      size: onlySize, price: '', quantity: '1', date: todayISO(),
      method: '', description: '', collectedByUserId: '',
    },
  });

  const price = parseFloat(useWatch({ control, name: 'price' })) || 0;
  const qty = parseInt(useWatch({ control, name: 'quantity' }), 10) || 0;
  const collectedByUserId = useWatch({ control, name: 'collectedByUserId' });
  const collectedByAlias = users.find((u) => u.id === collectedByUserId)?.alias ?? '';

  function onSubmit(data: SaleFormValues) {
    startTransition(async () => {
      await createSale(model.id, data);
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Registrar venta"
        onSave={handleSubmit(onSubmit)}
        isSaving={pending}
        savingLabel="Registrando…"
      />
      <div className="body">
        <div className="body-pad">
          <div className="detail-hero" style={{ marginBottom: 4 }}>
            <Swatch
              color={model.color}
              number={model.number}
              photo={coverOf(model)}
              style={{ width: 64, height: 74, fontSize: 24 }}
            />
            <div>
              <div className="detail-team" style={{ fontSize: 19 }}>{model.team}</div>
              <div className="detail-meta">{model.season} · {model.version} · {stock} en stock</div>
            </div>
          </div>

          <div className="section-label">Venta</div>
          <Field label="Talle" error={errors.size?.message}>
            <Controller
              name="size"
              control={control}
              render={({ field }) => (
                <Segmented
                  options={model.availableBySize.map((s) => `${s.size} (${s.count})`)}
                  value={field.value ? `${field.value} (${sizeStock[field.value] ?? 0})` : ''}
                  onChange={(label) => field.onChange(label.replace(/ \(\d+\)$/, ''))}
                  full
                />
              )}
            />
          </Field>

          <Field label="Precio de venta (UYU)" error={errors.price?.message}>
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <MoneyInput value={field.value} onChange={field.onChange} placeholder="2200" />
              )}
            />
          </Field>
          {price > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: '-6px 2px 12px', fontFamily: 'var(--font-mono)' }}>
              ≈ {usd(money.toUsd(price, usdRate))} · total {uyu(price * qty)}
            </div>
          )}

          <div className="field-row">
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
            <Field label="Fecha" error={errors.date?.message}>
              <input className="input mono" type="date" {...register('date')} />
            </Field>
          </div>

          <Field label="Método de pago" optional>
            <Controller
              name="method"
              control={control}
              render={({ field }) => (
                <SelectInput value={field.value ?? ''} onChange={field.onChange} options={METHODS} placeholder="Elegí un método…" />
              )}
            />
          </Field>

          <div className="section-label">Cobro</div>
          <Field label="¿Quién cobró?" error={errors.collectedByUserId?.message}>
            <Controller
              name="collectedByUserId"
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
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -6, marginBottom: 10 }}>
            Suma al saldo en mano de quien recibe la plata.
          </div>

          {collectedByAlias && price > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <span className="mov-chip pos" style={{ fontSize: 14 }}>
                {collectedByAlias} cobra {uyu(price * qty)}
              </span>
            </div>
          )}

          <Field label="Descripción" optional>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextAreaInput value={field.value ?? ''} onChange={field.onChange} placeholder="Comprador, notas…" />
              )}
            />
          </Field>

          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={pending} onClick={handleSubmit(onSubmit)}>
            {pending ? 'Registrando…' : 'Registrar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
