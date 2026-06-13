import type { Photo } from './photo';

export async function uploadFile(file: File): Promise<Photo> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/image', { method: 'POST', body });
  if (!res.ok) throw new Error('Upload failed');
  const data = (await res.json()) as { url: string; publicId: string };
  return { url: data.url, publicId: data.publicId };
}

export async function deleteFile(publicId: string): Promise<void> {
  if (!publicId) return;
  const res = await fetch('/api/image', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  });
  if (!res.ok) throw new Error('Delete failed');
}
