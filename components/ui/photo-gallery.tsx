'use client';

import { useRef } from 'react';
import { Icon } from './icon';
import { Swatch } from './swatch';

function resizeImageFile(file: File, maxEdge: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoGallery({
  photos,
  color,
  number,
  onChange,
}: {
  photos: string[];
  color: string;
  number?: string;
  onChange: (photos: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const resized = await Promise.all(
      Array.from(files).map((f) => resizeImageFile(f, 1000))
    );
    onChange([...photos, ...resized]);
  }

  function remove(idx: number) {
    onChange(photos.filter((_, i) => i !== idx));
  }

  function promote(idx: number) {
    if (idx === 0) return;
    const next = [...photos];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    onChange(next);
  }

  return (
    <div className="photo-gallery">
      {photos.length === 0 ? (
        <button type="button" className="pg-empty" onClick={() => inputRef.current?.click()}>
          <Swatch color={color} number={number} style={{ width: 84, height: 96, borderRadius: 'var(--r-sm)' }} />
          <span className="pg-empty-cta">
            <Icon name="image" size={17} />
            Agregar fotos
          </span>
        </button>
      ) : (
        <div className="pg-grid">
          {photos.map((src, i) => (
            <div
              key={i}
              className={`pg-thumb${i === 0 ? ' is-cover' : ''}`}
              onClick={() => promote(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              {i === 0 && <span className="pg-cover-badge">Portada</span>}
              <button
                type="button"
                className="pg-remove"
                onClick={(e) => { e.stopPropagation(); remove(i); }}
                aria-label="Quitar foto"
              >
                <Icon name="x" size={14} strokeWidth={2.6} />
              </button>
            </div>
          ))}
          <button type="button" className="pg-add" onClick={() => inputRef.current?.click()} aria-label="Agregar más fotos">
            <Icon name="plus" size={24} strokeWidth={2} />
            <span>Más</span>
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      {photos.length > 0 && (
        <div className="pg-hint">
          {photos.length} {photos.length === 1 ? 'foto' : 'fotos'} · tocá una para usarla de portada
        </div>
      )}
    </div>
  );
}
