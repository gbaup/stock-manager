# Migration scripts

One-time scripts for the architecture deepening landed in the same change-set.
Each is idempotent and safe to re-run.

## `backfill-sale-collectors.ts`

Fills in `Sale.collectedByUserId` for legacy rows where it is `NULL`. Required
before tightening the schema to `NOT NULL`.

```bash
npx tsx scripts/backfill-sale-collectors.ts <userId>
```

After running, edit `prisma/schema.prisma` and drop the `?` on
`Sale.collectedByUserId`, then run:

```bash
npx prisma migrate dev --name require-sale-collector
```

The new code (Inventory.recordSale, ledger projections) tolerates the legacy
null state during the transition — sales with no collector still drop out of
the saldos screen, just as they do today.

## `migrate-photos.ts`

Rewrites every `CatalogProduct.photos` entry into the canonical `{ url, publicId }`
shape (see ADR-0002). Cloudinary URL strings get their `publicId` derived from
the path; base64 data URIs are re-uploaded to Cloudinary first.

```bash
npx tsx scripts/migrate-photos.ts
```

Requires the same Cloudinary env vars as the upload route:
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

The runtime parser in `app/lib/photo.ts::parsePhotos` is forgiving and accepts
either shape, so this can run after deploy without a flag day.
