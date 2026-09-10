'use client';

import { useState, useTransition } from 'react';
import { Search, X, ArrowLeftRight } from 'lucide-react';
import { Swatch, coverOf } from '@/components/ui/swatch';
import { Empty } from '@/components/ui/empty';
import { Field, MoneyInput, SelectInput, TextAreaInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { SizePicker } from '@/components/ui/size-picker';
import { Modal } from '@/components/ui/modal';
import { ModalFooter } from '@/components/ui/modal-footer';
import { METHODS, fmtType, matchesModel } from '@/app/lib/domain';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';
import { updateSale, cancelSale, swapSale } from '@/app/actions/sales';
import { useIsDesktop } from '@/app/lib/hooks';

// Edits an existing sale from the home list: price/date/method/collector,
// swapping the unit for another model or size (buyer changed their mind), or
// cancelling it (the unit returns to stock; the sale stays as history).
export function SaleEditForm({
  sale,
  models,
  users,
  onDone,
}: {
  sale: HomeSaleItem;
  models: ModelWithStats[];
  users: UserSummary[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<'edit' | 'swap'>('edit');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [price, setPrice] = useState(String(sale.price));
  const [date, setDate] = useState(sale.date);
  // sale.method is stored normalized (lowercase) — map it back to its METHODS
  // option so the select shows the current value.
  const [method, setMethod] = useState(
    () => METHODS.find((m) => m.toLowerCase() === (sale.method ?? '').toLowerCase()) ?? '',
  );
  const [description, setDescription] = useState(sale.description ?? '');
  const [collectedByUserId, setCollectedByUserId] = useState(sale.collectedByUserId ?? '');

  const [query, setQuery] = useState('');
  const [swapModelId, setSwapModelId] = useState('');
  const [swapSize, setSwapSize] = useState('');
  const [swapPrice, setSwapPrice] = useState(String(sale.price));

  const swapModel = models.find((m) => m.id === swapModelId) ?? null;
  const swapSizes = swapModel?.availableBySize ?? [];
  const sameUnit = swapModelId === sale.catalogProductId && swapSize === sale.size;
  const canSwap = !!swapModel && !!swapSize && parseFloat(swapPrice) > 0 && !sameUnit;
  const canSave = parseFloat(price) > 0 && !!date && !!collectedByUserId;

  const results = models
    .filter((m) => matchesModel(m, query))
    .sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || b.stock - a.stock)
    .slice(0, 50);

  function run(action: () => Promise<void>, fallback: string) {
    setSaveError(null);
    startTransition(async () => {
      try {
        await action();
        onDone();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : fallback);
      }
    });
  }

  const handleSave = () => run(
    () => updateSale(sale.id, {
      price,
      date,
      method: method || undefined,
      description: description || undefined,
      collectedByUserId: collectedByUserId || undefined,
    }),
    'Error al guardar la venta',
  );

  const handleSwap = () => run(
    () => swapSale(sale.id, { modelId: swapModelId, size: swapSize, price: swapPrice }),
    'Error al cambiar la venta',
  );

  const handleCancelSale = () => run(
    () => cancelSale(sale.id),
    'Error al anular la venta',
  );

  const collectedByAlias = users.find((u) => u.id === collectedByUserId)?.alias ?? '';

  const errorLine = saveError && (
    <div style={{ fontSize: 13, color: 'var(--danger)', margin: '8px 0', fontWeight: 600 }}>
      {saveError}
    </div>
  );

  if (view === 'swap') {
    return (
      <>
        <div className="dm-body">
          <div className="section-label" style={{ marginTop: 6 }}>¿Por cuál la cambiás?</div>
          {!swapModel ? (
            <>
              <div className="search">
                <Search size={19} strokeWidth={1.8} />
                <input
                  value={query}
                  autoFocus={isDesktop}
                  placeholder="Buscá equipo, jugador, color…"
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="iconbtn plain"
                    style={{ width: 26, height: 26 }}
                    onClick={() => setQuery('')}
                  >
                    <X size={16} strokeWidth={1.8} />
                  </button>
                )}
              </div>

              <div className="qs-results">
                {results.length === 0 ? (
                  <Empty title="Sin resultados" desc="Probá con otro nombre." icon="search" />
                ) : (
                  results.map((m) => (
                    <button
                      key={m.id}
                      className="qs-result"
                      disabled={m.stock === 0}
                      onClick={() => {
                        if (m.stock === 0) return;
                        setSwapModelId(m.id);
                        setSwapSize(m.availableBySize.length === 1 ? m.availableBySize[0].size : '');
                      }}
                    >
                      <Swatch
                        color={m.color}
                        number={m.number}
                        photo={coverOf(m)}
                        className="sale-sw"
                        style={{ width: 38, height: 44, fontSize: 14 }}
                      />
                      <div className="qs-r-main">
                        <div className="qs-r-team capitalize">{m.team}</div>
                        <div className="qs-r-meta">
                          {m.season} · {m.version} · {fmtType(m.type)}
                          {m.number ? ` · ${m.number}` : ''}{m.player ? ` · ${m.player}` : ''}
                        </div>
                      </div>
                      <div
                        className="qs-r-stock"
                        style={{ color: m.stock === 0 ? 'var(--text-faint)' : 'var(--text)' }}
                      >
                        <span className="qsr-n">{m.stock}</span>
                        <span className="qsr-l">{m.stock === 0 ? 'sin stock' : 'stock'}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <button
                className="qs-picked"
                onClick={() => { setSwapModelId(''); setSwapSize(''); }}
              >
                <Swatch
                  color={swapModel.color}
                  number={swapModel.number}
                  photo={coverOf(swapModel)}
                  style={{ width: 56, height: 64, fontSize: 21 }}
                />
                <div className="qs-p-main">
                  <div className="qs-p-team">{swapModel.team}</div>
                  <div className="qs-p-meta">
                    {swapModel.season} · {swapModel.version} · {swapModel.stock} en stock
                  </div>
                </div>
                <span className="qs-change">Cambiar</span>
              </button>

              <Field label="Talle">
                <SizePicker availableBySize={swapSizes} value={swapSize} onChange={setSwapSize} />
              </Field>
              {sameUnit && (
                <div style={{ fontSize: 12.5, color: 'var(--danger)', margin: '-6px 2px 12px' }}>
                  Es la misma camiseta y talle de la venta actual.
                </div>
              )}
              <Field label="Precio de venta (UYU)">
                <MoneyInput value={swapPrice} onChange={setSwapPrice} placeholder="2200" />
              </Field>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -6 }}>
                La unidad anterior vuelve al stock. Fecha, método y cobro se mantienen.
              </div>
            </>
          )}
          {errorLine}
        </div>
        <ModalFooter
          pending={pending}
          canSave={canSwap}
          onCancel={() => { setView('edit'); setSaveError(null); }}
          onConfirm={handleSwap}
          confirmLabel="Confirmar cambio"
          pendingLabel="Cambiando…"
        />
      </>
    );
  }

  return (
    <>
      <div className="dm-body">
        <div className="section-label" style={{ marginTop: 6 }}>Venta</div>
        <Field label="Precio de venta (UYU)">
          <MoneyInput value={price} onChange={setPrice} placeholder="2200" />
        </Field>
        <Field label="Fecha">
          <input
            className="input mono"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Método de pago" optional>
          <SelectInput
            value={method}
            onChange={setMethod}
            options={METHODS}
            placeholder="Elegí un método…"
          />
        </Field>

        <div className="section-label">Cobro</div>
        <Field label="¿Quién cobró?">
          <Segmented
            options={users.map((u) => u.alias)}
            value={collectedByAlias}
            onChange={(alias) =>
              setCollectedByUserId(users.find((u) => u.alias === alias)?.id ?? '')
            }
            full
          />
        </Field>

        <Field label="Descripción" optional>
          <TextAreaInput
            value={description}
            onChange={setDescription}
            placeholder="Comprador, notas…"
          />
        </Field>

        <button
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setView('swap')}
        >
          <ArrowLeftRight size={15} strokeWidth={2} />
          Cambiar por otra camiseta
        </button>

        <button
          className="btn"
          style={{ width: '100%', marginTop: 8, color: 'var(--danger)', background: 'var(--danger-soft)' }}
          onClick={() => setConfirmCancel(true)}
        >
          Anular venta
        </button>
        {errorLine}
      </div>
      <ModalFooter
        pending={pending}
        canSave={canSave}
        onCancel={onDone}
        onConfirm={handleSave}
        confirmLabel="Guardar"
        pendingLabel="Guardando…"
      />

      {confirmCancel && (
        <Modal
          icon="trash"
          tone="danger"
          title="¿Anular esta venta?"
          confirmLabel="Anular venta"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => { setConfirmCancel(false); handleCancelSale(); }}
        >
          La unidad vuelve al stock y la venta queda anulada en el historial.
        </Modal>
      )}
    </>
  );
}
