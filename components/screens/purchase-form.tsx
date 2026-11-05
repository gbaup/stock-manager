'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Stepper } from '@/components/ui/stepper';
import { Empty } from '@/components/ui/empty';
import { Swatch } from '@/components/ui/swatch';
import { ChevronRight, Plus, Shirt, X, Truck, Check, FileSpreadsheet } from 'lucide-react';
import { DModal } from '@/components/ui/d-modal';
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
import { useConfirmGate, useIsDesktop } from '@/app/lib/hooks';
import { PurchaseBuilder } from '@/components/purchase/purchase-builder';
import { PurchaseCatalog } from '@/components/purchase/purchase-catalog';
import { PurchaseItemsTable } from '@/components/purchase/purchase-items-table';
import { SupplierPaymentFields } from '@/components/purchase/supplier-payment-fields';

const DRAFT_KEY = 'purchase-draft';

function emptyValues(presetModelId?: string): PurchaseFormValues {
  return {
    purchaseDate: todayISO(),
    supplier: '',
    description: '',
    supplierPayments: {},
    supplierCardTaxPcts: {},
    items: presetModelId ? [{ modelId: presetModelId, size: '', basePriceUsd: '', quantity: 1 }] : [],
  };
}
const PAY_HINT =
  'Repartí el costo entre ambos (deben sumar el total). Dejá ambos vacíos si todavía nadie pagó. El envío se carga aparte al marcar la llegada.';

