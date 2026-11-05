'use client';

import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Check, Shirt, X } from 'lucide-react';
import { MoneyInput, SelectInput } from '@/components/ui/field';
import { Swatch, coverOf } from '@/components/ui/swatch';
import { sizesForType, type ModelWithStats } from '@/app/lib/domain';

type ItemValues = { modelId: string; size: string; basePriceUsd?: string; quantity: number };

type RowErrors = Partial<Record<keyof ItemValues, { message?: string }>> | undefined;

// First validation message of a purchase item row, for the table's `errorOf`.
export function rowError(e: RowErrors): string | undefined {
  return e?.modelId?.message ?? e?.size?.message ?? e?.quantity?.message ?? e?.basePriceUsd?.message;
}

// Desktop items table for the purchase builder. Each row's model is fixed
// (picked from the catalog); size, quantity and price are edited inline.
// Rows carry `data-prow={index}` so the caller can focus a new row's size.
export function PurchaseItemsTable<T extends FieldValues>({
  control,
  rowKeys,
  items,
  models,
  onRemove,
  errorOf,
  oneOff,
}: {
  control: Control<T>;
  rowKeys: string[];
  items: ItemValues[];
  models: ModelWithStats[];
  onRemove: (index: number) => void;
  // First validation message for the row (model, size, quantity, price…).
  errorOf: (index: number) => string | undefined;
  // "Compra puntual" toggle, shown on the first row of each flagged model.
  oneOff?: { values: Map<string, boolean>; toggle: (modelId: string, next: boolean) => void };
}) {
  return (
    <table className="pitems">
      <thead>
        <tr>
          <th className="pi-idx">#</th>
          <th>Modelo</th>
          <th className="pi-size">Talle</th>
          <th className="pi-qty">Cant.</th>
          <th className="pi-price">Precio base</th>
          <th className="pi-del" aria-label="Quitar" />
        </tr>
      </thead>
      <tbody>
        {rowKeys.map((key, index) => {
          const modelId = items[index]?.modelId ?? '';
          const m = models.find((x) => x.id === modelId);
          const showOneOff = !!oneOff && !!modelId && oneOff.values.has(modelId)
            && items.findIndex((it) => it.modelId === modelId) === index;
          const isOneOff = showOneOff && !!oneOff?.values.get(modelId);
          const error = errorOf(index);
          return (
            <tr key={key} data-prow={index} className={error ? 'has-error' : ''}>
              <td className="pi-idx">{index + 1}</td>
              <td>
                <div className="pi-model">
                  {m ? (
                    <Swatch
                      color={m.color}
                      number={m.number}
                      photo={coverOf(m)}
                      style={{ width: 32, height: 36, fontSize: 12, borderRadius: 7, flexShrink: 0 }}
                    />
                  ) : (
                    <div className="item-swatch-empty"><Shirt size={16} strokeWidth={1.8} /></div>
                  )}
                  <div className="pi-model-tx">
                    <div className="pi-team capitalize">
                      {m ? <>{m.team}{m.number ? ` · ${m.number}` : ''}{m.player ? ` ${m.player}` : ''}</> : 'Cargando modelo…'}
                    </div>
                    {m && (
                      <div className="pi-sub capitalize">{[m.version, m.season, m.type].filter(Boolean).join(' · ')}</div>
                    )}
                    {showOneOff && (
                      <button
                        type="button"
                        className={`chip pi-oneoff${isOneOff ? ' is-active' : ''}`}
                        aria-pressed={isOneOff}
                        onClick={() => oneOff?.toggle(modelId, !isOneOff)}
                        title="Se oculta del inventario cuando se agota"
                      >
                        {isOneOff && <Check size={13} strokeWidth={2.2} />}
                        Compra puntual
                      </button>
                    )}
                    {error && <span className="field-error">{error}</span>}
                  </div>
                </div>
              </td>
              <td className="pi-size">
                <Controller
                  name={`items.${index}.size` as Path<T>}
                  control={control}
                  render={({ field: f }) => (
                    <SelectInput value={f.value ?? ''} onChange={f.onChange} options={sizesForType(m?.type)} placeholder="—" />
                  )}
                />
              </td>
              <td className="pi-qty">
                <Controller
                  name={`items.${index}.quantity` as Path<T>}
                  control={control}
                  render={({ field: f }) => (
                    <input
                      className="input mono"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      aria-label="Cantidad"
                      value={f.value ?? ''}
                      onChange={(e) => f.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                      onBlur={(e) => { if (e.target.value === '') f.onChange(1); }}
                    />
                  )}
                />
              </td>
              <td className="pi-price">
                <Controller
                  name={`items.${index}.basePriceUsd` as Path<T>}
                  control={control}
                  render={({ field: f }) => (
                    <MoneyInput prefix="US$" value={f.value ?? ''} onChange={f.onChange} placeholder="0" />
                  )}
                />
              </td>
              <td className="pi-del">
                <button className="iconbtn plain" type="button" aria-label="Quitar ítem" onClick={() => onRemove(index)}>
                  <X size={16} strokeWidth={1.8} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
