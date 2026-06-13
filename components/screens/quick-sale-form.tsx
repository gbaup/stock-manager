'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormHead } from '@/components/ui/chrome';
import { Icon } from '@/components/ui/icon';
import { Swatch } from '@/components/ui/swatch';
import { Empty } from '@/components/ui/empty';
import { Field, TextInput, MoneyInput, SelectInput, TextAreaInput } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { uyu, usd } from '@/app/lib/format';
import { money } from '@/app/lib/money';
import { METHODS } from '@/app/lib/domain';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import { createSaleFromHome } from '@/app/actions/sales';

export function QuickSaleForm({
  models,
  users,
  usdRate,
  sessionUserId,
}: {
  models: ModelWithStats[];
  users: UserSummary[];
  usdRate: number;
  sessionUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [selectedModelId, setSelectedModelId] = useState('');
  const [query, setQuery] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [date, setDate] = useState('');
  const [method, setMethod] = useState('');
  const [description, setDescription] = useState('');
  const [collectedByUserId, setCollectedByUserId] = useState(sessionUserId);
  const [saveError, setSaveError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDate(new Date().toISOString().split('T')[0]); }, []);

  const model = models.find((m) => m.id === selectedModelId) ?? null;
  const stock = model?.stock ?? 0;
  const priceNum = parseFloat(price) || 0;
  const qty = parseInt(quantity, 10) || 0;

  const canSave = !!model && priceNum > 0 && qty > 0 && qty <= stock && !!collectedByUserId;

  const q = query.trim().toLowerCase();
  const results = models
    .filter((m) => {
      if (!q) return true;
      return [m.team, m.season, m.version, m.color, m.player, m.number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || b.stock - a.stock)
    .slice(0, 7);

  function handleSave() {
    if (!canSave || !model) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        await createSaleFromHome(model.id, {
          price,
          quantity,
          date,
          method: method || undefined,
          description: description || undefined,
          collectedByUserId,
        });
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Error al registrar la venta');
      }
    });
  }

  function selectModel(m: ModelWithStats) {
    setSelectedModelId(m.id);
  }

  const collectedByAlias = users.find((u) => u.id === collectedByUserId)?.alias ?? '';

  return (
    <div className="screen">
      <FormHead
        onCancel={() => router.push('/home')}
        title="Registrar venta"
        onSave={handleSave}
        saveLabel="Registrar"
        canSave={canSave && !pending}
      />
      <div className="body">
        <div className="body-pad">
          {!model ? (
            <>
              <div className="section-label" style={{ marginTop: 6 }}>¿Qué camiseta vendés?</div>
              <div className="search">
                <Icon name="search" size={19} />
                <input
                  value={query}
                  autoFocus
                  placeholder="Buscá equipo, jugador, color…"
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="iconbtn plain"
                    style={{ width: 26, height: 26 }}
                    onClick={() => setQuery('')}
                  >
                    <Icon name="x" size={16} />
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
                      onClick={() => m.stock > 0 && selectModel(m)}
                    >
                      <Swatch
                        color={m.color}
                        number={m.number}
                        className="sale-sw"
                        style={{ width: 38, height: 44, fontSize: 14 }}
                      />
                      <div className="qs-r-main">
                        <div className="qs-r-team">{m.team}</div>
                        <div className="qs-r-meta">
                          {m.season} · {m.version} · {m.color}
                          {m.player ? ` · ${m.player}` : ''}
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
              <button className="qs-picked" onClick={() => setSelectedModelId('')}>
                <Swatch
                  color={model.color}
                  number={model.number}
                  style={{ width: 56, height: 64, fontSize: 21 }}
                />
                <div className="qs-p-main">
                  <div className="qs-p-team">{model.team}</div>
                  <div className="qs-p-meta">
                    {model.season} · {model.version} · {stock} en stock
                  </div>
                </div>
                <span className="qs-change">Cambiar</span>
              </button>

              <div className="section-label">Venta</div>
              <Field label="Precio de venta (UYU)">
                <MoneyInput value={price} onChange={setPrice} placeholder="2200" />
              </Field>
              {priceNum > 0 && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text-faint)',
                    margin: '-6px 2px 12px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ≈ {usd(money.toUsd(priceNum, usdRate))} · total {uyu(priceNum * qty)}
                </div>
              )}

              <div className="field-row">
                <Field label="Cantidad">
                  <TextInput
                    value={quantity}
                    onChange={(v) => setQuantity(v.replace(/[^\d]/g, ''))}
                    mono
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Fecha">
                  <input
                    className="input mono"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>
              {qty > stock && stock > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--danger)', margin: '-6px 2px 12px' }}>
                  Solo hay {stock} en stock.
                </div>
              )}

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
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  marginTop: -6,
                  marginBottom: 10,
                }}
              >
                Suma al saldo en mano de quien recibe la plata.
              </div>

              <Field label="Descripción" optional>
                <TextAreaInput
                  value={description}
                  onChange={setDescription}
                  placeholder="Comprador, notas…"
                />
              </Field>

              {saveError && (
                <div style={{ fontSize: 13, color: 'var(--danger)', margin: '8px 0', fontWeight: 600 }}>
                  {saveError}
                </div>
              )}
              <button
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                disabled={!canSave || pending}
                onClick={handleSave}
              >
                Registrar venta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
