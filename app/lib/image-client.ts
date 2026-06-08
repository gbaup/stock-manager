export async function uploadFile(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/image', { method: 'POST', body });
  if (!res.ok) throw new Error('Upload failed');
  const { url } = await res.json();
  return url as string;
}

export function extractPublicId(url: string): string {
  const after = url.split('/upload/')[1] ?? '';
  return after.replace(/^v\d+\//, '').replace(/\.[^.]+$/, '');
}

export async function deleteFile(url: string): Promise<void> {
  const publicId = extractPublicId(url);
  const res = await fetch('/api/image', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  });
  if (!res.ok) throw new Error('Delete failed');
}
