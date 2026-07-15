'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Empty } from '@/components/ui/empty';
import { Swatch, coverOf } from '@/components/ui/swatch';
import { Plus, Shirt, X, Lock, Trash2 } from 'lucide-react';
import { Field, TextInput, TextAreaInput, SelectInput, MoneyInput } from '@/components/ui/field';
import {
  sizesForType, baseCostUsd, reconcileSupplierPayments, toSupplierPaymentArray,
  grossMultiplier, preTaxPriceUsd,
} from '@/app/lib/domain';
import { usd } from '@/app/lib/format';
import type { BatchSummary, ModelWithStats, UserSummary } from '@/app/lib/domain';
import type { RateResult } from '@/app/lib/exchange-rate';
import { updatePurchase, deleteBatch } from '@/app/actions/purchases';
import { ProductPicker } from '@/components/ui/product-picker';
import { purchaseEditSchema, type PurchaseEditFormValues } from '@/app/lib/schemas';
import { Modal } from '@/components/ui/modal';
import { ModalFooter } from '@/components/ui/modal-footer';
import { useConfirmGate } from '@/app/lib/hooks';

// Collapses per-unit rows into quantity lines the form can edit. Prices shown
// are PRE-TAX (the supplier's price): stored prices carry the card-tax bake-in,
// which the server re-applies from the edited payments on save.
function toQuantityLines(
  items: BatchSummary['items'],
  gOld: number,
): PurchaseEditFormValues['items'] {
  const lines = new Map<string, { modelId: string; size: string; basePriceUsd: string; quantity: number }>();
  for (const it of items) {
    const preTax = preTaxPriceUsd(it.basePriceUsd, gOld);
    const key = `${it.catalogProductId}::${it.size}::${preTax}`;
    const line = lines.get(key);
    if (line) line.quantity += 1;
    else lines.set(key, {
      modelId: it.catalogProductId,
      size: it.size,
      basePriceUsd: preTax > 0 ? String(preTax) : '',
      quantity: 1,
    });
  }
  return [...lines.values()];
}

