'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Stepper } from '@/components/ui/stepper';
import { Empty } from '@/components/ui/empty';
import { Swatch } from '@/components/ui/swatch';
import { ChevronRight, Plus, Shirt, X, Truck } from 'lucide-react';
import { Field, TextInput, TextAreaInput, SelectInput, MoneyInput } from '@/components/ui/field';
import { sizesForType, baseCostUsd, reconcileSupplierPayments, toSupplierPaymentArray } from '@/app/lib/domain';
import { usd, todayISO, fmtRate } from '@/app/lib/format';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import type { RateResult } from '@/app/lib/exchange-rate';
import { createPurchase } from '@/app/actions/purchases';
import { coverOf } from '@/components/ui/swatch';
import { ProductPicker } from '@/components/ui/product-picker';
import { purchaseSchema, type PurchaseFormValues } from '@/app/lib/schemas';
import { Modal } from '@/components/ui/modal';

const DRAFT_KEY = 'purchase-draft';

export function PurchaseForm({
  models,
  presetModelId,
  newModelId,
  users,
  rate,
}: {
  models: ModelWithStats[];
  presetModelId?: string;
  newModelId?: string;
  users: UserSummary[];
  rate: RateResult;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<PurchaseFormValues | null>(null);

  const {
    control,
    handleSubmit,
    register,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      purchaseDate: todayISO(),
      supplier: '',
      description: '',
      supplierPayments: {},
      supplierCardTaxPcts: {},
      items: presetModelId
        ? [{ modelId: presetModelId, size: '', basePriceUsd: '', quantity: 1 }]
        : [],
    },
  });

  const { fields, prepend, remove } = useFieldArray({ control, name: 'items' });

  // Restaura el borrador al volver de "Nuevo modelo" (la navegación desmonta el form).
  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(DRAFT_KEY);
    try {
      const draft = JSON.parse(raw) as { values: PurchaseFormValues; step: number; pendingIndex: number };
      if (newModelId && draft.values.items[draft.pendingIndex]) {
        draft.values.items[draft.pendingIndex].modelId = newModelId;
      }
      reset(draft.values);
      setStep(draft.step ?? 2);
    } catch {
      // borrador corrupto: lo ignoramos
    }
    router.replace('/purchases/new');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda el borrador y navega al alta de modelo, recordando qué fila lo pidió.
  function requestCreateModel(index: number, prefill: string) {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ values: getValues(), step, pendingIndex: index }),
    );
    router.push(`/inventory/new?fromPurchase=1&prefillTeam=${encodeURIComponent(prefill)}`);
  }

  const watchedItems = useWatch({ control, name: 'items' }) ?? [];
  const validItems = watchedItems.filter((it) => it.modelId);
  const totalQty = validItems.reduce((s, it) => s + (it.quantity ?? 1), 0);
  const totalUsd = baseCostUsd(
    validItems.map((it) => ({ basePriceUsd: parseFloat(it.basePriceUsd ?? '') || 0, quantity: it.quantity ?? 1 })),
  );
  const needsSupplierPayer = totalUsd > 0;

  const watchedPayments = useWatch({ control, name: 'supplierPayments' }) ?? {};
  const watchedCardTaxPcts = useWatch({ control, name: 'supplierCardTaxPcts' }) ?? {};
  const { paidSum, status: payStatus } = reconcileSupplierPayments(toSupplierPaymentArray(watchedPayments), totalUsd);
  const payMismatch = needsSupplierPayer && payStatus === 'mismatch';

  const grossPayments = toSupplierPaymentArray(watchedPayments).map((p) => {
    const pct = parseFloat(watchedCardTaxPcts[p.userId] ?? '') || 0;
    return { ...p, grossUsd: Math.round(p.amountUsd * (1 + pct / 100) * 100) / 100 };
  });
  const totalGrossUsd = grossPayments.reduce((s, p) => s + p.grossUsd, 0);
  const hasTax = grossPayments.some((p) => p.grossUsd > p.amountUsd);

  async function handleNextStep() {
    const valid = await trigger(['purchaseDate']);
    if (valid) setStep(2);
  }

  function doSubmit(data: PurchaseFormValues) {
    startTransition(async () => {
      const cardTaxPcts = data.supplierCardTaxPcts ?? {};
      await createPurchase({
        purchaseDate: data.purchaseDate,
        supplier: data.supplier || undefined,
        description: data.description || undefined,
        supplierPayments: toSupplierPaymentArray(data.supplierPayments).map((p) => ({
          ...p,
          cardTaxPct: parseFloat(cardTaxPcts[p.userId] ?? '') || undefined,
        })),
        exchangeRate: rate.value,
        items: data.items
          .filter((it) => it.modelId)
          .map((it) => ({
            modelId: it.modelId,
            size: it.size,
            basePriceUsd: parseFloat(it.basePriceUsd ?? '') || 0,
            quantity: it.quantity ?? 1,
          })),
      });
    });
  }

  function onSubmit(data: PurchaseFormValues) {
    const { status } = reconcileSupplierPayments(toSupplierPaymentArray(data.supplierPayments), totalUsd);
    if (needsSupplierPayer && status === 'empty') {
      // Nobody paid yet — a valid state, but confirm before saving.
      setPendingData(data);
      setShowConfirm(true);
      return;
    }
    if (needsSupplierPayer && status === 'mismatch') {
      // The two amounts must cover the base cost exactly; the live hint shows why.
      return;
    }
    doSubmit(data);
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={step === 1 ? () => router.back() : () => setStep(1)}
        title={step === 1 ? 'Nueva compra · info' : 'Nueva compra · items'}
        onSave={step === 1 ? handleNextStep : handleSubmit(onSubmit)}
        saveLabel={step === 1 ? 'Siguiente' : 'Registrar'}
        isSaving={pending}
        savingLabel="Registrando…"
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

              <Field label="Proveedor" optional>
                <Controller
                  name="supplier"
                  control={control}
                  render={({ field }) => (
                    <TextInput value={field.value ?? ''} onChange={field.onChange} placeholder="Ej: Yupoo — Kingjerseys" />
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
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -2, marginBottom: 4 }}>
                El número de seguimiento se carga al marcar la llegada — un pedido puede dividirse en varios envíos.
              </div>

              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleNextStep}>
                Siguiente: agregar items
                <ChevronRight size={18} strokeWidth={1.8} />
              </button>
            </>
          ) : (
            <>
              {validItems.length > 0 && (
                <div className="batch-summary">
                  <div className="bs-row">
                    <span>Cantidad</span>
                    <strong>{totalQty} {totalQty === 1 ? 'item' : 'items'}</strong>
                  </div>
                  <div className="bs-row">
                    <span>Costo base total</span>
                    <strong>{usd(totalUsd)}</strong>
                  </div>
                  <div className="bs-row">
                    <span>Tipo de cambio</span>
                    <strong>$U {fmtRate(rate.value)}</strong>
                  </div>
                </div>
              )}

              <button
                className="btn btn-secondary"
                style={{ marginTop: 12 }}
                type="button"
                onClick={() => prepend({ modelId: '', size: '', basePriceUsd: '', quantity: 1 })}
              >
                <Plus size={19} strokeWidth={1.8} />Agregar item
              </button>

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
                          <div className="item-swatch-empty"><Shirt size={16} strokeWidth={1.8} /></div>
                        )}
                        <div className="item-model">
                          <Controller
                            name={`items.${index}.modelId`}
                            control={control}
                            render={({ field: f }) => (
                              <ProductPicker
                                value={f.value ?? ''}
                                onChange={f.onChange}
                                models={models}
                                recentIds={watchedItems
                                  .map((it, i) => (i !== index ? it.modelId : ''))
                                  .filter(Boolean)}
                                onRequestCreate={(prefill) => requestCreateModel(index, prefill)}
                              />
                            )}
                          />
                        </div>
                        <button className="iconbtn plain item-del" type="button" onClick={() => remove(index)}>
                          <X size={17} strokeWidth={1.8} />
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
                              <SelectInput value={f.value} onChange={f.onChange} options={sizesForType(m?.type)} placeholder="Talle…" />
                            )}
                          />
                        </Field>
                        <Field label="Cantidad">
                          <Controller
                            name={`items.${index}.quantity`}
                            control={control}
                            render={({ field: f }) => (
                              <input
                                className="input mono"
                                type="number"
                                min={1}
                                inputMode="numeric"
                                value={f.value ?? ''}
                                onChange={(e) => f.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                                onBlur={(e) => { if (e.target.value === '') f.onChange(1); }}
                              />
                            )}
                          />
                        </Field>
                      </div>
                      <div className="field-row" style={{ marginTop: 6 }}>
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

              {needsSupplierPayer && (
                <div style={{ marginTop: 14 }}>
                  <div className="section-label" style={{ margin: '0 0 8px' }}>
                    Pago al proveedor · {usd(totalUsd)}
                  </div>
                  {users.map((u) => (
                    <div key={u.id} className="field-row" style={{ alignItems: 'flex-end', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <Field label={u.alias} optional>
                          <Controller
                            name={`supplierPayments.${u.id}` as const}
                            control={control}
                            render={({ field: f }) => (
                              <MoneyInput prefix="US$" value={f.value ?? ''} onChange={f.onChange} placeholder="0" />
                            )}
                          />
                        </Field>
                      </div>
                      <div style={{ width: 112 }}>
                        <Field label="Recargo tarjeta" optional>
                          <Controller
                            name={`supplierCardTaxPcts.${u.id}` as const}
                            control={control}
                            render={({ field: f }) => (
                              <MoneyInput prefix="%" value={f.value ?? ''} onChange={f.onChange} placeholder="0" />
                            )}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: payMismatch ? 'var(--danger)' : 'var(--text-faint)', marginTop: 2, marginBottom: 8 }}>
                    {paidSum > 0
                      ? <>
                          {`Suma ${usd(paidSum)} de ${usd(totalUsd)}${payMismatch ? ' — los montos deben coincidir' : ' ✓'}`}
                          {hasTax && !payMismatch && ` · Costo real ${usd(totalGrossUsd)}`}
                        </>
                      : 'Repartí el costo entre ambos (deben sumar el total). Dejá ambos vacíos si todavía nadie pagó. El envío se carga aparte al marcar la llegada.'}
                  </div>
                </div>
              )}

              <div className="callout callout-warn">
                <Truck size={18} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Se registra como <strong>en camino</strong>. Cuando llegue, marcás la llegada y suma al stock.</span>
              </div>

              <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={pending || payMismatch} onClick={handleSubmit(onSubmit)}>
                {pending ? 'Registrando…' : 'Registrar compra'}
              </button>
            </>
          )}
        </div>
      </div>
      {showConfirm && (
        <Modal
          icon={null}
          title="Sin responsable de pago"
          confirmLabel={pending ? 'Registrando…' : 'Registrar igual'}
          cancelLabel="Volver"
          onConfirm={() => {
            setShowConfirm(false);
            if (pendingData) doSubmit(pendingData);
          }}
          onCancel={() => { setShowConfirm(false); setPendingData(null); }}
        >
          El costo no se va a descontar del saldo de nadie. Útil para stock inicial con precios de referencia.
        </Modal>
      )}
    </div>
  );
}
