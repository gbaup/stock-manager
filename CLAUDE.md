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

- `app/lib/queries.ts` — all read-only DB access (server-side only). Every actual query lives here, including ones a Client Component needs on demand (not at render time) — never write Prisma calls directly in `app/actions/`.
- `app/actions/` — Server Actions for mutations (each file groups actions by domain: models, sales, purchases, etc.), plus thin client-read RPC boundaries (e.g. `read.ts`) that a Client Component calls to fetch on demand outside of render. These must delegate to `queries.ts`, not query Prisma directly, and must live in their own file with a file-level `'use server'` directive — Next.js doesn't allow mixing `'use server'` and `'use cache'` functions in one file once a Client Component can reach it.
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

## WhatsApp bot

`app/api/whatsapp/route.ts` is the Meta WhatsApp Cloud API webhook (Node runtime). `GET` handles Meta's verify handshake; `POST` verifies the `X-Hub-Signature-256` HMAC (over the raw body) and dispatches the message. All bot logic lives in `app/lib/whatsapp/`:

- `conversation.ts` — orchestrator: loads/persists per-phone state (`BotConversation` table), dedupes Meta retries by `lastMessageId`, resolves role, handles global commands (`cancelar`/`menu`, public "hablar con una persona"), dispatches to a flow.
- `flows/admin-sale.ts` — guided sale registration for admins. Mirrors the web sale form and calls the same `recordSale` primitive (`app/lib/inventory.ts`).
- `flows/public-stock.ts` — read-only catalog browsing for the public (team → model → sizes) via `getPublicModels`.
- `client.ts` (axios send helpers), `verify.ts` (signature/handshake), `parse.ts` (webhook → `IncomingMessage`; the seam where an LLM interpreter would plug in later), `types.ts`, `messages.ts` (all Spanish copy).

Identity: a sender whose WhatsApp number matches a `User.phoneNumber` (E.164 digits, no `+`) is an **admin**; everyone else is **public**. Seed the two admins' numbers on the `User` rows. It's a guided state machine (no LLM yet).

## Environment variables

```
DATABASE_URL
SESSION_SECRET
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
SHOW_ALL_MODELS   # optional, temporary. "true" = public catalog shows ALL models, not just in-stock ones (sizes hidden). Unset/false = normal behavior.

WHATSAPP_VERIFY_TOKEN      # arbitrary string; matched during the webhook GET handshake
WHATSAPP_ACCESS_TOKEN      # Meta Graph API token for the business phone number
WHATSAPP_PHONE_NUMBER_ID   # the sending phone-number id (Graph API path segment)
WHATSAPP_APP_SECRET        # app secret; verifies X-Hub-Signature-256 on inbound POSTs (optional in dev)
WHATSAPP_NUMBER   # optional. Digits-only international phone number (e.g. 59899123456) for the floating WhatsApp button on the public catalog. Unset = button hidden.
WHATSAPP_MESSAGE  # optional. Pre-filled chat text for the WhatsApp button. Unset = chat opens with no pre-filled text.
```

## Conventions

- UI text is in Spanish (Rioplatense). Domain constants like `PEOPLE = ['Caja', 'Bauer']` are business-specific, not generic.
- Monetary values: always stored as `Decimal` in DB; converted to `number` in query layer before passing to client. USD rate is `USD_RATE = 40.5` in `domain.ts`.
- Prisma field names use `camelCase` in code and `snake_case` in DB via `@map`.
- String fields going into the DB are normalized with `n(v)` (`v.trim().toLowerCase()`) in server actions.
