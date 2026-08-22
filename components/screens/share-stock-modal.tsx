'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { DModal } from '@/components/ui/d-modal';
import { Empty } from '@/components/ui/empty';
import { fmtType, fmtSize } from '@/app/lib/domain';
import type { ModelWithStats } from '@/app/lib/domain';
import { catalogFilterOptions, shareStockBlocks, shareStockText } from '@/app/lib/catalog-filters';

export function ShareStockModal({ models, onClose }: { models: ModelWithStats[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterSizes, setFilterSizes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const { types, sizes, activeSizes } = catalogFilterOptions(models, { types: filterTypes, sizes: filterSizes });
  const blocks = shareStockBlocks(models, { types: filterTypes, sizes: activeSizes, query });
  const text = shareStockText(blocks);
  const activeFilters = filterTypes.length + activeSizes.length;

  function toggleFilter(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function clearFilters() {
    setFilterTypes([]);
    setFilterSizes([]);
    setQuery('');
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <DModal
      title="Compartir stock"
      sub="Copiá el stock disponible para enviar por WhatsApp"
      size="md"
      onClose={onClose}
    >
      <div className="dm-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="search" style={{ marginTop: 0 }}>
          <Search size={18} strokeWidth={1.8} />
          <input
            value={query}
            placeholder="Buscar equipo, jugador…"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="iconbtn plain" style={{ width: 26, height: 26 }} onClick={() => setQuery('')}>
              <X size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>

        {(activeFilters > 0 || query) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="pub-filter-clear" onClick={clearFilters}>
              Limpiar filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </button>
          </div>
        )}

        {types.length > 0 && (
          <div className="pub-filter-group">
            <div className="pub-filter-label">Tipo</div>
            <div className="multi-chips">
              {types.map((t) => (
                <button
                  key={t}
                  className={`mchip${filterTypes.includes(t) ? ' is-active' : ''}`}
                  onClick={() => toggleFilter(filterTypes, setFilterTypes, t)}
                >
                  {fmtType(t)}
                </button>
              ))}
            </div>
          </div>
        )}

        {sizes.length > 0 && (
          <div className="pub-filter-group">
            <div className="pub-filter-label">Talle</div>
            <div className="multi-chips">
              {sizes.map((s) => (
                <button
                  key={s}
                  className={`mchip${filterSizes.includes(s) ? ' is-active' : ''}`}
                  onClick={() => toggleFilter(filterSizes, setFilterSizes, s)}
                >
                  {fmtSize(s)}
                </button>
              ))}
            </div>
          </div>
        )}

        {blocks.length === 0 ? (
          <Empty icon="search" title="Sin stock para compartir" desc="Probá con otro filtro o búsqueda." />
        ) : (
          <pre className="share-preview">{text}</pre>
        )}
      </div>

      <div className="dm-foot">
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        <button className="btn btn-primary" disabled={blocks.length === 0} onClick={handleCopy}>
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
    </DModal>
  );
}
