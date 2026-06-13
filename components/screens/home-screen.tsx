'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { Swatch, ColorDot, coverOf } from '@/components/ui/swatch';
import { Empty } from '@/components/ui/empty';
import { fmtDate, uyu, todayISO } from '@/app/lib/format';
import type { ModelWithStats, UserSummary } from '@/app/lib/domain';
import type { HomeSaleItem } from '@/app/lib/queries';

const PAGE = 8;

type Range = 'hoy' | 'semana' | 'mes' | 'todas';

function inDateRange(iso: string, range: Range): boolean {
  if (!iso || range === 'todas') return true;
  const today = todayISO();
  if (range === 'hoy') return iso === today;
  if (range === 'mes') return iso.slice(0, 7) === today.slice(0, 7);
  if (range === 'semana') {
    const diff =
      (new Date(today + 'T00:00:00').getTime() - new Date(iso + 'T00:00:00').getTime()) /
      86400000;
    return diff >= 0 && diff < 7;
  }
  return true;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
];

function monthLabel(): string {
  return MONTHS[new Date().getMonth()];
}

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function LoginScreen({ users, onPick }: { users: UserSummary[]; onPick: (id: string) => void }) {
  return (
    <div className="screen login-screen">
      <div className="login-body">
        <div className="login-eyebrow">
          <span className="brand-dot" />STOCKCONTROL
        </div>
        <h1 className="login-title">
          ¿Quién está<br />usando la caja?
        </h1>
        <p className="login-sub">
          Cada venta y cada cobro queda a tu nombre para llevar bien los saldos.
        </p>
        <div className="login-people">
          {users.map((u) => (
            <button key={u.id} className="login-person" onClick={() => onPick(u.id)}>
              <Avatar name={u.alias} size={56} />
              <span className="lp-name">{u.alias}</span>
              <Icon name="chevR" size={20} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeScreen({
  models,
  sales,
  users,
}: {
  models: ModelWithStats[];
  sales: HomeSaleItem[];
  users: UserSummary[];
}) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sc_currentUser');
    const valid = users.some((u) => u.id === stored) ? stored : null;
    setCurrentUserId(valid);
    setHydrated(true);
  }, [users]);

  const pickUser = (userId: string) => {
    localStorage.setItem('sc_currentUser', userId);
    setCurrentUserId(userId);
  };

  if (!hydrated) return null;

  if (!currentUserId) {
    return <LoginScreen users={users} onPick={pickUser} />;
  }

  const currentUser = users.find((u) => u.id === currentUserId)!;

  return (
    <HomeContent
      models={models}
      sales={sales}
      users={users}
      currentUser={currentUser}
      onSwitchUser={() => setCurrentUserId(null)}
      onQuickSale={() => router.push('/home/sell')}
      onOpenModel={(id) => router.push(`/inventory/${id}`)}
    />
  );
}

function HomeContent({
  models,
  sales,
  users,
  currentUser,
  onSwitchUser,
  onQuickSale,
  onOpenModel,
}: {
  models: ModelWithStats[];
  sales: HomeSaleItem[];
  users: UserSummary[];
  currentUser: UserSummary;
  onSwitchUser: () => void;
  onQuickSale: () => void;
  onOpenModel: (id: string) => void;
}) {
  const [personFilter, setPersonFilter] = useState('all');
  const [range, setRange] = useState<Range>('mes');
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => { setVisible(PAGE); }, [personFilter, range]);

  const monthSales = sales.filter((s) => inDateRange(s.date, 'mes'));
  const monthTotal = monthSales.reduce((a, s) => a + s.price, 0);
  const byUser: Record<string, number> = {};
  users.forEach((u) => {
    byUser[u.id] = monthSales
      .filter((s) => s.collectedByUserId === u.id)
      .reduce((a, s) => a + s.price, 0);
  });

  const list = [...sales
    .filter((s) =>
      (personFilter === 'all' || s.collectedByUserId === personFilter) &&
      inDateRange(s.date, range)
    )]
    .sort((a, b) => b.date.localeCompare(a.date));

  const shown = list.slice(0, visible);
  const remaining = list.length - shown.length;

  const modelById = (id: string) => models.find((m) => m.id === id);

  const rangeOpts: { label: string; value: Range }[] = [
    { label: 'Hoy', value: 'hoy' },
    { label: 'Semana', value: 'semana' },
    { label: 'Mes', value: 'mes' },
    { label: 'Todas', value: 'todas' },
  ];

  return (
    <div className="screen">
      <header className="home-head">
        <div className="home-greet">
          <div className="topbar-eyebrow">
            <span className="brand-dot" />STOCKCONTROL
          </div>
          <h1 className="home-hi">Hola, {currentUser.alias}</h1>
        </div>
        <button className="home-avatar" onClick={onSwitchUser} aria-label="Cambiar de usuario">
          <Avatar name={currentUser.alias} size={44} />
        </button>
      </header>

      <div className="body">
        <div className="body-pad">
          <div className="cobro-hero">
            <div className="ch-top">
              <span className="ch-l">Cobrado en {monthLabel()}</span>
              <span className="ch-n">
                {monthSales.length} {monthSales.length === 1 ? 'venta' : 'ventas'}
              </span>
            </div>
            <div className="ch-amt">{uyu(monthTotal)}</div>
            <div className="ch-split">
              {users.map((u) => (
                <div key={u.id} className="chs">
                  <Avatar name={u.alias} size={24} />
                  <div className="chs-tx">
                    <div className="chs-n">{u.id === currentUser.id ? 'Vos' : u.alias}</div>
                    <div className="chs-a">{uyu(byUser[u.id] ?? 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="quicksale-cta" onClick={onQuickSale}>
            <span className="qs-ico">
              <Icon name="tag" size={20} strokeWidth={2} />
            </span>
            <span className="qs-tx">
              <span className="qs-t">Registrar una venta</span>
              <span className="qs-s">Buscá la camiseta y cobrás en segundos</span>
            </span>
            <span className="qs-plus">
              <Icon name="plus" size={20} strokeWidth={2.4} />
            </span>
          </button>

          <div className="section-label" style={{ marginTop: 22 }}>Ventas</div>

          <div className="chips">
            <button
              className={`chip ${personFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setPersonFilter('all')}
            >
              Todos
            </button>
            {users.map((u) => (
              <button
                key={u.id}
                className={`chip ${personFilter === u.id ? 'is-active' : ''}`}
                onClick={() => setPersonFilter(u.id)}
              >
                <Avatar name={u.alias} size={18} />
                {u.alias}
              </button>
            ))}
          </div>

          <div className="seg" style={{ marginTop: 9 }}>
            {rangeOpts.map((o) => (
              <button
                key={o.value}
                type="button"
                className={range === o.value ? 'is-active' : ''}
                onClick={() => setRange(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          {list.length > 0 && (
            <div className="sales-tally">
              <span>
                {remaining > 0
                  ? `Mostrando ${shown.length} de ${list.length}`
                  : `${list.length} ${list.length === 1 ? 'venta' : 'ventas'}${
                      personFilter !== 'all'
                        ? ` · ${users.find((u) => u.id === personFilter)?.alias ?? ''}`
                        : ''
                    }`}
              </span>
            </div>
          )}

          {list.length === 0 ? (
            <Empty
              title="Sin ventas"
              desc="Probá con otro filtro o registrá una venta nueva."
              icon="tag"
            />
          ) : (
            <div className="sales-list">
              {shown.map((s) => {
                const m = modelById(s.catalogProductId);
                return (
                  <div
                    key={s.id}
                    className="sale-row"
                    onClick={() => m && onOpenModel(m.id)}
                    style={{ cursor: m ? 'pointer' : 'default' }}
                  >
                    {m ? (
                      <Swatch
                        color={s.color}
                        number={s.number}
                        photo={coverOf(m)}
                        className="sale-sw"
                      />
                    ) : (
                      <div className="item-swatch-empty" style={{ width: 40, height: 46 }}>
                        <Icon name="shirt" size={18} />
                      </div>
                    )}
                    <div className="sale-main">
                      <div className="sale-team">{s.teamName}</div>
                      <div className="sale-meta">
                        <ColorDot color={s.color} />
                        {s.color}{s.version ? ` · ${s.version}` : ''}
                      </div>
                    </div>
                    <div className="sale-end">
                      <div className="sale-price">{uyu(s.price)}</div>
                      <div className="sale-by">
                        {s.collectedByAlias && <Avatar name={s.collectedByAlias} size={18} />}
                        <span>{fmtDate(s.date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {remaining > 0 && (
            <button className="sales-more" onClick={() => setVisible((v) => v + PAGE)}>
              Ver más ventas
              <span className="sm-n">
                {remaining > PAGE ? `+${PAGE}` : `+${remaining}`} · quedan {remaining}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
