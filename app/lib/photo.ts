// A single image attached to a Model. Stored in Cloudinary; identified by
// publicId (needed for delete) and exposed as url. Per ADR-0002, this is the
// only photo representation in the codebase — base64 data URIs are migrated
// out one-time and not supported going forward.
export type Photo = {
  url: string;
  publicId: string;
};

// Pulls the Cloudinary public_id out of a secure_url like
//   https://res.cloudinary.com/<cloud>/image/upload/v1700000000/jerseys/abc123.jpg
// → "jerseys/abc123"
// For non-Cloudinary inputs (legacy base64 data URIs) returns ''.
export function extractPublicId(url: string): string {
  const after = url.split('/upload/')[1];
  if (!after) return '';
  return after.replace(/^v\d+\//, '').replace(/\.[^.]+$/, '');
}

// Normalizes a stored `photos` column value to a Photo[]. Accepts:
//   - Photo[] (the canonical shape; after migration this is the only case)
//   - string[] (legacy: each entry is a Cloudinary URL or a base64 data URI)
//   - anything else → []
// Legacy strings get their publicId derived from the URL (empty for base64).
export function parsePhotos(raw: unknown): Photo[] {
  if (!Array.isArray(raw)) return [];
  const out: Photo[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      out.push({ url: entry, publicId: extractPublicId(entry) });
    } else if (entry && typeof entry === 'object' && 'url' in entry) {
      const e = entry as { url: unknown; publicId?: unknown };
      out.push({
        url: String(e.url),
        publicId: typeof e.publicId === 'string' ? e.publicId : extractPublicId(String(e.url)),
      });
    }
  }
  return out;
}