export function PurchaseForm({
  models,
  presetModelId,
  newModelId,
  users,
  rate,
  teams,
}: {
  models: ModelWithStats[];
  presetModelId?: string;
  newModelId?: string;
  users: UserSummary[];
  rate: RateResult;
  teams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);

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
    defaultValues: emptyValues(presetModelId),
  });

  const { fields, prepend, append, remove } = useFieldArray({ control, name: 'items' });

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // "Compra puntual" suggestion, per model (sizes ignored): suggested when the
  // model was never bought before and this purchase brings a single unit. A
  // model already flagged as one-off also shows the toggle, unchecked — buying
  // it again suggests it isn't a one-off anymore. User overrides win.
  const [oneOffOverrides, setOneOffOverrides] = useState<Record<string, boolean>>({});
  const qtyByModel = new Map<string, number>();
  for (const it of validItems) qtyByModel.set(it.modelId, (qtyByModel.get(it.modelId) ?? 0) + (it.quantity ?? 1));
  const oneOffToggles = new Map<string, boolean>(); // modelId -> effective value, only for models showing the toggle
  for (const [modelId, qty] of qtyByModel) {
    const m = models.find((x) => x.id === modelId);
    if (!m) continue;
    const suggested = m.totalUnits === 0 && qty === 1;
    if (!suggested && !m.isOneOff) continue;
    oneOffToggles.set(modelId, oneOffOverrides[modelId] ?? suggested);
  }
  const totalQty = validItems.reduce((s, it) => s + (it.quantity ?? 1), 0);
  const totalUsd = baseCostUsd(
    validItems.map((it) => ({ basePriceUsd: parseFloat(it.basePriceUsd ?? '') || 0, quantity: it.quantity ?? 1 })),
  );
  const needsSupplierPayer = totalUsd > 0;

  const watchedPayments = useWatch({ control, name: 'supplierPayments' }) ?? {};
  const { status: payStatus } = reconcileSupplierPayments(toSupplierPaymentArray(watchedPayments), totalUsd);
  const payMismatch = needsSupplierPayer && payStatus === 'mismatch';

  // Desktop: units per model (catalog badges) and focus on a freshly added row.
  const countsById = new Map<string, number>();
  for (const it of validItems) countsById.set(it.modelId, (countsById.get(it.modelId) ?? 0) + (it.quantity ?? 1));
  const focusRowRef = useRef<number | null>(null);
  useEffect(() => {
    if (focusRowRef.current === null) return;
    const row = document.querySelector<HTMLElement>(`[data-prow="${focusRowRef.current}"] select`);
    if (row) {
      row.focus();
      focusRowRef.current = null;
    }
  });
  // A repeated model starts at the price of its last line — usually the same.
  function addModel(modelId: string) {
    const last = [...watchedItems].reverse().find((it) => it.modelId === modelId);
    focusRowRef.current = fields.length;
    append({ modelId, size: '', basePriceUsd: last?.basePriceUsd ?? '', quantity: 1 });
  }
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Bumped on reset so the catalog (search box) remounts clean too.
  const [resetKey, setResetKey] = useState(0);
  // Desktop-only "Importar Excel" entry point; the importer itself is pending.
  const [showImport, setShowImport] = useState(false);

  // With cacheComponents, Next keeps visited routes mounted (React <Activity>)
  // and restores their state on return — so leaving /purchases/new must clear
  // it, or the next "Nueva compra" reopens the old batch (and any open modal).
  function resetAndExit() {
    reset(emptyValues());
    setStep(1);
    setOneOffOverrides({});
    setConfirmLeave(false);
    setShowImport(false);
    setResetKey((k) => k + 1);
    router.push('/purchases');
  }
  function leave() {
    if (fields.length > 0) setConfirmLeave(true);
    else resetAndExit();
  }

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
        oneOffFlags: [...oneOffToggles].map(([modelId, isOneOff]) => ({ modelId, isOneOff })),
      }, { skipRedirect: true });
      resetAndExit();
    });
  }

  const { showConfirm, requestConfirm, confirm, cancel } = useConfirmGate(doSubmit);

  function onSubmit(data: PurchaseFormValues) {
    const { status } = reconcileSupplierPayments(toSupplierPaymentArray(data.supplierPayments), totalUsd);
    if (needsSupplierPayer && status === 'empty') {
      // Nobody paid yet — a valid state, but confirm before saving.
      requestConfirm(data);
      return;
    }
    if (needsSupplierPayer && status === 'mismatch') {
      // The two amounts must cover the base cost exactly; the live hint shows why.
      return;
    }
    doSubmit(data);
  }

  const step1Body = (
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
  );

  const step2Body = (
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
          // The toggle is per model, so show it only on that model's first line.
          const showOneOff = !!modelId && oneOffToggles.has(modelId)
            && watchedItems.findIndex((it) => it.modelId === modelId) === index;
          const oneOff = showOneOff && oneOffToggles.get(modelId);
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
              {showOneOff && (
                <button
                  type="button"
                  className={`chip${oneOff ? ' is-active' : ''}`}
                  style={{ marginTop: 8 }}
                  aria-pressed={oneOff}
                  onClick={() => setOneOffOverrides((o) => ({ ...o, [modelId]: !oneOff }))}
                  title="Se oculta del inventario cuando se agota"
                >
                  {oneOff && <Check size={14} strokeWidth={2.2} />}
                  Compra puntual
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <SupplierPaymentFields control={control} users={users} totalUsd={totalUsd} emptyHint={PAY_HINT} />
      </div>

      <div className="callout callout-warn">
        <Truck size={18} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Se registra como <strong>en camino</strong>. Cuando llegue, marcás la llegada y suma al stock.</span>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={pending || payMismatch} onClick={handleSubmit(onSubmit)}>
        {pending ? 'Registrando…' : 'Registrar compra'}
      </button>
    </>
  );

  const confirmModal = showConfirm ? (
    <Modal
      icon={null}
      title="Sin responsable de pago"
      confirmLabel={pending ? 'Registrando…' : 'Registrar igual'}
      cancelLabel="Volver"
      onConfirm={confirm}
      onCancel={cancel}
    >
      El costo no se va a descontar del saldo de nadie. Útil para stock inicial con precios de referencia.
    </Modal>
  ) : null;

  if (isDesktop) {
    return (
      <>
        <PurchaseBuilder
          title="Nueva compra"
          sub={validItems.length ? `${totalQty} ${totalQty === 1 ? 'item' : 'items'} · ${usd(totalUsd)}` : 'Sin items todavía'}
          onBack={leave}
          actions={
            <>
              <button className="btn btn-secondary" type="button" onClick={() => setShowImport(true)}>
                <FileSpreadsheet size={16} strokeWidth={1.8} />Importar Excel
              </button>
              <button className="btn btn-secondary" type="button" onClick={leave}>Cancelar</button>
              <button className="btn btn-primary" type="button" disabled={pending || payMismatch} onClick={handleSubmit(onSubmit)}>
                {pending ? 'Registrando…' : 'Registrar compra'}
              </button>
            </>
          }
          catalog={<PurchaseCatalog key={resetKey} models={models} teams={teams} counts={countsById} onAdd={addModel} />}
        >
          <div className="pb-info">
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
          </div>
          <Field label="Descripción" optional>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextInput value={field.value ?? ''} onChange={field.onChange} placeholder="Notas del pedido…" />
              )}
            />
          </Field>

          <div className="section-label">Items del batch</div>
          {errors.items?.root?.message && (
            <span className="field-error" style={{ marginBottom: 8, display: 'block' }}>
              {errors.items.root.message}
            </span>
          )}
          {fields.length === 0 ? (
            <Empty title="Sin items todavía" desc="Elegí modelos del catálogo de la izquierda para agregarlos." icon="box" />
          ) : (
            <PurchaseItemsTable
              control={control}
              rowKeys={fields.map((f) => f.id)}
              items={watchedItems}
              models={models}
              onRemove={remove}
              errorOf={(i) => errors.items?.[i]?.size?.message ?? errors.items?.[i]?.modelId?.message}
              oneOff={{
                values: oneOffToggles,
                toggle: (modelId, next) => setOneOffOverrides((o) => ({ ...o, [modelId]: next })),
              }}
            />
          )}

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

          <div style={{ marginTop: 14 }}>
            <SupplierPaymentFields control={control} users={users} totalUsd={totalUsd} emptyHint={PAY_HINT} />
          </div>

          <div className="callout callout-warn" style={{ marginTop: 8 }}>
            <Truck size={18} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Se registra como <strong>en camino</strong>. Cuando llegue, marcás la llegada (con el nº de seguimiento) y suma al stock.
            </span>
          </div>
        </PurchaseBuilder>
        {confirmModal}
        {showImport && (
          <DModal
            size="sm"
            title="Importar Excel"
            sub="Próximamente"
            iconNode={<FileSpreadsheet size={18} strokeWidth={1.8} />}
            onClose={() => setShowImport(false)}
          >
            <div className="dm-body">
              Pronto vas a poder cargar los items de la compra desde una planilla de Excel en lugar de agregarlos uno por uno.
            </div>
            <div className="dm-foot">
              <button className="btn btn-primary" type="button" onClick={() => setShowImport(false)}>Entendido</button>
            </div>
          </DModal>
        )}
        {confirmLeave && (
          <Modal
            icon="trash"
            tone="danger"
            title="¿Descartar la compra?"
            confirmLabel="Descartar"
            cancelLabel="Seguir editando"
            onConfirm={resetAndExit}
            onCancel={() => setConfirmLeave(false)}
          >
            Los items cargados no se van a guardar.
          </Modal>
        )}
      </>
    );
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
          {step === 1 ? step1Body : step2Body}
        </div>
      </div>
      {confirmModal}
    </div>
  );
}