// Edits a batch after creation: metadata, unshipped items (replace/delete/add)
// and supplier payments. Shipped items are locked and shown read-only.
export function PurchaseEditForm({
  batch,
  models,
  users,
  rate,
  onDone,
}: {
  batch: BatchSummary;
  models: ModelWithStats[];
  users: UserSummary[];
  rate: RateResult;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const gOld = grossMultiplier(batch.supplierPayments);
  const editableItems = batch.items.filter((i) => i.shipmentId === null);
  const lockedItems = batch.items.filter((i) => i.shipmentId !== null);
  const lockedPreTaxTotal = lockedItems.reduce((s, i) => s + preTaxPriceUsd(i.basePriceUsd, gOld), 0);
  const canDelete = batch.arrivedQuantity === 0;

  // The batch's implicit exchange rate (UYU/USD of any item), falling back to
  // the live rate. New/edited items get their UYU cost from this on save.
  const rateSource = batch.items.find((i) => i.basePriceUyu != null && i.basePriceUyu > 0 && i.basePriceUsd > 0);
  const defaultRate = rateSource
    ? Math.round((rateSource.basePriceUyu! / rateSource.basePriceUsd) * 100) / 100
    : rate.value;

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<PurchaseEditFormValues>({
    resolver: zodResolver(purchaseEditSchema),
    defaultValues: {
      purchaseDate: batch.purchaseDate,
      supplier: batch.supplier ?? '',
      description: batch.description ?? '',
      supplierPayments: Object.fromEntries(
        batch.supplierPayments.map((p) => [p.userId, String(p.amountUsd)]),
      ),
      supplierCardTaxPcts: Object.fromEntries(
        batch.supplierPayments
          .filter((p) => p.cardTaxPct != null && p.cardTaxPct > 0)
          .map((p) => [p.userId, String(p.cardTaxPct)]),
      ),
      items: toQuantityLines(editableItems, gOld),
      exchangeRate: String(defaultRate),
    },
  });

  const { fields, prepend, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = useWatch({ control, name: 'items' }) ?? [];
  const validItems = watchedItems.filter((it) => it.modelId);
  const editableUsd = baseCostUsd(
    validItems.map((it) => ({ basePriceUsd: parseFloat(it.basePriceUsd ?? '') || 0, quantity: it.quantity ?? 1 })),
  );
  const totalUsd = lockedPreTaxTotal + editableUsd;
  const totalQty = lockedItems.length + validItems.reduce((s, it) => s + (it.quantity ?? 1), 0);
  const needsSupplierPayer = totalUsd > 0;

  const watchedPayments = useWatch({ control, name: 'supplierPayments' }) ?? {};
  const { paidSum, status: payStatus } = reconcileSupplierPayments(toSupplierPaymentArray(watchedPayments), totalUsd);
  const payMismatch = needsSupplierPayer && payStatus === 'mismatch';
  const noItemsLeft = lockedItems.length + validItems.length === 0;

  function doSubmit(data: PurchaseEditFormValues) {
    setSaveError(null);
    startTransition(async () => {
      try {
        const cardTaxPcts = data.supplierCardTaxPcts ?? {};
        await updatePurchase(batch.id, {
          purchaseDate: data.purchaseDate,
          supplier: data.supplier || undefined,
          description: data.description || undefined,
          supplierPayments: toSupplierPaymentArray(data.supplierPayments).map((p) => ({
            ...p,
            cardTaxPct: parseFloat(cardTaxPcts[p.userId] ?? '') || undefined,
          })),
          exchangeRate: parseFloat(data.exchangeRate),
          items: data.items
            .filter((it) => it.modelId)
            .map((it) => ({
              modelId: it.modelId,
              size: it.size,
              basePriceUsd: parseFloat(it.basePriceUsd ?? '') || 0,
              quantity: it.quantity ?? 1,
            })),
          expectedEditableItemIds: editableItems.map((i) => i.id),
        }, { skipRedirect: true });
        // Redirect client-side: a server-side redirect would throw NEXT_REDIRECT
        // into this try/catch and read as a bogus save error.
        if (onDone) onDone();
        else router.push('/purchases');
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Error al guardar la compra');
      }
    });
  }

  const { showConfirm, requestConfirm, confirm, cancel } = useConfirmGate(doSubmit);

  function onSubmit(data: PurchaseEditFormValues) {
    if (noItemsLeft || payMismatch) return;
    const { status } = reconcileSupplierPayments(toSupplierPaymentArray(data.supplierPayments), totalUsd);
    if (needsSupplierPayer && status === 'empty') {
      requestConfirm(data);
      return;
    }
    doSubmit(data);
  }

  function handleDelete() {
    setSaveError(null);
    startTransition(async () => {
      try {
        await deleteBatch(batch.id, { skipRedirect: true });
        if (onDone) onDone();
        else router.push('/purchases');
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Error al eliminar la compra');
      }
    });
  }

  // Locked units grouped by model+size for the read-only section.
  const lockedGroups = new Map<string, { product: BatchSummary['items'][number]['product']; size: string; count: number }>();
  lockedItems.forEach((item) => {
    const key = `${item.catalogProductId}-${item.size}`;
    const existing = lockedGroups.get(key) ?? { product: item.product, size: item.size, count: 0 };
    existing.count++;
    lockedGroups.set(key, existing);
  });

  const canSave = !pending && !payMismatch && !noItemsLeft;

  const body = (
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

      {lockedItems.length > 0 && (
        <>
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={12} strokeWidth={2} />
            Recibidos — no editables
          </div>
          <table className="dtable" style={{ fontSize: 13, marginBottom: 4 }}>
            <tbody>
              {Array.from(lockedGroups.values()).map((g, i) => (
                <tr key={i}>
                  <td className="capitalize dt-team">{g.product.team} · {g.product.version}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{g.size.toUpperCase()}</td>
                  <td className="num">{g.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>
            Ya tienen envío asignado: su costo y ganancia registrada no cambian.
          </div>
        </>
      )}

      <div className="section-label">Items pendientes</div>
      <button
        className="btn btn-secondary"
        type="button"
        onClick={() => prepend({ modelId: '', size: '', basePriceUsd: '', quantity: 1 })}
      >
        <Plus size={19} strokeWidth={1.8} />Agregar item
      </button>
      {fields.length === 0 && (
        <Empty title="Sin items pendientes" desc="Todos los items del pedido ya llegaron, o los borraste." icon="box" />
      )}
      {noItemsLeft && (
        <span className="field-error" style={{ marginTop: 8, display: 'block' }}>
          La compra debe tener al menos un item — para borrarla usá &quot;Eliminar compra&quot;.
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
                <Field label="Precio base (sin recargo)">
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

      <div className="batch-summary" style={{ marginTop: 14 }}>
        <div className="bs-row">
          <span>Cantidad</span>
          <strong>{totalQty} {totalQty === 1 ? 'item' : 'items'}</strong>
        </div>
        <div className="bs-row">
          <span>Costo base total</span>
          <strong>{usd(totalUsd)}</strong>
        </div>
      </div>

      <Field label="Tipo de cambio" error={errors.exchangeRate?.message}>
        <Controller
          name="exchangeRate"
          control={control}
          render={({ field: f }) => (
            <MoneyInput prefix="$U" value={f.value ?? ''} onChange={f.onChange} placeholder="40" />
          )}
        />
      </Field>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -6, marginBottom: 8 }}>
        Se aplica a los items pendientes al guardar; los recibidos no cambian.
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
              ? `Suma ${usd(paidSum)} de ${usd(totalUsd)}${payMismatch ? ' — los montos deben coincidir' : ' ✓'}`
              : 'Repartí el costo entre ambos (deben sumar el total). Dejá ambos vacíos si todavía nadie pagó.'}
          </div>
        </div>
      )}

      {canDelete && (
        <button
          className="btn"
          type="button"
          style={{ width: '100%', marginTop: 12, color: 'var(--danger)', background: 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} strokeWidth={2} />
          Eliminar compra
        </button>
      )}

      {saveError && (
        <div style={{ fontSize: 13, color: 'var(--danger)', margin: '8px 0', fontWeight: 600 }}>
          {saveError}
        </div>
      )}
    </>
  );

  const modals = (
    <>
      {showConfirm && (
        <Modal
          icon={null}
          title="Sin responsable de pago"
          confirmLabel={pending ? 'Guardando…' : 'Guardar igual'}
          cancelLabel="Volver"
          onConfirm={confirm}
          onCancel={cancel}
        >
          El costo no se va a descontar del saldo de nadie.
        </Modal>
      )}
      {confirmDelete && (
        <Modal
          icon="trash"
          tone="danger"
          title="¿Eliminar esta compra?"
          confirmLabel="Eliminar compra"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        >
          Se borran el pedido, sus items en camino y los pagos al proveedor. No se puede deshacer.
        </Modal>
      )}
    </>
  );

  if (onDone) {
    return (
      <>
        <div className="dm-body">{body}</div>
        <ModalFooter
          pending={pending}
          canSave={canSave}
          onCancel={onDone}
          onConfirm={handleSubmit(onSubmit)}
          confirmLabel="Guardar cambios"
          pendingLabel="Guardando…"
        />
        {modals}
      </>
    );
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Editar compra"
        onSave={handleSubmit(onSubmit)}
        saveLabel="Guardar"
        canSave={canSave}
        isSaving={pending}
        savingLabel="Guardando…"
      />
      <div className="body">
        <div className="body-pad">{body}</div>
      </div>
      {modals}
    </div>
  );
}
