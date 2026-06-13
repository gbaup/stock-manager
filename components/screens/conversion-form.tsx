'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormHead } from '@/components/ui/chrome';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { Modal } from '@/components/ui/modal';
import { Icon } from '@/components/ui/icon';
import { uyu, usd, fmtRate, personInitial, todayISO } from '@/app/lib/format';
import { money } from '@/app/lib/money';
import type { UserSummary } from '@/app/lib/domain';
import { createConversion } from '@/app/actions/conversions';

type Cur = 'UYU' | 'USD';

const CUR_OPTIONS = ['Pesos', 'Dólares'] as const;
const curCode = (label: string): Cur => (label === 'Dólares' ? 'USD' : 'UYU');
const curLabel = (c: Cur) => (c === 'USD' ? 'Dólares' : 'Pesos');
const curSym = (c: Cur) => (c === 'USD' ? 'US$' : '$U');
const curName = (c: Cur) => (c === 'USD' ? 'dólares' : 'pesos');
const fmtCur = (c: Cur, n: number) => (c === 'USD' ? usd(n) : uyu(n));

function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {personInitial(name)}
    </div>
  );
}

type FormState = {
  fromUserId: string;
  fromCur: Cur;
  toUserId: string;
  toCur: Cur;
  amount: string;
  rate: string;
};

