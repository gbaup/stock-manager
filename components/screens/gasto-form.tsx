'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormHead } from '@/components/ui/chrome';
import { Field, TextInput, MoneyInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { PEOPLE, todayISO, uyu, usd } from '@/app/lib/domain';
import { createExpense } from '@/app/actions/expenses';

export function GastoForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    title: '',
    amount: '',
    currency: 'UYU' as 'UYU' | 'USD',
    paidBy: '',
    date: todayISO(),
  });
  const set = <K extends keyof typeof f>(k: K, v: typeof f[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const amount = parseFloat(f.amount) || 0;
  const canSave = f.title.trim().length > 0 && amount > 0 && !!f.paidBy;

  const previewMoney = f.currency === 'UYU' ? uyu(amount) : usd(amount);

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      await createExpense({
        title: f.title,
        amount: f.amount,
        currency: f.currency,
        paidBy: f.paidBy,
        date: f.date,
      });
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Nuevo gasto"
        onSave={handleSave}
        saveLabel="Registrar gasto"
        canSave={canSave && !pending}
      />
      <div className="body">
        <div className="body-pad">
          <div className="section-label">Gasto extra</div>
          <Field label="Título">
            <TextInput
              value={f.title}
              onChange={(v) => set('title', v)}
              placeholder="Pack de 100 sobres manila…"
            />
          </Field>
          <div className="field-row">
            <Field label="Monto">
              <MoneyInput
                prefix={f.currency === 'UYU' ? '$U' : 'US$'}
                value={f.amount}
                onChange={(v) => set('amount', v)}
                placeholder="0"
              />
            </Field>
            <Field label="Moneda">
              <Segmented
                options={['UYU', 'USD'] as const}
                value={f.currency}
                onChange={(v) => set('currency', v as 'UYU' | 'USD')}
                full
              />
            </Field>
          </div>
          <Field label="Fecha">
            <input
              className="input mono"
              type="date"
              value={f.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </Field>

          <div className="section-label">Pago</div>
          <Field label="¿Quién lo pagó?">
            <Segmented options={PEOPLE} value={f.paidBy} onChange={(v) => set('paidBy', v)} full />
          </Field>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -6, marginBottom: 10 }}>
            Se descuenta del saldo de quien lo pagó, en {f.currency === 'UYU' ? 'pesos' : 'dólares'}.
          </div>

          {f.paidBy && amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <span className="mov-chip neg" style={{ fontSize: 14 }}>
                {f.paidBy} paga − {previewMoney}
              </span>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ marginTop: 4 }}
            disabled={!canSave || pending}
            onClick={handleSave}
          >
            Registrar gasto
          </button>
        </div>
      </div>
    </div>
  );
}
