'use client';

import { useTransition, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Swatch, coverOf } from '@/components/ui/swatch';
import { Icon } from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import { Field, TextInput, MoneyInput, WeightInput } from '@/components/ui/field';
import { usd, todayISO, fmtRate } from '@/app/lib/format';
import type { BatchSummary, UserSummary } from '@/app/lib/domain';
import type { RateResult } from '@/app/lib/exchange-rate';
import { markArrived } from '@/app/actions/purchases';
import { arrivalSchema, type ArrivalFormValues } from '@/app/lib/schemas';
import { Modal } from '@/components/ui/modal';

export function ArrivalForm({ batch, users, rate }: { batch: BatchSummary; users: UserSummary[]; rate: RateResult }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<ArrivalFormValues | null>(null);

  // Items still pending (no shipment yet). Order is the order from the batch
  // listing — the user picks among these.
  const pendingItems = useMemo(
    () => batch.items.filter((it) => it.shipmentId === null),
    [batch.items]
  );

  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(pendingItems.map((it) => it.id))
  );

  const {
    control,
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<ArrivalFormValues>({
    resolver: zodResolver(arrivalSchema),
    defaultValues: {
      arrivalDate: todayISO(),
      trackingNumber: '',
      shippingRateUsd: '',
      weight: '',
      shippingPaidByUserId: '',
      itemIds: pendingItems.map((it) => it.id),
    },
  });

  const watchedShipUsd = useWatch({ control, name: 'shippingRateUsd' });
  const watchedWeight = useWatch({ control, name: 'weight' });
  const hasShip = (parseFloat(watchedShipUsd || '') || 0) > 0 && (parseFloat(watchedWeight || '') || 0) > 0;

  useEffect(() => {
    setValue('itemIds', [...picked], { shouldValidate: false });
  }, [picked, setValue]);

  const priorCount = batch.arrivedQuantity;
  const priorShipments = batch.shipments.length;
  const total = batch.items.length;
  const nPicked = picked.size;
  const leftover = pendingItems.length - nPicked;

  const allOn = picked.size === pendingItems.length && pendingItems.length > 0;
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setPicked(allOn ? new Set() : new Set(pendingItems.map((it) => it.id)));

  function doSubmit(data: ArrivalFormValues) {
    startTransition(async () => {
      await markArrived(batch.id, {
        arrivalDate: data.arrivalDate,
        trackingNumber: data.trackingNumber,
        shippingRateUsd: data.shippingRateUsd,
        weight: data.weight,
        shippingPaidByUserId: data.shippingPaidByUserId,
        itemIds: [...picked],
        exchangeRate: rate.value,
      });
    });
  }

  function onSubmit(data: ArrivalFormValues) {
    const payload: ArrivalFormValues = { ...data, itemIds: [...picked] };
    if (hasShip && !payload.shippingPaidByUserId) {
      setPendingData(payload);
      setShowConfirm(true);
      return;
    }
    doSubmit(payload);
  }

  // Keep itemIds field in sync for zod validation
  const canSave = nPicked > 0;

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Marcar llegada"
        onSave={handleSubmit(onSubmit)}
        saveLabel="Confirmar"
        isSaving={pending}
        savingLabel="Confirmando…"
      />
      <div className="body">
        <div className="body-pad">
          {priorCount > 0 && (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--r-md)',
                padding: '10px 13px',
                fontSize: 12.5,
                color: 'var(--text-muted)',
                marginBottom: 8,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <Icon name="box" size={16} style={{ flexShrink: 0 }} />
              <span>
                Ya llegaron <strong>{priorCount} de {total}</strong> en {priorShipments}{' '}
                {priorShipments === 1 ? 'envío' : 'envíos'}. Registrás otro envío.
              </span>
            </div>
          )}

          <div className="pick-head">
            <div className="section-label" style={{ margin: 0 }}>¿Qué llegó en este envío?</div>
            {pendingItems.length > 1 && (
              <button type="button" className="pick-all" onClick={toggleAll}>
                {allOn ? 'Ninguno' : 'Todos'}
              </button>
            )}
          </div>
          <div className="pick-list">
            {pendingItems.map((it) => {
              const on = picked.has(it.id);
              return (
                <div
                  key={it.id}
                  className={`pick-item${on ? ' on' : ''}`}
                  onClick={() => toggle(it.id)}
                >
                  <span className="pick-box"><Icon name="check" size={14} strokeWidth={2.6} /></span>
                  <Swatch
                    color={it.product.color}
                    number={it.product.number}
                    photo={coverOf(it.product)}
                    style={{ width: 30, height: 34, fontSize: 12, borderRadius: 7 }}
                  />
                  <div className="ai-main">
                    <div className="ai-team capitalize">{it.product.team}{it.product.version ? ` · ${it.product.version}` : ''}</div>
                    <div className="ai-meta">
                      {it.size ? `Talle ${it.size.toUpperCase()}` : 'Sin talle'}
                      {it.basePriceUsd > 0 ? ` · ${usd(it.basePriceUsd)}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-label">Recepción · Tipo de cambio: $U {fmtRate(rate.value)}</div>
          <Field label="Fecha de llegada" error={errors.arrivalDate?.message}>
            <input className="input mono" type="date" {...register('arrivalDate')} />
          </Field>
          <Field label="Número de seguimiento" optional>
            <Controller
              name="trackingNumber"
              control={control}
              render={({ field }) => (
                <TextInput value={field.value ?? ''} onChange={field.onChange} placeholder="Tracking de este envío" mono />
              )}
            />
          </Field>
          <div className="field-row">
            <Field label="Envío (USD/kg)" optional error={errors.shippingRateUsd?.message}>
              <Controller
                name="shippingRateUsd"
                control={control}
                render={({ field }) => (
                  <MoneyInput prefix="US$" value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
            </Field>
            <Field label="Peso (kg)" optional error={errors.weight?.message}>
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
              <Field label="¿Quién pagó el envío?" optional error={errors.shippingPaidByUserId?.message}>
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

          <div className="callout callout-ok">
            <Icon name="check" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Entran <strong>{nPicked} {nPicked === 1 ? 'unidad' : 'unidades'}</strong> al stock.
              {leftover > 0 && <> Quedan <strong>{leftover}</strong> en camino.</>}
            </span>
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            disabled={pending || !canSave}
            onClick={handleSubmit(onSubmit)}
          >
            {pending ? 'Confirmando…' : leftover > 0 ? 'Confirmar envío parcial' : 'Confirmar llegada'}
          </button>
        </div>
      </div>
      {showConfirm && (
        <Modal
          icon={null}
          title="Sin responsable de envío"
          confirmLabel={pending ? 'Guardando…' : 'Confirmar igual'}
          cancelLabel="Volver"
          onConfirm={() => {
            setShowConfirm(false);
            if (pendingData) doSubmit(pendingData);
          }}
          onCancel={() => { setShowConfirm(false); setPendingData(null); }}
        >
          El costo del envío no se va a descontar del saldo de nadie.
        </Modal>
      )}
    </div>
  );
}
