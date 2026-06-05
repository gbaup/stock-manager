'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormHead } from '@/components/ui/chrome';
import { Swatch } from '@/components/ui/swatch';
import { Icon } from '@/components/ui/icon';
import { Field, MoneyInput, WeightInput } from '@/components/ui/field';
import { usd, todayISO } from '@/app/lib/domain';
import type { BatchSummary } from '@/app/lib/domain';
import { markArrived } from '@/app/actions/purchases';

export function ArrivalForm({ batch }: { batch: BatchSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ arrivalDate: todayISO(), shippingPriceUsd: '', shippingPriceUyu: '', weight: '' });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const canSave = !!f.arrivalDate;
  const qty = batch.items.length;

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await markArrived(batch.id, f);
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Marcar llegada"
        onSave={handleSave}
        saveLabel="Confirmar"
        canSave={canSave && !pending}
      />
      <div className="body">
        <div className="body-pad">
          <div className="section-label">Batch · {qty} {qty === 1 ? 'item' : 'items'}</div>
          <div className="arrival-items">
            {batch.items.map((it, i) => (
              <div key={i} className="arrival-item">
                <Swatch color={it.product.color} number={it.product.number} style={{ width: 30, height: 34, fontSize: 12, borderRadius: 7 }} />
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
          <Field label="Fecha de llegada">
            <input className="input mono" type="date" value={f.arrivalDate}
              onChange={(e) => set('arrivalDate', e.target.value)} />
          </Field>
          <div className="field-row">
            <Field label="Envío (USD)" optional>
              <MoneyInput prefix="US$" value={f.shippingPriceUsd} onChange={(v) => set('shippingPriceUsd', v)} />
            </Field>
            <Field label="Envío (UYU)" optional>
              <MoneyInput prefix="$U" value={f.shippingPriceUyu} onChange={(v) => set('shippingPriceUyu', v)} />
            </Field>
          </div>
          <Field label="Peso (kg)" optional>
            <WeightInput value={f.weight} onChange={(v) => set('weight', v)} />
          </Field>

          <div className="callout callout-ok">
            <Icon name="check" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Al confirmar, las <strong>{qty} unidades</strong> entran al stock disponible.</span>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={!canSave || pending} onClick={handleSave}>
            Confirmar llegada
          </button>
        </div>
      </div>
    </div>
  );
}
