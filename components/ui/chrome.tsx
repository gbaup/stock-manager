'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Truck, Wallet, Eye, ChevronLeft } from 'lucide-react';
import type { ComponentType } from 'react';

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

const NAV_ITEMS: { id: string; label: string; Icon: NavIcon; href: string }[] = [
  { id: 'home',      label: 'Inicio',    Icon: Home,    href: '/home' },
  { id: 'inventory', label: 'Inventario', Icon: Package, href: '/inventory' },
  { id: 'purchases', label: 'Compras',   Icon: Truck,   href: '/purchases' },
  { id: 'saldos',    label: 'Saldos',    Icon: Wallet,  href: '/saldos' },
  { id: 'public',    label: 'Pública',   Icon: Eye,     href: '/public' },
];

export function BottomNavShell({ active = '' }: { active?: string }) {
  return (
    <nav className="bottomnav">
      {NAV_ITEMS.map((it) => (
        <button key={it.id} className={`navbtn ${active === it.id ? 'is-active' : ''}`}>
          <it.Icon size={23} strokeWidth={active === it.id ? 2 : 1.7} />
          {it.label}
        </button>
      ))}
    </nav>
  );
}

export function BottomNav({ transitCount = 0 }: { transitCount?: number }) {
  const pathname = usePathname();

  const active = pathname.startsWith('/home')
    ? 'home'
    : pathname.startsWith('/purchases')
      ? 'purchases'
      : pathname.startsWith('/saldos')
        ? 'saldos'
        : pathname.startsWith('/public')
          ? 'public'
          : 'inventory';

  const items = NAV_ITEMS.map((it) =>
    it.id === 'purchases' ? { ...it, badge: transitCount } : { ...it, badge: undefined }
  );

  return (
    <nav className="bottomnav">
      {items.map((it) => (
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
            {(it.badge ?? 0) > 0 && (
              <span className="badge-dot">{it.badge}</span>
            )}
          </div>
          {it.label}
        </Link>
      ))}
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
