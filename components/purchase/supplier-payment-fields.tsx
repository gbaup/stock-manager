'use client';

import { Controller, useWatch, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Field, MoneyInput } from '@/components/ui/field';
import { reconcileSupplierPayments, toSupplierPaymentArray } from '@/app/lib/domain';
import { applyCardTax } from '@/app/lib/pricing';
import { usd } from '@/app/lib/format';
import type { UserSummary } from '@/app/lib/domain';

// The "Pago al proveedor" block shared by the new/edit purchase forms (mobile
// and desktop). Works on any form that has `supplierPayments` and
// `supplierCardTaxPcts` records keyed by user id. Renders nothing while the
// batch has no base cost.
export function SupplierPaymentFields<T extends FieldValues>({
  control,
  users,
  totalUsd,
  emptyHint,
}: {
  control: Control<T>;
  users: UserSummary[];
  totalUsd: number;
  emptyHint: string;
}) {
  const payments = (useWatch({ control, name: 'supplierPayments' as Path<T> }) ?? {}) as Record<string, string | undefined>;
  const cardTaxPcts = (useWatch({ control, name: 'supplierCardTaxPcts' as Path<T> }) ?? {}) as Record<string, string | undefined>;

  if (totalUsd <= 0) return null;

  const paymentList = toSupplierPaymentArray(payments);
  const { paidSum, status } = reconcileSupplierPayments(paymentList, totalUsd);
  const mismatch = status === 'mismatch';
  const gross = paymentList.map((p) => {
    const pct = parseFloat(cardTaxPcts[p.userId] ?? '') || 0;
    return { net: p.amountUsd, gross: applyCardTax(p.amountUsd, pct) };
  });
  const totalGross = gross.reduce((s, p) => s + p.gross, 0);
  const hasTax = gross.some((p) => p.gross > p.net);

  return (
    <div className="supplier-pay">
      <div className="section-label" style={{ margin: '0 0 8px' }}>
        Pago al proveedor · {usd(totalUsd)}
      </div>
      {users.map((u) => (
        <div key={u.id} className="field-row" style={{ alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Field label={u.alias} optional>
              <Controller
                name={`supplierPayments.${u.id}` as Path<T>}
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
                name={`supplierCardTaxPcts.${u.id}` as Path<T>}
                control={control}
                render={({ field: f }) => (
                  <MoneyInput prefix="%" value={f.value ?? ''} onChange={f.onChange} placeholder="0" />
                )}
              />
            </Field>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: mismatch ? 'var(--danger)' : 'var(--text-faint)', marginTop: 2, marginBottom: 8 }}>
        {paidSum > 0
          ? <>
              {`Suma ${usd(paidSum)} de ${usd(totalUsd)}${mismatch ? ' — los montos deben coincidir' : ' ✓'}`}
              {hasTax && !mismatch && ` · Costo real ${usd(totalGross)}`}
            </>
          : emptyHint}
      </div>
    </div>
  );
}
