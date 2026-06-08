# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server
npm run build      # prisma generate + next build
npm run lint       # eslint
```

No test suite. Pre-push hook runs `npm run lint && npm run build`.

When adding a migration: edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <name>`. The `prisma generate` step happens automatically on `npm run build`.

## Architecture

**Next.js App Router** with a clear separation between reads and mutations:

- `app/lib/queries.ts` — all read-only DB access (server-side only)
- `app/actions/` — Server Actions for mutations (each file groups actions by domain: models, sales, purchases, etc.)
- `app/api/` — API Routes for things that need raw HTTP (e.g. `upload/route.ts` for Cloudinary multipart upload)
- `app/lib/schemas.ts` — Zod schemas shared between server actions and client forms
- `app/lib/domain.ts` — serialization-safe domain types, domain constants (`PEOPLE`, `SIZES`, `VERSIONS`, etc.), and formatting utilities (`fmtDate`, `uyu`, `usd`)

**Routing**: The `app/(app)/` group wraps authenticated screens. `app/public/` is unauthenticated.

**Components** live in two layers:
- `components/screens/` — full-page screens (one per feature), rendered as client components with React Hook Form
- `components/ui/` — reusable primitives (`Field`, `Modal`, `Segmented`, `PhotoGallery`, etc.)

**Auth**: JWT cookies via `jose`. Session created with `createSession(userId)`, read with `getCurrentUserId()` (both in `app/lib/auth.ts`). 7-day expiry, `httpOnly`, `sameSite: lax`.

**Database**: PostgreSQL via Prisma with the `@prisma/adapter-pg` driver (not Prisma's default). The singleton client is in `app/lib/prisma.ts`.

## Domain model

The app manages a football jersey resale business. Core entities:

- **CatalogProduct** — a jersey model (team, season, color, version, etc.). `photos` is a `Json` column storing an array of image URLs (Cloudinary) or base64 data URIs (legacy).
- **InventoryItem** — a physical unit linking a `CatalogProduct` to a `Batch`. Has `size`, cost prices, and `status` (`available` | `sold`).
- **Batch** — a purchase order. Items arrive from `transit` → `arrived` when `arrivalDate` is set.
- **Sale** — one-to-one with `InventoryItem` (an item can only be sold once).
- **Expense** — standalone costs in UYU or USD.

The `ModelMeta` / `ModelWithStats` / `ModelDetail` types in `domain.ts` are the serialized forms passed from server to client — they use plain primitives, no Prisma `Decimal` or `Date` objects.

## Image uploads

`app/api/upload/route.ts` accepts `multipart/form-data` with a `file` field and returns `{ url: string }` (a Cloudinary `secure_url`). The upload targets the `jerseys` folder and constrains width to 800px. Required env vars: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

`components/ui/photo-gallery.tsx` currently handles files client-side (resize to base64). The client implementation for calling `/api/upload` and replacing base64 with Cloudinary URLs is the pending work on `feature/image-storage`.

## Environment variables

```
DATABASE_URL
SESSION_SECRET
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

## Conventions

- UI text is in Spanish (Rioplatense). Domain constants like `PEOPLE = ['Caja', 'Bauer']` are business-specific, not generic.
- Monetary values: always stored as `Decimal` in DB; converted to `number` in query layer before passing to client. USD rate is `USD_RATE = 40.5` in `domain.ts`.
- Prisma field names use `camelCase` in code and `snake_case` in DB via `@map`.
- String fields going into the DB are normalized with `n(v)` (`v.trim().toLowerCase()`) in server actions.
