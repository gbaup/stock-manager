'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormHead } from '@/components/ui/chrome';
import { Swatch } from '@/components/ui/swatch';
import { Field, TextInput, SelectInput, TextAreaInput, MoneyInput } from '@/components/ui/field';
import { METHODS, usd, uyu, toUsd, todayISO } from '@/app/lib/domain';
import type { ModelWithStats } from '@/app/lib/domain';
import { createSale } from '@/app/actions/sales';

export function SaleForm({ model, stock }: { model: ModelWithStats; stock: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ price: '', quantity: '1', date: todayISO(), method: '', description: '' });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const qty = parseInt(f.quantity, 10) || 0;
  const price = parseFloat(f.price) || 0;
  const overStock = qty > stock;
  const canSave = price > 0 && qty > 0 && !overStock;

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await createSale(model.id, f);
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Registrar venta"
        onSave={handleSave}
        canSave={canSave && !pending}
      />
      <div className="body">
        <div className="body-pad">
          <div className="detail-hero" style={{ marginBottom: 4 }}>
            <Swatch color={model.color} number={model.number} style={{ width: 64, height: 74, fontSize: 24 }} />
            <div>
              <div className="detail-team" style={{ fontSize: 19 }}>{model.team}</div>
              <div className="detail-meta">{model.season} · {model.version} · {stock} en stock</div>
            </div>
          </div>

          <div className="section-label">Venta</div>
          <Field label="Precio de venta (UYU)">
            <MoneyInput value={f.price} onChange={(v) => set('price', v)} placeholder="2200" />
          </Field>
          {price > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: '-6px 2px 12px', fontFamily: 'var(--font-mono)' }}>
              ≈ {usd(toUsd(price))} · total {uyu(price * qty)}
            </div>
          )}

          <div className="field-row">
            <Field label="Cantidad">
              <TextInput value={f.quantity} onChange={(v) => set('quantity', v.replace(/[^\d]/g, ''))} mono inputMode="numeric" />
            </Field>
            <Field label="Fecha">
              <input className="input mono" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
          </div>
          {overStock && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)', margin: '-6px 2px 12px' }}>
              Solo hay {stock} en stock.
            </div>
          )}

          <Field label="Método de pago" optional>
            <SelectInput value={f.method} onChange={(v) => set('method', v)} options={METHODS} placeholder="Elegí un método…" />
          </Field>
          <Field label="Descripción" optional>
            <TextAreaInput value={f.description} onChange={(v) => set('description', v)} placeholder="Comprador, notas…" />
          </Field>

          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={!canSave || pending} onClick={handleSave}>
            Registrar venta
          </button>
        </div>
      </div>
    </div>
  );
}
