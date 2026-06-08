'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar, BottomNav } from '@/components/ui/chrome';
import { Empty } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import {
  uyu, usd, fmtDate, personInitial,
} from '@/app/lib/domain';
import type { UserSummary } from '@/app/lib/domain';
import { buildMovements, balancesByPerson, balanceTotals, hasUsdActivity, settleBalances } from '@/app/lib/ledger';
import type { Movement, PersonBalance } from '@/app/lib/ledger';
import type { BatchSummary, ExpenseRecord, ConversionRecord, AdjustmentRecord } from '@/app/lib/domain';

type SaleRow = { id: string; date: string; price: number; collectedByUserId: string | null; collectedByAlias: string | null; quantity: number; model: string };
type Layout = 'resumen' | 'saldar' | 'planilla';

function signClass(n: number) {
  return n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero';
}

function fmtSigned(fmt: (n: number) => string, n: number) {
  if (n === 0) return fmt(0);
  return (n > 0 ? '+ ' : '− ') + fmt(Math.abs(n));
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {personInitial(name)}
    </div>
  );
}

export function SaldosScreen({
  purchases,
  sales,
  expenses,
  conversions,
  adjustments,
  transitCount,
  users,
}: {
  purchases: BatchSummary[];
  sales: SaleRow[];
  expenses: ExpenseRecord[];
  conversions: ConversionRecord[];
  adjustments: AdjustmentRecord[];
  transitCount: number;
  users: UserSummary[];
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>('resumen');

  const movements = buildMovements({ sales, purchases, expenses, conversions, adjustments });
  const balances = balancesByPerson(movements, users);
  const { uyu: totalUyu, usd: totalUsd } = balanceTotals(balances, users);

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
            <CardsHeader balances={balances} totalUyu={totalUyu} totalUsd={totalUsd} users={users} />
          )}
          {layout === 'saldar' && (
            <SettleHeader balances={balances} totalUyu={totalUyu} totalUsd={totalUsd} users={users} />
          )}
          {layout === 'planilla' && (
            <LedgerLayout balances={balances} movements={movements} users={users} />
          )}

          {layout !== 'planilla' && (
            <>
              <button className="conv-action" onClick={() => router.push('/saldos/cambio/new')}>
                <span className="conv-ico"><Icon name="swap" size={18} strokeWidth={2} /></span>
                <span className="conv-tx">
                  <span className="conv-t">Cambiar monedas</span>
                  <span className="conv-s">Entre socios y/o de pesos a dólares, a un TC a mano</span>
                </span>
                <Icon name="chevR" size={18} strokeWidth={1.8} />
              </button>

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

function CardsHeader({
  balances, totalUyu, totalUsd, users,
}: {
  balances: Record<string, PersonBalance>;
  totalUyu: number;
  totalUsd: number;
  users: UserSummary[];
}) {
  const hasUsd = users.some((u) => {
    const b = balances[u.alias];
    return b ? hasUsdActivity(b) : false;
  });

  return (
    <>
      <div className="biz-strip">
        <div className="biz-l">Caja del negocio</div>
        <div className="biz-figs">
          <span className={`biz-amt ${signClass(totalUyu)}`}>{fmtSigned(uyu, totalUyu)}</span>
          {hasUsd && (
            <span className={`biz-amt sec ${signClass(totalUsd)}`}>{fmtSigned(usd, totalUsd)}</span>
          )}
        </div>
      </div>

      <div className="bal-cards">
        {users.map((user) => {
          const b = balances[user.alias] ?? { uyu: 0, usd: 0, inUyu: 0, outUyu: 0, inUsd: 0, outUsd: 0 };
          const showUsd = hasUsdActivity(b);
          return (
            <div key={user.id} className="bal-card">
              <div className="bal-head">
                <Avatar name={user.alias} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bal-name">{user.alias}</div>
                  <div className="bal-sub">plata en mano</div>
                </div>
              </div>
              <div className="bal-figs">
                <div className="bal-fig">
                  <div className="cur">Pesos</div>
                  <div className={`amt ${signClass(b.uyu)}`}>{fmtSigned(uyu, b.uyu)}</div>
                  <div className="bal-break">
                    <span>+{new Intl.NumberFormat('es-UY').format(Math.round(b.inUyu))}</span>
                    <span>−{new Intl.NumberFormat('es-UY').format(Math.round(b.outUyu))}</span>
                  </div>
                </div>
                {showUsd && (
                  <div className="bal-fig">
                    <div className="cur">Dólares</div>
                    <div className={`amt ${signClass(b.usd)}`}>{fmtSigned(usd, b.usd)}</div>
                    <div className="bal-break">
                      <span>+{new Intl.NumberFormat('es-UY').format(Math.round(b.inUsd))}</span>
                      <span>−{new Intl.NumberFormat('es-UY').format(Math.round(b.outUsd))}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SettleHeader({
  balances, totalUyu, totalUsd, users,
}: {
  balances: Record<string, PersonBalance>;
  totalUyu: number;
  totalUsd: number;
  users: UserSummary[];
}) {
  const hasUsd = users.some((u) => {
    const b = balances[u.alias];
    return b ? hasUsdActivity(b) : false;
  });
  const transfers = settleBalances(balances, users);

  return (
    <>
      <div className="biz-strip">
        <div className="biz-l">Caja del negocio</div>
        <div className="biz-figs">
          <span className={`biz-amt ${signClass(totalUyu)}`}>{fmtSigned(uyu, totalUyu)}</span>
          {hasUsd && (
            <span className={`biz-amt sec ${signClass(totalUsd)}`}>{fmtSigned(usd, totalUsd)}</span>
          )}
        </div>
      </div>

      <div className="settle">
        <div className="settle-eyebrow">
          <Icon name="swap" size={14} />
          Para emparejar la caja
        </div>
        {transfers.length === 0 ? (
          <div className="settle-eq">
            <Icon name="check" size={16} />
            Están a la par
          </div>
        ) : (
          <>
            {transfers.map((t, i) => (
              <div key={i} className="settle-row">
                <div className="settle-flow">
                  <span>{t.from}</span>
                  <Icon name="chevR" size={16} />
                  <span>{t.to}</span>
                </div>
                <span className="settle-amt">{t.currency === 'USD' ? usd(t.amount) : uyu(t.amount)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="bal-mini-list">
        {users.map((user) => {
          const b = balances[user.alias] ?? { uyu: 0, usd: 0, inUyu: 0, outUyu: 0, inUsd: 0, outUsd: 0 };
          const showUsd = hasUsdActivity(b);
          return (
            <div key={user.id} className="bal-mini">
              <Avatar name={user.alias} size={34} />
              <div className="bal-mini-name">{user.alias}</div>
              <div className="bal-mini-figs">
                <span className={`amt ${signClass(b.uyu)}`}>{fmtSigned(uyu, b.uyu)}</span>
                {showUsd && (
                  <span className={`amt sec ${signClass(b.usd)}`}>{fmtSigned(usd, b.usd)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ConvActionButton() {
  const router = useRouter();
  return (
    <button className="conv-action" onClick={() => router.push('/saldos/cambio/new')}>
      <span className="conv-ico"><Icon name="swap" size={18} strokeWidth={2} /></span>
      <span className="conv-tx">
        <span className="conv-t">Cambiar monedas</span>
        <span className="conv-s">Entre socios y/o de pesos a dólares, a un TC a mano</span>
      </span>
      <Icon name="chevR" size={18} strokeWidth={1.8} />
    </button>
  );
}

function LedgerLayout({
  balances, movements, users,
}: {
  balances: Record<string, PersonBalance>;
  movements: Movement[];
  users: UserSummary[];
}) {
  const hasUsd = users.some((u) => {
    const b = balances[u.alias];
    return b ? hasUsdActivity(b) : false;
  });

  return (
    <>
      <div className="ledger-head">
        {users.map((user) => {
          const b = balances[user.alias] ?? { uyu: 0, usd: 0, inUyu: 0, outUyu: 0, inUsd: 0, outUsd: 0 };
          return (
            <div key={user.id} className="lh-col">
              <div className="lh-name"><Avatar name={user.alias} size={26} />{user.alias}</div>
              <div className={`lh-amt ${signClass(b.uyu)}`}>{fmtSigned(uyu, b.uyu)}</div>
              {hasUsd && (
                <div className={`lh-amt sec ${signClass(b.usd)}`}>{fmtSigned(usd, b.usd)}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 10 }}><ConvActionButton /></div>

      {movements.length === 0 ? (
        <Empty icon="wallet" title="Sin movimientos" desc="Registrá un cobro, una compra o un gasto." />
      ) : (
        <div className="ledger">
          <div className="ledger-th">
            <span style={{ flex: 1 }}>Concepto</span>
            <span style={{ width: 56 }}>Socio</span>
            <span style={{ width: 86, textAlign: 'right' }}>Monto</span>
          </div>
          {movements.map((m) => <LedgerRow key={m.id} m={m} />)}
        </div>
      )}
    </>
  );
}

const KIND_DOT_CLASS: Record<string, string> = {
  cobro: 'cobro',
  'pago-prov': 'prov',
  'pago-envio': 'envio',
  gasto: 'gasto',
  cambio: 'cambio',
};

function LedgerRow({ m }: { m: Movement }) {
  const isConv = m.kind === 'cambio' && m.conv;
  const dotCls = KIND_DOT_CLASS[m.kind] ?? '';

  const chips = isConv && m.conv
    ? [
      { cur: m.conv.fromCur, n: -(m.conv.fromAmount) },
      { cur: m.conv.toCur, n: +(m.conv.toAmount) },
    ]
    : m.uyu !== 0 || m.usd !== 0
      ? [
        ...(m.uyu !== 0 ? [{ cur: 'UYU' as const, n: m.uyu }] : []),
        ...(m.usd !== 0 ? [{ cur: 'USD' as const, n: m.usd }] : []),
      ]
      : [];

  const convFlow = isConv && m.conv
    ? m.conv.fromUserAlias !== m.conv.toUserAlias
      ? `${m.conv.fromUserAlias} → ${m.conv.toUserAlias}`
      : m.conv.fromUserAlias
    : null;

  return (
    <div className="lrow">
      <div className="lrow-main">
        <div className="lrow-title">
          <span className={`lrow-dot ${dotCls}`} />
          {m.title}
        </div>
        <div className="lrow-sub">
          {fmtDate(m.date)} · {isConv && convFlow ? convFlow : m.sub || m.person}
          {isConv && m.conv && m.sub ? ` · ${m.sub}` : ''}
        </div>
      </div>
      <div className="lrow-person">{isConv ? '—' : (m.person || '—')}</div>
      <div className="lrow-amt">
        {chips.map((pt, i) => (
          <span key={i} className={`amt ${signClass(pt.n)}`}>
            {fmtSigned(pt.cur === 'USD' ? usd : uyu, pt.n)}
          </span>
        ))}
      </div>
    </div>
  );
}

const MOV_ICO_CLASS: Record<string, string> = {
  cobro: 'cobro',
  'pago-prov': 'prov',
  'pago-envio': 'envio',
  gasto: 'gasto',
  cambio: 'cambio',
};

const MOV_ICON: Record<string, Parameters<typeof Icon>[0]['name']> = {
  cobro: 'tag',
  'pago-prov': 'box',
  'pago-envio': 'truck',
  gasto: 'receipt',
  cambio: 'swap',
};

function MovCard({ m }: { m: Movement }) {
  const isConv = m.kind === 'cambio' && m.conv;
  const icoCls = MOV_ICO_CLASS[m.kind] ?? '';
  const iconName = MOV_ICON[m.kind] ?? 'receipt';

  const chips = isConv && m.conv
    ? [
      { cur: m.conv.fromCur, n: -(m.conv.fromAmount) },
      { cur: m.conv.toCur, n: +(m.conv.toAmount) },
    ]
    : [
      ...(m.uyu !== 0 ? [{ cur: 'UYU' as const, n: m.uyu }] : []),
      ...(m.usd !== 0 ? [{ cur: 'USD' as const, n: m.usd }] : []),
    ];

  const convFlow = isConv && m.conv
    ? m.conv.fromUserAlias !== m.conv.toUserAlias
      ? `${m.conv.fromUserAlias} → ${m.conv.toUserAlias}`
      : m.conv.fromUserAlias
    : null;

  return (
    <div className="mov">
      <div className={`mov-ico ${icoCls}`}>
        <Icon name={iconName} size={17} strokeWidth={1.8} />
      </div>
      <div className="mov-main">
        <div className="mov-title capitalize">{m.title}</div>
        <div className="mov-sub">
          {fmtDate(m.date)} ·{' '}
          {isConv && convFlow ? (
            <><strong>{convFlow}</strong>{m.sub ? ` · ${m.sub}` : ''}</>
          ) : (
            <><strong>{m.person || '—'}</strong>{m.sub ? ` · ${m.sub}` : ''}</>
          )}
        </div>
      </div>
      <div className="mov-amt">
        {chips.map((pt, i) => (
          <span key={i} className={`amt ${signClass(pt.n)}`}>
            {fmtSigned(pt.cur === 'USD' ? usd : uyu, pt.n)}
          </span>
        ))}
      </div>
    </div>
  );
}
