'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColorDot } from '@/components/ui/swatch';
import { Empty } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { fmtDate, todayISO } from '@/app/lib/domain';

type PublicModel = {
  id: string;
  team: string;
  season: string;
  version: string | null;
  color: string;
  number: string | null;
  player: string | null;
  stock: number;
};

export function PublicScreen({ models }: { models: PublicModel[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'team' | 'stock'>('team');

  const q = query.trim().toLowerCase();
  let rows = models.filter((m) =>
    !q || [m.team, m.season, m.version, m.color, m.player, m.number].filter(Boolean).join(' ').toLowerCase().includes(q)
  );
  rows = [...rows].sort((a, b) =>
    sort === 'stock' ? b.stock - a.stock : a.team.localeCompare(b.team) || (a.version ?? '').localeCompare(b.version ?? '')
  );
  const totalUnits = rows.reduce((s, m) => s + m.stock, 0);

  return (
    <div className="screen" style={{ background: 'var(--bg)' }}>
      <div className="public-head">
        <div className="public-badge"><Icon name="eye" size={14} />Catálogo público</div>
        <div className="public-title">Camisetas disponibles</div>
        <div className="public-sub">{rows.length} modelos · {totalUnits} unidades en stock</div>
      </div>

      <div className="body">
        <div style={{ padding: '12px 16px 0' }}>
          <div className="search" style={{ marginTop: 0 }}>
            <Icon name="search" size={19} />
            <input value={query} placeholder="Buscar camiseta…" onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600 }}>Ordenar:</span>
            <button className={`chip${sort === 'team' ? ' is-active' : ''}`} onClick={() => setSort('team')}>Equipo</button>
            <button className={`chip${sort === 'stock' ? ' is-active' : ''}`} onClick={() => setSort('stock')}>Stock</button>
          </div>
        </div>

        <div style={{ padding: '14px 16px calc(var(--safe-bottom) + 80px)' }}>
          {rows.length === 0 ? (
            <Empty icon="shirt" title="Sin stock disponible" desc="Volvé a consultar más tarde." />
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-sm)' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Temp.</th>
                    <th>Versión</th>
                    <th className="num">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="cell-team">
                          <ColorDot color={m.color} />
                          <div>
                            <div className="t-team">{m.team}</div>
                            {(m.player || m.number) && (
                              <div className="t-meta">
                                {[m.player, m.number && `#${m.number}`].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)' }}>{m.season}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.version}</td>
                      <td className="num"><span className="t-stock">{m.stock}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-faint)' }}>
            Stock actualizado al {fmtDate(todayISO())}
          </div>
        </div>
      </div>

      <button
        className="btn btn-secondary"
        style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-bottom) + 14px)', width: 'auto', zIndex: 8, boxShadow: 'var(--sh-lg)' }}
        onClick={() => router.push('/inventory')}
      >
        <Icon name="chevL" size={18} />Volver a la herramienta interna
      </button>
    </div>
  );
}
