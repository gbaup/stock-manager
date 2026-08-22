'use client';

import { useState, useTransition } from 'react';
import { Swatch, coverOf } from '@/components/ui/swatch';
import { ModalFooter } from '@/components/ui/modal-footer';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import { todayISO } from '@/app/lib/format';
import { sellReservedItem } from '@/app/actions/reservations';
import { SaleMoneyFields } from '@/components/screens/sale-money-fields';

// Finalizes a reserved unit as a sale: same price/date/method/collector
// fields as editing a sale (saleEditSchema), since size/quantity are already
// fixed by the reserved unit itself.
export function ReservedSaleForm({
  model,
  item,
  users,
  onDone,
}: {
  model: ModelWithStats;
  item: { id: string; size: string; note: string | null };
  users: UserSummary[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('');
  const [description, setDescription] = useState('');
  const [collectedByUserId, setCollectedByUserId] = useState('');

  const canSave = parseFloat(price) > 0 && !!date && !!collectedByUserId;

  function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      try {
        await sellReservedItem(item.id, {
          price,
          date,
          method: method || undefined,
          description: description || undefined,
          collectedByUserId: collectedByUserId || undefined,
        });
        onDone();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Error al registrar la venta');
      }
    });
  }

  return (
    <>
      <div className="dm-body">
        <div className="detail-hero" style={{ marginBottom: 4 }}>
          <Swatch
            color={model.color}
            number={model.number}
            photo={coverOf(model)}
            style={{ width: 64, height: 74, fontSize: 24 }}
          />
          <div>
            <div className="detail-team" style={{ fontSize: 19 }}>{model.team}</div>
            <div className="detail-meta">
              {model.season} · {model.version} · Talle {item.size.toUpperCase()}
              {item.note ? ` · ${item.note}` : ''}
            </div>
          </div>
        </div>

        <SaleMoneyFields
          price={price}
          onPriceChange={setPrice}
          date={date}
          onDateChange={setDate}
          method={method}
          onMethodChange={setMethod}
          description={description}
          onDescriptionChange={setDescription}
          collectedByUserId={collectedByUserId}
          onCollectedByUserIdChange={setCollectedByUserId}
          users={users}
        />

        {saveError && (
          <div style={{ fontSize: 13, color: 'var(--danger)', margin: '8px 0', fontWeight: 600 }}>
            {saveError}
          </div>
        )}
      </div>
      <ModalFooter
        pending={pending}
        canSave={canSave}
        onCancel={onDone}
        onConfirm={handleSave}
        confirmLabel="Registrar venta"
        pendingLabel="Registrando…"
      />
    </>
  );
}
