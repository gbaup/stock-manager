'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar, BottomNav, Sidebar } from '@/components/ui/chrome';
import { Empty } from '@/components/ui/empty';
import { Plus, ArrowLeftRight, Check, ChevronRight, Tag as TagIcon, Package, Truck, Receipt } from 'lucide-react';
import type { ComponentType } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { uyu, usd, fmtDate, personInitial } from '@/app/lib/format';
import { useIsDesktop } from '@/app/lib/hooks';
import { DModal } from '@/components/ui/d-modal';
import { GastoForm } from '@/components/screens/gasto-form';
import { ConversionForm } from '@/components/screens/conversion-form';
import type { UserSummary } from '@/app/lib/domain';
import { hasUsdActivity } from '@/app/lib/ledger';
import type { Movement, PersonBalance, SettleTransfer } from '@/app/lib/ledger';

const KIND_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'cobro', label: 'Cobros' },
  { id: 'pago-prov', label: 'Proveedor' },
  { id: 'pago-envio', label: 'Envíos' },
  { id: 'gasto', label: 'Gastos' },
  { id: 'cambio', label: 'Cambios' },
] as const;

const KIND_LABEL: Record<string, string> = {
  cobro: 'Cobro',
  'pago-prov': 'Proveedor',
  'pago-envio': 'Envío',
  gasto: 'Gasto',
  cambio: 'Cambio',
  ajuste: 'Ajuste',
};

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
  movements,
  balances,
  totals,
  settle,
  users,
  transitCount,
}: {
  movements: Movement[];
  balances: Record<string, PersonBalance>;
  totals: { uyu: number; usd: number };
  settle: SettleTransfer[];
  users: UserSummary[];
  transitCount: number;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [layout, setLayout] = useState<Layout>('resumen');
  const [movFilter, setMovFilter] = useState<'todos' | 'entradas' | 'salidas'>('todos');
  const [kindFilter, setKindFilter] = useState('todos');
  const [showGasto, setShowGasto] = useState(false);
  const [showConversion, setShowConversion] = useState(false);

  const { uyu: totalUyu, usd: totalUsd } = totals;

  const filteredMovements = movements.filter((m) => {
    if (movFilter === 'entradas') return m.uyu > 0 || m.usd > 0;
    if (movFilter === 'salidas') return m.uyu < 0 || m.usd < 0;
    return true;
  });

  if (isDesktop) {
    const hasUsd = users.some((u) => {
      const b = balances[u.alias];
      return b ? hasUsdActivity(b) : false;
    });
    const ledgerMoves = kindFilter === 'todos'
      ? movements
      : movements.filter((m) => m.kind === kindFilter);

    return (
      <div className="screen">
        <header className="main-header">
          <div className="mh-left">
            <div className="mh-title">Saldos</div>
            <div className="mh-sub">Plata en mano de cada socio · {movements.length} movimientos</div>
          </div>
          <div className="mh-actions">
            <button className="btn btn-secondary" onClick={() => setShowConversion(true)}>
              <ArrowLeftRight size={15} strokeWidth={1.8} />
              Cambiar monedas
            </button>
            <button className="btn btn-primary" onClick={() => setShowGasto(true)}>
              <Plus size={16} strokeWidth={2} />
              Nuevo gasto
            </button>
          </div>
        </header>

        <div className="page page-fixed">
          <div className="bal-grid shrink-0">
            {users.map((user) => {
              const b = balances[user.alias] ?? { uyu: 0, usd: 0, inUyu: 0, outUyu: 0, inUsd: 0, outUsd: 0 };
              const showUsd = hasUsdActivity(b);
              return (
                <div key={user.id} className="dbal-card">
                  <div className="dbal-head">
                    <Avatar name={user.alias} size={32} />
                    <div className="dbal-name">{user.alias}</div>
                  </div>
                  <div className="dbal-figs">
                    <div className="dbal-fig-row">
                      <div className="dbal-cur">Pesos</div>
                      <div className={`dbal-amt ${signClass(b.uyu)}`}>{fmtSigned(uyu, b.uyu)}</div>
                      <div className="dbal-break">
                        <span className="pos">+{new Intl.NumberFormat('es-UY').format(Math.round(b.inUyu))}</span>
                        <span className="neg">−{new Intl.NumberFormat('es-UY').format(Math.round(b.outUyu))}</span>
                      </div>
                    </div>
                    {showUsd && (
                      <div className="dbal-fig-row">
                        <div className="dbal-cur">Dólares</div>
                        <div className={`dbal-amt ${signClass(b.usd)}`}>{fmtSigned(usd, b.usd)}</div>
                        <div className="dbal-break">
                          <span className="pos">+{new Intl.NumberFormat('es-UY').format(Math.round(b.inUsd))}</span>
                          <span className="neg">−{new Intl.NumberFormat('es-UY').format(Math.round(b.outUsd))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="dsettle">
              <div className="dsettle-eyebrow">
                Para emparejar la caja
              </div>
              {settle.length === 0 ? (
                <div className="dsettle-eq">
                  <Check size={15} strokeWidth={1.8} />
                  Están a la par en pesos
                </div>
              ) : (
                settle.map((t, i) => (
                  <div key={i}>
                    <div className="dsettle-flow">{t.from} → {t.to}</div>
                    <div className="dsettle-amt">{t.currency === 'USD' ? usd(t.amount) : uyu(t.amount)}</div>
                  </div>
                ))
              )}
              <div className="dsettle-biz">
                <div className="dsettle-biz-label">Caja del negocio</div>
                <div className={`dsettle-biz-amt ${signClass(totalUyu)}`}>{fmtSigned(uyu, totalUyu)}</div>
                {hasUsd && (
                  <div className={`dsettle-biz-amt ${signClass(totalUsd)}`} style={{ fontSize: 12, marginTop: 2 }}>
                    {fmtSigned(usd, totalUsd)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="panel panel-scroll flex-fill">
            <div className="panel-head">
              <div>
                <div className="panel-title">Libro de movimientos</div>
              </div>
              <div className="panel-filter-chips">
                {KIND_FILTERS.map((kf) => (
                  <button
                    key={kf.id}
                    className={`chip${kindFilter === kf.id ? ' is-active' : ''}`}
                    onClick={() => setKindFilter(kf.id)}
                  >
                    {kf.label}
                  </button>
                ))}
              </div>
            </div>

            {ledgerMoves.length === 0 ? (
              <Empty icon="wallet" title="Sin movimientos" desc="Registrá un cobro, una compra o un gasto." />
            ) : (
              <div className="dtable-scroll">
                <table className="dtable">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Tipo</th>
                      <th>Socio</th>
                      <th>Fecha</th>
                      <th className="num">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerMoves.map((m) => (
                      <DesktopLedgerRow key={m.id} m={m} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {showGasto && (
          <DModal title="Nuevo gasto" size="sm" onClose={() => setShowGasto(false)}>
            <GastoForm users={users} onDone={() => setShowGasto(false)} />
          </DModal>
        )}
        {showConversion && (
          <DModal title="Cambiar monedas" size="md" onClose={() => setShowConversion(false)}>
            <ConversionForm users={users} onDone={() => setShowConversion(false)} />
          </DModal>
        )}

        <Sidebar transitCount={transitCount} />
        <BottomNav transitCount={transitCount} />
      </div>
    );
  }

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
            <SettleHeader balances={balances} totalUyu={totalUyu} totalUsd={totalUsd} settle={settle} users={users} />
          )}
          {layout === 'planilla' && (
            <LedgerLayout balances={balances} movements={movements} users={users} />
          )}

          {layout !== 'planilla' && <ConvActionButton />}

          {layout === 'resumen' && (
            <>
              <div className="section-label">Movimientos</div>
              <div style={{ marginBottom: 10 }}>
                <Segmented
                  options={['todos', 'entradas', 'salidas'] as const}
                  value={movFilter}
                  onChange={(v) => setMovFilter(v as typeof movFilter)}
                  full
                />
              </div>
              {filteredMovements.length === 0 ? (
                <Empty icon="wallet" title="Sin movimientos" desc="Registrá un cobro, una compra o un gasto." />
              ) : (
                <div className="mov-list">
                  {filteredMovements.map((m) => <MovCard key={m.id} m={m} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <button className="fab" onClick={() => router.push('/saldos/expense/new')} aria-label="Agregar gasto">
        <Plus size={26} strokeWidth={2.2} />
      </button>
      <Sidebar transitCount={transitCount} />
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
  balances, totalUyu, totalUsd, settle, users,
}: {
  balances: Record<string, PersonBalance>;
  totalUyu: number;
  totalUsd: number;
  settle: SettleTransfer[];
  users: UserSummary[];
}) {
  const hasUsd = users.some((u) => {
    const b = balances[u.alias];
    return b ? hasUsdActivity(b) : false;
  });
  const transfers = settle;

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
          <ArrowLeftRight size={14} strokeWidth={1.8} />
          Para emparejar la caja
        </div>
        {transfers.length === 0 ? (
          <div className="settle-eq">
            <Check size={16} strokeWidth={1.8} />
            Están a la par
          </div>
        ) : (
          <>
            {transfers.map((t, i) => (
              <div key={i} className="settle-row">
                <div className="settle-flow">
                  <span>{t.from}</span>
                  <ChevronRight size={16} strokeWidth={1.8} />
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
      <span className="conv-ico"><ArrowLeftRight size={18} strokeWidth={2} /></span>
      <span className="conv-tx">
        <span className="conv-t">Cambiar monedas</span>
        <span className="conv-s">Entre socios y/o de pesos a dólares, a un TC a mano</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.8} />
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

function DesktopLedgerRow({ m }: { m: Movement }) {
  const dotCls = KIND_DOT_CLASS[m.kind] ?? '';
  const chips = [
    ...(m.uyu !== 0 ? [{ cur: 'UYU' as const, n: m.uyu }] : []),
    ...(m.usd !== 0 ? [{ cur: 'USD' as const, n: m.usd }] : []),
  ];
  return (
    <tr>
      <td>
        <div className="ledger-concept">
          <span className={`ledger-dot ${dotCls}`} />
          <div className="ledger-concept-tx">
            <div className="ledger-concept-t capitalize">{m.title}</div>
            {m.sub && <div className="ledger-concept-s">{m.sub}</div>}
          </div>
        </div>
      </td>
      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{KIND_LABEL[m.kind] ?? m.kind}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar name={m.person || '?'} size={22} />
          <span style={{ fontSize: 13 }}>{m.person || '—'}</span>
        </div>
      </td>
      <td style={{ color: 'var(--text-faint)', fontSize: 13 }}>{fmtDate(m.date)}</td>
      <td className="num">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          {chips.map((pt, i) => (
            <span key={i} className={`ledger-amt-chip ${signClass(pt.n)}`}>
              {fmtSigned(pt.cur === 'USD' ? usd : uyu, pt.n)}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function LedgerRow({ m }: { m: Movement }) {
  const dotCls = KIND_DOT_CLASS[m.kind] ?? '';
  const chips = [
    ...(m.uyu !== 0 ? [{ cur: 'UYU' as const, n: m.uyu }] : []),
    ...(m.usd !== 0 ? [{ cur: 'USD' as const, n: m.usd }] : []),
  ];

  return (
    <div className="lrow">
      <div className="lrow-main">
        <div className="lrow-title">
          <span className={`lrow-dot ${dotCls}`} />
          {m.title}
        </div>
        <div className="lrow-sub">
          {fmtDate(m.date)} · {m.sub || m.person}
        </div>
      </div>
      <div className="lrow-person">{m.person || '—'}</div>
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

const MOV_ICON: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  cobro: TagIcon,
  'pago-prov': Package,
  'pago-envio': Truck,
  gasto: Receipt,
  cambio: ArrowLeftRight,
};

function MovCard({ m }: { m: Movement }) {
  const icoCls = MOV_ICO_CLASS[m.kind] ?? '';
  const MovIcon = MOV_ICON[m.kind] ?? Receipt;
  const chips = [
    ...(m.uyu !== 0 ? [{ cur: 'UYU' as const, n: m.uyu }] : []),
    ...(m.usd !== 0 ? [{ cur: 'USD' as const, n: m.usd }] : []),
  ];

  return (
    <div className="mov">
      <div className={`mov-ico ${icoCls}`}>
        <MovIcon size={17} strokeWidth={1.8} />
      </div>
      <div className="mov-main">
        <div className="mov-title capitalize">{m.title}</div>
        <div className="mov-sub">
          {fmtDate(m.date)} · <strong>{m.person || '—'}</strong>{m.sub ? ` · ${m.sub}` : ''}
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
