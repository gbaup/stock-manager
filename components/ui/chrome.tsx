'use client';

import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Truck, Wallet, Eye, ChevronLeft, ChevronRight, Shirt } from 'lucide-react';
import type { ComponentType } from 'react';

// External store for the sidebar's collapsed/compact state, persisted to
// localStorage. useSyncExternalStore (not useState+useEffect) is what keeps
// the initial client render matching the server (both see the false server
// snapshot), so hydration never mismatches on the derived title/aria-label/icon.
const navCompactListeners = new Set<() => void>();
let navCompactValue = typeof window !== 'undefined' && localStorage.getItem('nav-compact') === '1';

function subscribeNavCompact(listener: () => void) {
  navCompactListeners.add(listener);
  return () => navCompactListeners.delete(listener);
}

function getNavCompactSnapshot() {
  return navCompactValue;
}

function getNavCompactServerSnapshot() {
  return false;
}

function setNavCompact(next: boolean) {
  navCompactValue = next;
  localStorage.setItem('nav-compact', next ? '1' : '0');
  navCompactListeners.forEach((listener) => listener());
}

export function TopBar({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      {eyebrow && (
        <div className="topbar-eyebrow">
          <span className="brand-dot" />
          {eyebrow}
        </div>
      )}
      <div className="topbar-row">
        <h1 className="topbar-title">{title}</h1>
        {right}
      </div>
      {sub && <div className="topbar-sub">{sub}</div>}
    </header>
  );
}

type NavIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

type NavItem = { id: string; label: string; shortLabel?: string; Icon: NavIcon; href: string };

// Single source of truth for app navigation. Grouped for the desktop sidebar;
// BottomNav flattens it for mobile. shortLabel overrides label where mobile's
// tighter width needs a shorter form (see 'public' below).
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'GESTIÓN',
    items: [
      { id: 'home',      label: 'Inicio',    Icon: Home,    href: '/home' },
      { id: 'inventory', label: 'Inventario', Icon: Package, href: '/inventory' },
      { id: 'purchases', label: 'Compras',   Icon: Truck,   href: '/purchases' },
      { id: 'saldos',    label: 'Saldos',    Icon: Wallet,  href: '/saldos' },
    ],
  },
  {
    label: 'DIFUSIÓN',
    items: [
      { id: 'public', label: 'Catálogo público', shortLabel: 'Pública', Icon: Eye, href: '/public' },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

function activeNavId(pathname: string) {
  return NAV_ITEMS.find((it) => pathname.startsWith(it.href))?.id ?? 'inventory';
}

export function BottomNavShell({ active = '' }: { active?: string }) {
  return (
    <nav className="bottomnav" aria-hidden="true">
      {NAV_ITEMS.map((it) => (
        <button key={it.id} className={`navbtn ${active === it.id ? 'is-active' : ''}`} tabIndex={-1}>
          <it.Icon size={23} strokeWidth={active === it.id ? 2 : 1.7} />
          {it.shortLabel ?? it.label}
        </button>
      ))}
    </nav>
  );
}

export function BottomNav({ transitCount = 0 }: { transitCount?: number }) {
  const pathname = usePathname();
  const active = activeNavId(pathname);

  return (
    <nav className="bottomnav">
      {NAV_ITEMS.map((it) => {
        const badge = it.id === 'purchases' ? transitCount : 0;
        return (
          <Link
            key={it.id}
            href={it.href}
            prefetch
            className={`navbtn ${active === it.id ? 'is-active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <div style={{ position: 'relative' }}>
              <it.Icon
                size={23}
                strokeWidth={active === it.id ? 2 : 1.7}
              />
              {badge > 0 && (
                <span className="badge-dot">{badge}</span>
              )}
            </div>
            {it.shortLabel ?? it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function FormHead({
  onCancel,
  title,
  onSave,
  saveLabel = 'Guardar',
  canSave = true,
  isSaving = false,
  savingLabel = 'Guardando…',
}: {
  onCancel: () => void;
  title: string;
  onSave?: () => void;
  saveLabel?: string;
  canSave?: boolean;
  isSaving?: boolean;
  savingLabel?: string;
}) {
  return (
    <header className="form-head">
      <button className="link" onClick={onCancel} disabled={isSaving}>Cancelar</button>
      <div className="title">{title}</div>
      <button className="link accent" onClick={onSave} disabled={!canSave || isSaving}>
        {isSaving ? savingLabel : saveLabel}
      </button>
    </header>
  );
}

export function FormHeadShell({
  title,
  saveLabel = 'Guardar',
}: {
  title: string;
  saveLabel?: string;
}) {
  return (
    <header className="form-head">
      <button className="link" disabled>Cancelar</button>
      <div className="title">{title}</div>
      <button className="link accent" disabled>{saveLabel}</button>
    </header>
  );
}

export function Sidebar({
  transitCount = 0,
  currentUserAlias,
}: {
  transitCount?: number;
  currentUserAlias?: string;
}) {
  const pathname = usePathname();
  const navCompact = useSyncExternalStore(
    subscribeNavCompact,
    getNavCompactSnapshot,
    getNavCompactServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.classList.toggle('nav-compact', navCompact);
  }, [navCompact]);

  function toggleCompact() {
    setNavCompact(!navCompact);
  }

  const activeId = activeNavId(pathname);

  return (
    <aside className="sidebar">
      <div className="side-brand">
        <div className="side-mark">
          <Shirt size={18} strokeWidth={1.8} />
        </div>
        <div className="side-brand-tx">
          <div className="side-brand-name">StockControl</div>
          <div className="side-brand-sub">Inventario de camisetas</div>
        </div>
      </div>

      <nav className="side-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="side-group-label">{group.label}</div>
            {group.items.map((item) => {
              const isActive = activeId === item.id;
              const badge = item.id === 'purchases' ? transitCount : 0;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch
                  className={`side-item${isActive ? ' is-active' : ''}`}
                  style={{ textDecoration: 'none' }}
                  title={navCompact ? item.label : undefined}
                >
                  <item.Icon size={18} strokeWidth={isActive ? 2 : 1.7} />
                  <span className="side-item-label">{item.label}</span>
                  {badge > 0 && (
                    <span className="side-item-badge">{badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {currentUserAlias && (
        <div className="side-foot">
          <div className="side-session">
            <div
              className="avatar"
              style={{ width: 30, height: 30, fontSize: 13, borderRadius: 9 }}
            >
              {currentUserAlias[0].toUpperCase()}
            </div>
            <div className="side-session-tx">
              <div className="side-session-sub">Sesión de</div>
              <div className="side-session-name">{currentUserAlias}</div>
            </div>
          </div>
        </div>
      )}

      <button
        className="side-collapse"
        onClick={toggleCompact}
        aria-label={navCompact ? 'Expandir menú' : 'Colapsar menú'}
      >
        {navCompact
          ? <ChevronRight size={14} strokeWidth={2} />
          : <ChevronLeft size={14} strokeWidth={2} />
        }
      </button>
    </aside>
  );
}

export function DetailHead({
  onBack,
  title,
  editHref,
}: {
  onBack: () => void;
  title: string;
  editHref?: string;
}) {
  return (
    <header className="form-head">
      <button className="link" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <ChevronLeft size={20} strokeWidth={1.8} /> Atrás
      </button>
      <div className="title capitalize">{title}</div>
      {editHref ? (
        <Link href={editHref} className="link accent" style={{ textDecoration: 'none' }}>Editar</Link>
      ) : (
        <span style={{ width: 56 }} />
      )}
    </header>
  );
}