export function ConversionForm({ users }: { users: UserSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState<FormState>({
    fromUserId: '',
    fromCur: 'UYU',
    toUserId: '',
    toCur: 'USD',
    amount: '',
    rate: '',
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const flip = () =>
    setF((s) => ({
      ...s,
      fromUserId: s.toUserId,
      toUserId: s.fromUserId,
      fromCur: s.toCur,
      toCur: s.fromCur,
    }));

  const fromAlias = users.find((u) => u.id === f.fromUserId)?.alias ?? '';
  const toAlias = users.find((u) => u.id === f.toUserId)?.alias ?? '';

  const sameCur = f.fromCur === f.toCur;
  const sameAccount = !!f.fromUserId && f.fromUserId === f.toUserId && sameCur;
  const amount = Number(f.amount) || 0;
  const rate = Number(f.rate) || 0;
  const result = money.convert(amount, f.fromCur, f.toCur, sameCur ? 1 : rate);
  const canSave = amount > 0 && !!f.fromUserId && !!f.toUserId && !sameAccount && (sameCur || rate > 0);
  const crossPerson = f.fromUserId && f.toUserId && f.fromUserId !== f.toUserId;

  function handleSubmit() {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      try {
        await createConversion({
          fromUserId: f.fromUserId,
          fromCur: f.fromCur,
          toUserId: f.toUserId,
          toCur: f.toCur,
          fromAmount: amount,
          rate: sameCur ? 1 : rate,
          toAmount: result,
          date: todayISO(),
        });
      } catch {
        setError('No se pudo registrar. Intentá de nuevo.');
      }
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Cambiar monedas"
        onSave={() => canSave && setConfirm(true)}
        saveLabel="Registrar"
        canSave={canSave}
      />

      <div className="body">
        <div className="body-pad-no-nav">
          <div className="section-label">Origen · de dónde sale</div>
          <div className="field-row">
            <Field label="Socio">
              <Segmented
                options={users.map((u) => u.alias)}
                value={fromAlias}
                onChange={(alias) => set('fromUserId', users.find((u) => u.alias === alias)?.id ?? '')}
                full
              />
            </Field>
            <Field label="Moneda">
              <Segmented
                options={CUR_OPTIONS}
                value={curLabel(f.fromCur)}
                onChange={(v) => set('fromCur', curCode(v))}
                full
              />
            </Field>
          </div>

          <div className="conv-flip-row">
            <button type="button" className="conv-swap" onClick={flip} aria-label="Invertir origen y destino">
              <Icon name="swap" size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="section-label">Destino · a dónde entra</div>
          <div className="field-row">
            <Field label="Socio">
              <Segmented
                options={users.map((u) => u.alias)}
                value={toAlias}
                onChange={(alias) => set('toUserId', users.find((u) => u.alias === alias)?.id ?? '')}
                full
              />
            </Field>
            <Field label="Moneda">
              <Segmented
                options={CUR_OPTIONS}
                value={curLabel(f.toCur)}
                onChange={(v) => set('toCur', curCode(v))}
                full
              />
            </Field>
          </div>

          {sameAccount && (
            <p style={{ fontSize: 12.5, color: 'var(--danger)', margin: '-2px 2px 6px', lineHeight: 1.4 }}>
              El origen y el destino no pueden ser la misma cuenta (mismo socio y misma moneda).
            </p>
          )}

          <div className="section-label">{sameCur ? 'Monto' : 'Monto y tipo de cambio'}</div>
          <div className="field-row">
            <Field label={`Monto en ${curName(f.fromCur)}`}>
              <div className="input-prefix">
                <span className="pfx">{curSym(f.fromCur)}</span>
                <input
                  className="input mono"
                  inputMode="decimal"
                  value={f.amount}
                  placeholder="0"
                  onChange={(e) => set('amount', e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
            </Field>
            {!sameCur && (
              <Field label="Tipo de cambio">
                <div className="input-prefix">
                  <span className="pfx">$U</span>
                  <input
                    className="input mono"
                    inputMode="decimal"
                    value={f.rate}
                    placeholder="40.5"
                    onChange={(e) => set('rate', e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </div>
              </Field>
            )}
          </div>
          {!sameCur && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '-4px 2px 10px', lineHeight: 1.4 }}>
              Pesos por dólar (UYU/USD) · a mano · ref ≈ 40,5
            </p>
          )}

          <Field label={sameCur ? 'Entra (mismo monto)' : 'Entra (calculado)'}>
            <div className="calc-field">
              <span className="calc-val">
                {result > 0 ? fmtCur(f.toCur, result) : `${curSym(f.toCur)} 0`}
              </span>
              <span className="calc-hint">
                {sameCur ? 'misma moneda' : (rate > 0 ? `a TC ${fmtRate(rate)}` : 'poné el TC')}
              </span>
            </div>
          </Field>

          {canSave && (
            <div className="conv-summary">
              <div className="cs-row">
                <span className="cs-acct">
                  <Avatar name={fromAlias} />
                  {fromAlias} · {curLabel(f.fromCur)}
                </span>
                <strong className="neg">− {fmtCur(f.fromCur, amount)}</strong>
              </div>
              <div className="cs-arrow">
                <Icon name="chevR" size={15} style={{ transform: 'rotate(90deg)' }} />
              </div>
              <div className="cs-row">
                <span className="cs-acct">
                  <Avatar name={toAlias} />
                  {toAlias} · {curLabel(f.toCur)}
                </span>
                <strong className="pos">+ {fmtCur(f.toCur, result)}</strong>
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center', margin: '10px 0 0' }}>{error}</p>
          )}

          <button
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            disabled={!canSave || pending}
            onClick={() => canSave && setConfirm(true)}
          >
            {sameCur ? 'Registrar transferencia' : 'Registrar cambio'}
          </button>
        </div>
      </div>

      {confirm && (
        <Modal
          icon="swap"
          title={sameCur ? '¿Registrar esta transferencia?' : '¿Registrar este cambio?'}
          confirmLabel="Sí, registrar"
          cancelLabel="Revisar"
          onConfirm={() => { setConfirm(false); handleSubmit(); }}
          onCancel={() => setConfirm(false)}
        >
          <span className="modal-strong">{fromAlias}</span>{' '}
          {sameCur ? 'transfiere' : 'cambia'}{' '}
          <span className="modal-strong">{fmtCur(f.fromCur, amount)}</span>
          {sameCur ? (
            <> a <span className="modal-strong">{toAlias}</span>.</>
          ) : (
            <>
              {' '}→ <span className="modal-strong">{fmtCur(f.toCur, result)}</span>
              {crossPerson && <> para <span className="modal-strong">{toAlias}</span></>}
              {' '}(TC <span className="modal-strong">{fmtRate(rate)}</span>).
            </>
          )}{' '}
          Revisá los datos antes de confirmar — esta acción mueve plata entre cuentas.
        </Modal>
      )}
    </div>
  );
}
