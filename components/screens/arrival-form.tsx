'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Swatch } from '@/components/ui/swatch';
import { Icon } from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import { Field, MoneyInput, WeightInput } from '@/components/ui/field';
import { usd, todayISO, fmtRate } from '@/app/lib/format';
import type { BatchSummary, UserSummary } from '@/app/lib/domain';
import type { RateResult } from '@/app/lib/exchange-rate';
import { markArrived } from '@/app/actions/purchases';
import { coverOf } from '@/components/ui/swatch';
import { arrivalSchema, type ArrivalFormValues } from '@/app/lib/schemas';
import { Modal } from '@/components/ui/modal';

type GroupedItem = {
  product: BatchSummary['items'][0]['product'];
  size: string | null;
  basePriceUsd: number;
  qty: number;
};

function groupItems(items: BatchSummary['items']): GroupedItem[] {
  const map = new Map<string, GroupedItem>();
  for (const it of items) {
    const key = `${it.catalogProductId}|${it.size ?? ''}|${it.basePriceUsd}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += 1;
    } else {
      map.set(key, { product: it.product, size: it.size, basePriceUsd: it.basePriceUsd, qty: 1 });
    }
  }
  return Array.from(map.values());
}

export function ArrivalForm({ batch, users, rate }: { batch: BatchSummary; users: UserSummary[]; rate: RateResult }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<ArrivalFormValues | null>(null);
  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<ArrivalFormValues>({
    resolver: zodResolver(arrivalSchema),
    defaultValues: {
      arrivalDate: todayISO(),
      shippingRateUsd: '',
      weight: '',
      shippingPaidByUserId: '',
    },
  });

  const qty = batch.items.length;
  const grouped = groupItems(batch.items);

  function doSubmit(data: ArrivalFormValues) {
    startTransition(async () => {
      await markArrived(batch.id, {
        arrivalDate: data.arrivalDate,
        shippingRateUsd: data.shippingRateUsd,
        weight: data.weight,
        shippingPaidByUserId: data.shippingPaidByUserId,
        exchangeRate: rate.value,
      });
    });
  }

  function onSubmit(data: ArrivalFormValues) {
    if (!data.shippingPaidByUserId) {
      setPendingData(data);
      setShowConfirm(true);
      return;
    }
    doSubmit(data);
  }

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
          <div className="section-label">Batch · {qty} {qty === 1 ? 'item' : 'items'}</div>
          <div className="arrival-items">
            {grouped.map((g, i) => (
              <div key={i} className="arrival-item">
                <Swatch
                  color={g.product.color}
                  number={g.product.number}
                  photo={coverOf(g.product)}
                  style={{ width: 30, height: 34, fontSize: 12, borderRadius: 7 }}
                />
                <div className="ai-main">
                  <div className="ai-team">{g.product.team} · {g.product.version}</div>
                  <div className="ai-meta">
                    {g.size ? `Talle ${g.size}` : 'Sin talle'}
                    {g.basePriceUsd > 0 ? ` · ${usd(g.basePriceUsd)}` : ''}
                  </div>
                </div>
                <div className="ai-qty">×{g.qty}</div>
              </div>
            ))}
          </div>

          <div className="section-label">Recepción · Tipo de cambio: $U {fmtRate(rate.value)}</div>
          <Field label="Fecha de llegada" error={errors.arrivalDate?.message}>
            <input className="input mono" type="date" {...register('arrivalDate')} />
          </Field>
          <div className="field-row">
            <Field label="Envío (USD/kg)" error={errors.shippingRateUsd?.message}>
              <Controller
                name="shippingRateUsd"
                control={control}
                render={({ field }) => (
                  <MoneyInput prefix="US$" value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
            </Field>
            <Field label="Peso (kg)" error={errors.weight?.message}>
              <Controller
                name="weight"
                control={control}
                render={({ field }) => (
                  <WeightInput value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
            </Field>
          </div>

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

          <div className="callout callout-ok">
            <Icon name="check" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Al confirmar, las <strong>{qty} unidades</strong> entran al stock disponible.</span>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={pending} onClick={handleSubmit(onSubmit)}>
            {pending ? 'Confirmando…' : 'Confirmar llegada'}
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
