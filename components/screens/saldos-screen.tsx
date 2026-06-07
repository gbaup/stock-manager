'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar, BottomNav } from '@/components/ui/chrome';
import { Empty } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import {
  uyu, usd, fmtDate, signedUyu, signedUsd,
  personInitial, buildMovements, balancesByPerson, PEOPLE,
} from '@/app/lib/domain';
import type { Movement, PersonBalance, BatchSummary, ExpenseRecord } from '@/app/lib/domain';

type SaleRow = { id: string; date: string; price: number; collectedBy: string | null; quantity: number; model: string };
type Layout = 'resumen' | 'saldar' | 'planilla';

const KIND_LABELS: Record<string, string> = {
  cobro: 'Cobro',
  'pago-prov': 'Proveedor',
  'pago-envio': 'Envío',
  gasto: 'Gasto',
};

const KIND_COLORS: Record<string, string> = {
  cobro: 'var(--accent)',
  'pago-prov': 'var(--text-faint)',
  'pago-envio': 'oklch(0.55 0.11 60)',
  gasto: 'var(--danger)',
};

function signClass(n: number): string {
  if (n > 0) return 'pos';
  if (n < 0) return 'neg';
  return 'zero';
}

export function SaldosScreen({
  purchases,
  sales,
  expenses,
  transitCount,
}: {
  purchases: BatchSummary[];
  sales: SaleRow[];
  expenses: ExpenseRecord[];
  transitCount: number;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>('resumen');

  const movements = buildMovements({ sales, purchases, expenses });
  const balances = balancesByPerson(movements);

  const totalUyu = PEOPLE.reduce((s, p) => s + (balances[p]?.uyu ?? 0), 0);
  const totalUsd = PEOPLE.reduce((s, p) => s + (balances[p]?.usd ?? 0), 0);

  return (
    <div className="screen">
      <TopBar
        eyebrow="STOCKCONTROL"
        title="Saldos"
        sub={`Plata en mano de cada socio · ${movements.length} movimientos`}
      />
      <div className="body">
        <div className="body-pad">
          <div style={{ marginBottom: 14 }}>
            <Segmented
              options={['resumen', 'saldar', 'planilla'] as const}
              value={layout}
              onChange={(v) => setLayout(v as Layout)}
              full
            />
          </div>

          {layout === 'resumen' && (
            <CardsHeader balances={balances} totalUyu={totalUyu} totalUsd={totalUsd} />
          )}
          {layout === 'saldar' && (
            <SettleHeader balances={balances} />
          )}
          {layout === 'planilla' && (
            <LedgerHeader balances={balances} movements={movements} />
          )}

          {layout !== 'planilla' && (
            <>
              <div className="section-label">Movimientos</div>
              {movements.length === 0 ? (
                <Empty icon="wallet" title="Sin movimientos" desc="Registrá un cobro, una compra o un gasto." />
              ) : (
                <div className="mov-list">
                  {movements.map((m) => <MovCard key={m.id} m={m} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <button className="fab" onClick={() => router.push('/saldos/expense/new')} aria-label="Agregar gasto">
        <Icon name="plus" size={26} strokeWidth={2.2} />
      </button>
      <BottomNav transitCount={transitCount} />
    </div>
  );
}

function BalAvatar({ person }: { person: string }) {
  return <div className="bal-avatar">{personInitial(person)}</div>;
}

function BalVal({ n, currency }: { n: number; currency: 'uyu' | 'usd' }) {
  const cls = signClass(n);
  const formatted = currency === 'uyu' ? uyu(Math.abs(n)) : usd(Math.abs(n));
  return (
    <span className={`bal-val ${cls}`}>
      {n < 0 ? '− ' : n > 0 ? '+ ' : ''}{formatted}
    </span>
  );
}

function CardsHeader({
  balances,
  totalUyu,
  totalUsd,
}: {
  balances: Record<string, PersonBalance>;
  totalUyu: number;
  totalUsd: number;
}) {
  return (
    <>
      <div className="biz-strip">
        <span>Caja del negocio</span>
        <span className="val">
          {signedUyu(totalUyu)}
          {totalUsd !== 0 && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-faint)' }}>· {signedUsd(totalUsd)}</span>}
        </span>
      </div>
      <div className="bal-cards">
        {PEOPLE.map((person) => {
          const b = balances[person];
          return (
            <div key={person} className="bal-card">
              <div className="bal-card-head">
                <BalAvatar person={person} />
                <div>
                  <div className="bal-name">{person}</div>
                  <div className="bal-sub">plata en mano</div>
                </div>
              </div>
              <div className="bal-row">
                <div>
                  <div className="bal-lbl">Pesos</div>
                  <div className="bal-breakdown">+ {uyu(b.inUyu)} / − {uyu(b.outUyu)}</div>
                </div>
                <BalVal n={b.uyu} currency="uyu" />
              </div>
              {(b.inUsd > 0 || b.outUsd > 0) && (
                <div className="bal-row">
                  <div>
                    <div className="bal-lbl">Dólares</div>
                    <div className="bal-breakdown">+ {usd(b.inUsd)} / − {usd(b.outUsd)}</div>
                  </div>
                  <BalVal n={b.usd} currency="usd" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function SettleHeader({ balances }: { balances: Record<string, PersonBalance> }) {
  const [p1, p2] = PEOPLE;
  const b1 = balances[p1];
  const b2 = balances[p2];

  const diffUyu = b1.uyu - b2.uyu;
  const diffUsd = b1.usd - b2.usd;
  const halfUyu = Math.abs(diffUyu) / 2;
  const halfUsd = Math.abs(diffUsd) / 2;
  const fromUyu = diffUyu > 0 ? p2 : p1;
  const toUyu   = diffUyu > 0 ? p1 : p2;
  const fromUsd = diffUsd > 0 ? p2 : p1;
  const toUsd   = diffUsd > 0 ? p1 : p2;
  const evenUyu = Math.abs(diffUyu) < 1;
  const evenUsd = Math.abs(diffUsd) < 0.01;

  return (
    <>
      <div className="settle">
        <div className="settle-title">Para emparejar la caja</div>
        {evenUyu && evenUsd ? (
          <div className="settle-even">
            <Icon name="check" size={18} />
            Están a la par
          </div>
        ) : (
          <>
            {!evenUyu && (
              <div className="settle-row">
                <span>{fromUyu}</span>
                <Icon name="chevR" size={18} className="settle-arrow" />
                <span>{toUyu}</span>
                <span className="settle-amt">{uyu(halfUyu)}</span>
              </div>
            )}
            {!evenUsd && (
              <div className="settle-row">
                <span>{fromUsd}</span>
                <Icon name="chevR" size={18} className="settle-arrow" />
                <span>{toUsd}</span>
                <span className="settle-amt">{usd(halfUsd)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="bal-mini-list">
        {PEOPLE.map((person) => {
          const b = balances[person];
          return (
            <div key={person} className="bal-mini">
              <BalAvatar person={person} />
              <span className="bal-mini-name">{person}</span>
              <BalVal n={b.uyu} currency="uyu" />
              {(b.inUsd > 0 || b.outUsd > 0) && (
                <span style={{ marginLeft: 8 }}>
                  <BalVal n={b.usd} currency="usd" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function LedgerHeader({
  balances,
  movements,
}: {
  balances: Record<string, PersonBalance>;
  movements: Movement[];
}) {
  return (
    <>
      <div className="ledger-head">
        {PEOPLE.map((person) => {
          const b = balances[person];
          return (
            <div key={person} className="ledger-col">
              <div className="bal-avatar" style={{ margin: '0 auto 8px' }}>{personInitial(person)}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{person}</div>
              <div className={`bal-val ${signClass(b.uyu)}`} style={{ fontSize: 15 }}>{signedUyu(b.uyu)}</div>
              {(b.inUsd > 0 || b.outUsd > 0) && (
                <div className={`bal-val ${signClass(b.usd)}`} style={{ fontSize: 12, marginTop: 2 }}>{signedUsd(b.usd)}</div>
              )}
            </div>
          );
        })}
      </div>

      {movements.length === 0 ? (
        <Empty icon="wallet" title="Sin movimientos" desc="Registrá un cobro, una compra o un gasto." />
      ) : (
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Socio</th>
              <th style={{ textAlign: 'right' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>
                  <span
                    className="lkind-dot"
                    style={{ background: KIND_COLORS[m.kind] }}
                  />
                  <span style={{ fontWeight: 600 }}>{m.title}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    {fmtDate(m.date)} · {KIND_LABELS[m.kind]}
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{m.person}</td>
                <td style={{ textAlign: 'right' }}>
                  {m.uyu !== 0 && (
                    <span className={`mov-chip ${signClass(m.uyu)}`} style={{ display: 'block' }}>
                      {m.uyu > 0 ? '+' : '−'}{uyu(Math.abs(m.uyu))}
                    </span>
                  )}
                  {m.usd !== 0 && (
                    <span className={`mov-chip ${signClass(m.usd)}`} style={{ display: 'block', marginTop: 2 }}>
                      {m.usd > 0 ? '+' : '−'}{usd(Math.abs(m.usd))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function MovCard({ m }: { m: Movement }) {
  const hasUyu = m.uyu !== 0;
  const hasUsd = m.usd !== 0;
  return (
    <div className="mov">
      <div className={`mov-ico ${m.kind}`}>
        <Icon
          name={
            m.kind === 'cobro' ? 'tag'
            : m.kind === 'pago-prov' ? 'box'
            : m.kind === 'pago-envio' ? 'truck'
            : 'receipt'
          }
          size={16}
        />
      </div>
      <div className="mov-main">
        <div className="mov-title">{m.title}</div>
        <div className="mov-sub">
          {fmtDate(m.date)} · <strong>{m.person}</strong> · {m.sub}
        </div>
      </div>
      <div className="mov-chips">
        {hasUyu && (
          <span className={`mov-chip ${signClass(m.uyu)}`}>
            {m.uyu > 0 ? '+' : '−'}{uyu(Math.abs(m.uyu))}
          </span>
        )}
        {hasUsd && (
          <span className={`mov-chip ${signClass(m.usd)}`}>
            {m.usd > 0 ? '+' : '−'}{usd(Math.abs(m.usd))}
          </span>
        )}
      </div>
    </div>
  );
}
