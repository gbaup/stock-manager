// One-time backfill: rewrites every CatalogProduct.photos entry into the
// canonical Photo shape ({ url, publicId }). Handles two legacy shapes:
//
//   1. Cloudinary URL strings: publicId is parsed out of the URL path.
//   2. Base64 data URIs: uploaded to Cloudinary, original entry replaced
//      with the new { url, publicId }. Existing rows are NOT deleted on
//      Cloudinary's side — we're only writing new ones.
//
// Run with: npx tsx scripts/migrate-photos.ts
//
// Idempotent: rows already in the new shape are left untouched.

import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../app/lib/prisma';
import { extractPublicId, type Photo } from '../app/lib/photo';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBase64(dataUri: string): Promise<Photo> {
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'jerseys',
    transformation: [{ width: 800, crop: 'limit' }],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function normalizeEntry(entry: unknown): Promise<Photo | null> {
  if (entry && typeof entry === 'object' && 'url' in entry && 'publicId' in entry) {
    return entry as Photo; // already canonical
  }
  if (typeof entry !== 'string' || entry.length === 0) return null;

  if (entry.startsWith('data:')) {
    console.log('  uploading base64 entry…');
    return uploadBase64(entry);
  }
  if (entry.startsWith('http')) {
    return { url: entry, publicId: extractPublicId(entry) };
  }
  return null;
}

async function main() {
  const products = await prisma.catalogProduct.findMany({
    select: { id: true, photos: true },
  });

  let touched = 0;
  for (const p of products) {
    if (!Array.isArray(p.photos) || p.photos.length === 0) continue;

    const allCanonical = p.photos.every(
      (e) => e && typeof e === 'object' && 'url' in e && 'publicId' in e,
    );
    if (allCanonical) continue;

    console.log(`Migrating product ${p.id} (${p.photos.length} photos)`);
    const next: Photo[] = [];
    for (const entry of p.photos) {
      const photo = await normalizeEntry(entry);
      if (photo) next.push(photo);
    }
    await prisma.catalogProduct.update({
      where: { id: p.id },
      data: { photos: next as unknown as object[] },
    });
    touched += 1;
  }

  console.log(`Done. ${touched} products updated.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
