'use client';

import { Swatch, coverOf } from '@/components/ui/swatch';
import { SizePicker } from '@/components/ui/size-picker';
import { Field, TextInput } from '@/components/ui/field';
import type { ModelWithStats } from '@/app/lib/domain';

// Hero + size + quantity block shared by SaleForm and ReserveForm — both
// claim `quantity` units of a model+size from stock, one via a sale, one via
// a reservation. Each form adds its own trailing field (price vs note) after
// this. Parents drive it with useController rather than nesting <Controller>,
// since size/quantity are the only fields this component owns.
export function ClaimFields({
  model,
  stock,
  size,
  onSizeChange,
  sizeError,
  quantity,
  onQuantityChange,
  quantityError,
}: {
  model: ModelWithStats;
  stock: number;
  size: string;
  onSizeChange: (v: string) => void;
  sizeError?: string;
  quantity: string;
  onQuantityChange: (v: string) => void;
  quantityError?: string;
}) {
  return (
    <>
      <div className="detail-hero" style={{ marginBottom: 4 }}>
        <Swatch
          color={model.color}
          number={model.number}
          photo={coverOf(model)}
          style={{ width: 64, height: 74, fontSize: 24 }}
        />
        <div>
          <div className="detail-team" style={{ fontSize: 19 }}>{model.team}</div>
          <div className="detail-meta">{model.season} · {model.version} · {stock} en stock</div>
        </div>
      </div>

      <Field label="Talle" error={sizeError}>
        <SizePicker availableBySize={model.availableBySize} value={size} onChange={onSizeChange} />
      </Field>

      <Field label="Cantidad" error={quantityError}>
        <TextInput
          value={quantity}
          onChange={(v) => onQuantityChange(v.replace(/[^\d]/g, ''))}
          mono
          inputMode="numeric"
        />
      </Field>
    </>
  );
}
