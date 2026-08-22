'use client';

import { Field, MoneyInput, SelectInput, TextAreaInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { METHODS } from '@/app/lib/domain';
import type { UserSummary } from '@/app/lib/domain';

// Price/date/method/collector/description block shared by SaleEditForm (edit
// an existing sale) and ReservedSaleForm (finalize a reservation as a sale) —
// same fields, same layout, both driven by plain useState rather than RHF.
export function SaleMoneyFields({
  price,
  onPriceChange,
  date,
  onDateChange,
  method,
  onMethodChange,
  description,
  onDescriptionChange,
  collectedByUserId,
  onCollectedByUserIdChange,
  users,
}: {
  price: string;
  onPriceChange: (v: string) => void;
  date: string;
  onDateChange: (v: string) => void;
  method: string;
  onMethodChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  collectedByUserId: string;
  onCollectedByUserIdChange: (id: string) => void;
  users: UserSummary[];
}) {
  const collectedByAlias = users.find((u) => u.id === collectedByUserId)?.alias ?? '';

  return (
    <>
      <div className="section-label" style={{ marginTop: 6 }}>Venta</div>
      <Field label="Precio de venta (UYU)">
        <MoneyInput value={price} onChange={onPriceChange} placeholder="2200" />
      </Field>
      <Field label="Fecha">
        <input className="input mono" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
      </Field>
      <Field label="Método de pago" optional>
        <SelectInput value={method} onChange={onMethodChange} options={METHODS} placeholder="Elegí un método…" />
      </Field>

      <div className="section-label">Cobro</div>
      <Field label="¿Quién cobró?">
        <Segmented
          options={users.map((u) => u.alias)}
          value={collectedByAlias}
          onChange={(alias) => onCollectedByUserIdChange(users.find((u) => u.alias === alias)?.id ?? '')}
          full
        />
      </Field>

      <Field label="Descripción" optional>
        <TextAreaInput value={description} onChange={onDescriptionChange} placeholder="Comprador, notas…" />
      </Field>
    </>
  );
}
