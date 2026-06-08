'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from './icon';

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

export function BottomNav({ transitCount = 0 }: { transitCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  const active = pathname.startsWith('/purchases')
    ? 'purchases'
    : pathname.startsWith('/saldos')
      ? 'saldos'
      : pathname.startsWith('/public')
        ? 'public'
        : 'inventory';

  const items = [
    { id: 'inventory', label: 'Inventario', icon: 'box' as const, href: '/inventory' },
    { id: 'purchases', label: 'Compras', icon: 'truck' as const, href: '/purchases', badge: transitCount },
    { id: 'saldos', label: 'Saldos', icon: 'wallet' as const, href: '/saldos' },
    { id: 'public', label: 'Pública', icon: 'eye' as const, href: '/public' },
  ];

  return (
    <nav className="bottomnav">
      {items.map((it) => (
        <button
          key={it.id}
          className={`navbtn ${active === it.id ? 'is-active' : ''}`}
          onClick={() => router.push(it.href)}
        >
          <div style={{ position: 'relative' }}>
            <Icon
              name={it.icon}
              size={23}
              strokeWidth={active === it.id ? 2 : 1.7}
            />
            {(it.badge ?? 0) > 0 && (
              <span className="badge-dot">{it.badge}</span>
            )}
          </div>
          {it.label}
        </button>
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
}: {
  onCancel: () => void;
  title: string;
  onSave?: () => void;
  saveLabel?: string;
  canSave?: boolean;
}) {
  return (
    <header className="form-head">
      <button className="link" onClick={onCancel}>Cancelar</button>
      <div className="title">{title}</div>
      <button className="link accent" onClick={onSave} disabled={!canSave}>
        {saveLabel}
      </button>
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
        <Icon name="chevL" size={20} /> Atrás
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
