'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormHead } from '@/components/ui/chrome';
import { Field, TextInput, MoneyInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { todayISO, uyu, usd } from '@/app/lib/format';
import type { UserSummary } from '@/app/lib/domain';
import { createExpense } from '@/app/actions/expenses';
import { gastoSchema, type GastoFormValues } from '@/app/lib/schemas';

export function GastoForm({ users }: { users: UserSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<GastoFormValues>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      title: '',
      amount: '',
      currency: 'UYU',
      paidByUserId: '',
      date: todayISO(),
    },
  });

  const currency = useWatch({ control, name: 'currency' });
  const amount = parseFloat(useWatch({ control, name: 'amount' })) || 0;
  const paidByUserId = useWatch({ control, name: 'paidByUserId' });
  const paidByAlias = users.find((u) => u.id === paidByUserId)?.alias ?? '';
  const previewMoney = currency === 'UYU' ? uyu(amount) : usd(amount);

  function onSubmit(data: GastoFormValues) {
    startTransition(async () => {
      await createExpense({
        title: data.title,
        amount: data.amount,
        currency: data.currency,
        paidByUserId: data.paidByUserId,
        date: data.date,
      });
    });
  }

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.back()}
        title="Nuevo gasto"
        onSave={handleSubmit(onSubmit)}
        saveLabel="Registrar gasto"
        canSave={!pending}
      />
      <div className="body">
        <div className="body-pad">
          <div className="section-label">Gasto extra</div>
          <Field label="Título" error={errors.title?.message}>
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <TextInput value={field.value} onChange={field.onChange} placeholder="Pack de 100 sobres manila…" />
              )}
            />
          </Field>
          <div className="field-row">
            <Field label="Monto" error={errors.amount?.message}>
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    prefix={currency === 'UYU' ? '$U' : 'US$'}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                  />
                )}
              />
            </Field>
            <Field label="Moneda">
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Segmented
                    options={['UYU', 'USD'] as const}
                    value={field.value}
                    onChange={field.onChange}
                    full
                  />
                )}
              />
            </Field>
          </div>
          <Field label="Fecha" error={errors.date?.message}>
            <input className="input mono" type="date" {...register('date')} />
          </Field>

          <div className="section-label">Pago</div>
          <Field label="¿Quién lo pagó?" error={errors.paidByUserId?.message}>
            <Controller
              name="paidByUserId"
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
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -6, marginBottom: 10 }}>
            Se descuenta del saldo de quien lo pagó, en {currency === 'UYU' ? 'pesos' : 'dólares'}.
          </div>

          {paidByAlias && amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <span className="mov-chip neg" style={{ fontSize: 14 }}>
                {paidByAlias} paga − {previewMoney}
              </span>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ marginTop: 4 }}
            disabled={pending}
            onClick={handleSubmit(onSubmit)}
          >
            Registrar gasto
          </button>
        </div>
      </div>
    </div>
  );
}
