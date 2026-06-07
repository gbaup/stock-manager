'use client';

import { useRef } from 'react';
import { Icon } from './icon';

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
  onChange,
  previewColor,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  previewColor?: string;
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

  if (photos.length === 0) {
    return (
      <div>
        <div
          className="photo-dropzone"
          onClick={() => inputRef.current?.click()}
        >
          {previewColor && (
            <div style={{
              width: 60, height: 60, borderRadius: 10,
              background: previewColor, opacity: 0.7,
            }} />
          )}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-muted)' }}>
            Agregar fotos
          </span>
          <Icon name="camera" size={20} style={{ color: 'var(--text-faint)' }} />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="photo-grid">
        {photos.map((src, i) => (
          <div
            key={i}
            className={`photo-thumb${i === 0 ? ' is-cover' : ''}`}
            onClick={() => promote(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" />
            {i === 0 && <span className="photo-thumb-badge">Portada</span>}
            <button
              type="button"
              className="photo-thumb-del"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}
        <div className="photo-add-tile" onClick={() => inputRef.current?.click()}>
          <Icon name="plus" size={18} />
          <span>Más</span>
        </div>
      </div>
      <div className="photo-hint">
        {photos.length} foto{photos.length !== 1 ? 's' : ''} · tocá una para usarla de portada
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
