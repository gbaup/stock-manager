'use client';

import { ArrowLeft } from 'lucide-react';

// Full-screen desktop shell for creating/editing a purchase: a header with
// the running totals and actions, the catalog on the left and the batch
// being built on the right. Each pane scrolls on its own.
export function PurchaseBuilder({
  title,
  sub,
  onBack,
  actions,
  catalog,
  children,
}: {
  title: string;
  sub?: string;
  onBack: () => void;
  actions: React.ReactNode;
  catalog: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="screen">
      <header className="main-header">
        <button className="iconbtn plain" type="button" onClick={onBack} aria-label="Volver a compras">
          <ArrowLeft size={18} strokeWidth={1.9} />
        </button>
        <div className="mh-left" style={{ display: 'flex', alignItems: 'baseline', minWidth: 0, flex: 1 }}>
          <div className="mh-title" style={{ flex: '0 1 auto' }}>{title}</div>
          {sub && <div className="mh-sub">{sub}</div>}
        </div>
        <div className="mh-actions">{actions}</div>
      </header>
      <div className="pbuilder">
        <section className="pbuilder-cat" aria-label="Catálogo">{catalog}</section>
        <section className="pbuilder-cart" aria-label="Compra">
          <div className="pbuilder-cart-in">{children}</div>
        </section>
      </div>
    </div>
  );
}
