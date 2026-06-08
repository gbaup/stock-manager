'use client';

import { useRef, useState } from 'react';
import { Icon } from './icon';
import { Swatch } from './swatch';
import { uploadFile, deleteFile } from '@/app/lib/image-client';

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
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(Array.from(files).map(uploadFile));
      onChange([...photos, ...urls]);
    } finally {
      setUploading(false);
    }
  }

  async function remove(idx: number) {
    const url = photos[idx];
    if (url.startsWith('https://')) await deleteFile(url);
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
        <button type="button" className="pg-empty" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Swatch color={color} number={number} style={{ width: 84, height: 96, borderRadius: 'var(--r-sm)' }} />
          <span className="pg-empty-cta">
            <Icon name={uploading ? 'loader' : 'image'} size={17} />
            {uploading ? 'Subiendo…' : 'Agregar fotos'}
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
          <button type="button" className="pg-add" onClick={() => inputRef.current?.click()} disabled={uploading} aria-label="Agregar más fotos">
            {uploading ? <Icon name="loader" size={20} strokeWidth={2} /> : <Icon name="plus" size={24} strokeWidth={2} />}
            <span>{uploading ? 'Subiendo…' : 'Más'}</span>
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
