'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormHead } from '@/components/ui/chrome';
import { Stepper } from '@/components/ui/stepper';
import { Empty } from '@/components/ui/empty';
import { Swatch } from '@/components/ui/swatch';
import { Icon } from '@/components/ui/icon';
import { Field, TextInput, TextAreaInput, SelectInput, MoneyInput } from '@/components/ui/field';
import { SIZES, usd, todayISO } from '@/app/lib/domain';
import type { ModelWithStats } from '@/app/lib/domain';
import { createPurchase } from '@/app/actions/purchases';

type Item = { key: string; modelId: string; size: string; basePriceUsd: string };

export function PurchaseForm({
  models,
  presetModelId,
}: {
  models: ModelWithStats[];
  presetModelId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [batch, setBatch] = useState({ purchaseDate: todayISO(), supplier: '', trackingNumber: '', description: '' });
  const [items, setItems] = useState<Item[]>(
    presetModelId ? [{ key: 'i0', modelId: presetModelId, size: '', basePriceUsd: '' }] : []
  );
  const setB = (k: keyof typeof batch, v: string) => setBatch((s) => ({ ...s, [k]: v }));

  const modelLabel = (m: ModelWithStats) => `${m.team} · ${m.version} · ${m.season}`;
  const modelByLabel: Record<string, string> = {};
  models.forEach((m) => { modelByLabel[modelLabel(m)] = m.id; });

  const addItem = () => setItems((s) => [...s, { key: `i${Date.now()}`, modelId: '', size: '', basePriceUsd: '' }]);
  const updItem = (key: string, k: keyof Item, v: string) =>
    setItems((s) => s.map((it) => it.key === key ? { ...it, [k]: v } : it));
  const delItem = (key: string) => setItems((s) => s.filter((it) => it.key !== key));

  const validItems = items.filter((it) => it.modelId);
  const allRowsValid = items.length > 0 && items.every((it) => it.modelId && it.size);
  const totalUsd = validItems.reduce((s, it) => s + (parseFloat(it.basePriceUsd) || 0), 0);
  const step1Valid = !!batch.purchaseDate;
  const canSave = step === 2 && validItems.length > 0 && allRowsValid;

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await createPurchase({
        purchaseDate: batch.purchaseDate,
        supplier: batch.supplier || undefined,
        trackingNumber: batch.trackingNumber || undefined,
        description: batch.description || undefined,
        items: validItems.map((it) => ({
          modelId: it.modelId,
          size: it.size,
          basePriceUsd: parseFloat(it.basePriceUsd) || 0,
        })),
      });
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={step === 1 ? () => router.back() : () => setStep(1)}
        title={step === 1 ? 'Nueva compra · info' : 'Nueva compra · items'}
        onSave={step === 1 ? () => { if (step1Valid) setStep(2); } : handleSave}
        saveLabel={step === 1 ? 'Siguiente' : 'Registrar'}
        canSave={step === 1 ? step1Valid : canSave && !pending}
      />
      <Stepper step={step} labels={['Info del batch', 'Items']} />

      <div className="body">
        <div className="body-pad">
          {step === 1 ? (
            <>
              <div className="section-label">Info del batch</div>
              <Field label="Fecha de compra">
                <input className="input mono" type="date" value={batch.purchaseDate}
                  onChange={(e) => setB('purchaseDate', e.target.value)} />
              </Field>
              <Field label="Cantidad">
                <div className="calc-field">
                  <span className="calc-val">{items.length}</span>
                  <span className="calc-hint">se calcula de los items</span>
                </div>
              </Field>

              <div className="section-label">Seguimiento</div>
              <Field label="Proveedor" optional>
                <TextInput value={batch.supplier} onChange={(v) => setB('supplier', v)} placeholder="Ej: Yupoo — Kingjerseys" />
              </Field>
              <Field label="Número de tracking" optional>
                <TextInput value={batch.trackingNumber} onChange={(v) => setB('trackingNumber', v)} placeholder="Nº de seguimiento" mono />
              </Field>
              <Field label="Descripción" optional>
                <TextAreaInput value={batch.description} onChange={(v) => setB('description', v)} placeholder="Notas del pedido…" />
              </Field>

              <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={!step1Valid}
                onClick={() => step1Valid && setStep(2)}>
                Siguiente: agregar items
                <Icon name="chevR" size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="section-label">Items del batch</div>
              {items.length === 0 && (
                <Empty title="Sin items todavía" desc="Agregá un item por cada camiseta del pedido." icon="box" />
              )}
              <div className="item-list">
                {items.map((it, i) => {
                  const m = models.find((x) => x.id === it.modelId);
                  return (
                    <div key={it.key} className="item-card">
                      <div className="item-head">
                        <span className="item-idx">{i + 1}</span>
                        {m ? (
                          <Swatch color={m.color} number={m.number} style={{ width: 30, height: 34, fontSize: 12, borderRadius: 7 }} />
                        ) : (
                          <div className="item-swatch-empty"><Icon name="shirt" size={16} /></div>
                        )}
                        <select
                          className="select item-model"
                          value={m ? modelLabel(m) : ''}
                          onChange={(e) => updItem(it.key, 'modelId', modelByLabel[e.target.value] || '')}
                        >
                          <option value="">Elegí un producto…</option>
                          {models.map((mm) => (
                            <option key={mm.id} value={modelLabel(mm)}>{modelLabel(mm)}</option>
                          ))}
                        </select>
                        <button className="iconbtn plain item-del" type="button" onClick={() => delItem(it.key)}>
                          <Icon name="x" size={17} />
                        </button>
                      </div>
                      <div className="field-row" style={{ marginTop: 10 }}>
                        <Field label="Talle">
                          <SelectInput value={it.size} onChange={(v) => updItem(it.key, 'size', v)} options={SIZES} placeholder="Talle…" />
                        </Field>
                        <Field label="Precio base">
                          <MoneyInput prefix="US$" value={it.basePriceUsd} onChange={(v) => updItem(it.key, 'basePriceUsd', v)} placeholder="0" />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="btn btn-secondary" style={{ marginTop: 12 }} type="button" onClick={addItem}>
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

              <div className="callout callout-warn">
                <Icon name="truck" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Se registra como <strong>en camino</strong>. Cuando llegue, marcás la llegada y suma al stock.</span>
              </div>

              <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={!canSave || pending} onClick={handleSave}>
                Registrar compra
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
