'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Stepper } from '@/components/ui/stepper';
import { Empty } from '@/components/ui/empty';
import { Swatch } from '@/components/ui/swatch';
import { Icon } from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import { Field, TextInput, TextAreaInput, SelectInput, MoneyInput } from '@/components/ui/field';
import { SIZES, usd, todayISO } from '@/app/lib/domain';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import { createPurchase } from '@/app/actions/purchases';
import { coverOf } from '@/components/ui/swatch';
import { purchaseSchema, type PurchaseFormValues } from '@/app/lib/schemas';

export function PurchaseForm({
  models,
  presetModelId,
  users,
}: {
  models: ModelWithStats[];
  presetModelId?: string;
  users: UserSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);

  const {
    control,
    handleSubmit,
    register,
    trigger,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      purchaseDate: todayISO(),
      supplier: '',
      trackingNumber: '',
      description: '',
      supplierPaidByUserId: '',
      items: presetModelId
        ? [{ modelId: presetModelId, size: '', basePriceUsd: '' }]
        : [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const cap = (s: string) => s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
  const modelLabel = (m: ModelWithStats) => `${cap(m.team)} · ${cap(m.version ?? '')} · ${m.season}`;
  const modelByLabel: Record<string, string> = {};
  models.forEach((m) => { modelByLabel[modelLabel(m)] = m.id; });

  const watchedItems = useWatch({ control, name: 'items' }) ?? [];
  const validItems = watchedItems.filter((it) => it.modelId);
  const totalUsd = validItems.reduce((s, it) => s + (parseFloat(it.basePriceUsd ?? '') || 0), 0);
  const needsSupplierPayer = totalUsd > 0;

  async function handleNextStep() {
    const valid = await trigger(['purchaseDate']);
    if (valid) setStep(2);
  }

  function onSubmit(data: PurchaseFormValues) {
    startTransition(async () => {
      await createPurchase({
        purchaseDate: data.purchaseDate,
        supplier: data.supplier || undefined,
        trackingNumber: data.trackingNumber || undefined,
        description: data.description || undefined,
        supplierPaidByUserId: data.supplierPaidByUserId || undefined,
        items: data.items
          .filter((it) => it.modelId)
          .map((it) => ({
            modelId: it.modelId,
            size: it.size,
            basePriceUsd: parseFloat(it.basePriceUsd ?? '') || 0,
          })),
      });
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={step === 1 ? () => router.back() : () => setStep(1)}
        title={step === 1 ? 'Nueva compra · info' : 'Nueva compra · items'}
        onSave={step === 1 ? handleNextStep : handleSubmit(onSubmit)}
        saveLabel={step === 1 ? 'Siguiente' : 'Registrar'}
        canSave={!pending}
      />
      <Stepper step={step} labels={['Info del batch', 'Items']} />

      <div className="body">
        <div className="body-pad">
          {step === 1 ? (
            <>
              <div className="section-label">Info del batch</div>
              <Field label="Fecha de compra" error={errors.purchaseDate?.message}>
                <input className="input mono" type="date" {...register('purchaseDate')} />
              </Field>
              <Field label="Cantidad">
                <div className="calc-field">
                  <span className="calc-val">{fields.length}</span>
                  <span className="calc-hint">se calcula de los items</span>
                </div>
              </Field>

              <div className="section-label">Seguimiento</div>
              <Field label="Proveedor" optional>
                <Controller
                  name="supplier"
                  control={control}
                  render={({ field }) => (
                    <TextInput value={field.value ?? ''} onChange={field.onChange} placeholder="Ej: Yupoo — Kingjerseys" />
                  )}
                />
              </Field>
              <Field label="Número de tracking" optional>
                <Controller
                  name="trackingNumber"
                  control={control}
                  render={({ field }) => (
                    <TextInput value={field.value ?? ''} onChange={field.onChange} placeholder="Nº de seguimiento" mono />
                  )}
                />
              </Field>
              <Field label="Descripción" optional>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextAreaInput value={field.value ?? ''} onChange={field.onChange} placeholder="Notas del pedido…" />
                  )}
                />
              </Field>

              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleNextStep}>
                Siguiente: agregar items
                <Icon name="chevR" size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="section-label">Items del batch</div>
              {fields.length === 0 && (
                <Empty title="Sin items todavía" desc="Agregá un item por cada camiseta del pedido." icon="box" />
              )}
              {errors.items?.root?.message && (
                <span className="field-error" style={{ marginBottom: 8, display: 'block' }}>
                  {errors.items.root.message}
                </span>
              )}
              <div className="item-list">
                {fields.map((field, index) => {
                  const modelId = watchedItems[index]?.modelId;
                  const m = models.find((x) => x.id === modelId);
                  return (
                    <div key={field.id} className="item-card">
                      <div className="item-head">
                        <span className="item-idx">{index + 1}</span>
                        {m ? (
                          <Swatch
                            color={m.color}
                            number={m.number}
                            photo={coverOf(m)}
                            style={{ width: 30, height: 34, fontSize: 12, borderRadius: 7 }}
                          />
                        ) : (
                          <div className="item-swatch-empty"><Icon name="shirt" size={16} /></div>
                        )}
                        <Controller
                          name={`items.${index}.modelId`}
                          control={control}
                          render={({ field: f }) => (
                            <select
                              className="select item-model"
                              value={m ? modelLabel(m) : ''}
                              onChange={(e) => f.onChange(modelByLabel[e.target.value] || '')}
                            >
                              <option value="">Elegí un producto…</option>
                              {models.map((mm) => (
                                <option key={mm.id} value={modelLabel(mm)}>{modelLabel(mm)}</option>
                              ))}
                            </select>
                          )}
                        />
                        <button className="iconbtn plain item-del" type="button" onClick={() => remove(index)}>
                          <Icon name="x" size={17} />
                        </button>
                      </div>
                      {errors.items?.[index]?.modelId?.message && (
                        <span className="field-error" style={{ marginTop: 4, display: 'block' }}>
                          {errors.items[index].modelId.message}
                        </span>
                      )}
                      <div className="field-row" style={{ marginTop: 10 }}>
                        <Field label="Talle" error={errors.items?.[index]?.size?.message}>
                          <Controller
                            name={`items.${index}.size`}
                            control={control}
                            render={({ field: f }) => (
                              <SelectInput value={f.value} onChange={f.onChange} options={SIZES} placeholder="Talle…" />
                            )}
                          />
                        </Field>
                        <Field label="Precio base">
                          <Controller
                            name={`items.${index}.basePriceUsd`}
                            control={control}
                            render={({ field: f }) => (
                              <MoneyInput prefix="US$" value={f.value ?? ''} onChange={f.onChange} placeholder="0" />
                            )}
                          />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                className="btn btn-secondary"
                style={{ marginTop: 12 }}
                type="button"
                onClick={() => append({ modelId: '', size: '', basePriceUsd: '' })}
              >
                <Icon name="plus" size={19} />Agregar item
              </button>

              {validItems.length > 0 && (
                <div className="batch-summary">
                  <div className="bs-row">
                    <span>Cantidad</span>
                    <strong>{validItems.length} {validItems.length === 1 ? 'item' : 'items'}</strong>
                  </div>
                  <div className="bs-row">
                    <span>Costo base total</span>
                    <strong>{usd(totalUsd)}</strong>
                  </div>
                </div>
              )}

              {needsSupplierPayer && (
                <div style={{ marginTop: 14 }}>
                  <div className="section-label" style={{ margin: '0 0 8px' }}>
                    Pago al proveedor
                  </div>
                  <Field label={`¿Quién le pagó al proveedor? · ${usd(totalUsd)}`} error={errors.supplierPaidByUserId?.message}>
                    <Controller
                      name="supplierPaidByUserId"
                      control={control}
                      render={({ field: f }) => (
                        <Segmented
                          options={users.map((u) => u.alias)}
                          value={users.find((u) => u.id === f.value)?.alias ?? ''}
                          onChange={(alias) => f.onChange(users.find((u) => u.alias === alias)?.id ?? '')}
                          full
                        />
                      )}
                    />
                  </Field>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -6, marginBottom: 8 }}>
                    Se descuenta del saldo en US$ de quien pagó. El envío se carga aparte al marcar la llegada.
                  </div>
                </div>
              )}

              <div className="callout callout-warn">
                <Icon name="truck" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Se registra como <strong>en camino</strong>. Cuando llegue, marcás la llegada y suma al stock.</span>
              </div>

              <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={pending} onClick={handleSubmit(onSubmit)}>
                Registrar compra
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
