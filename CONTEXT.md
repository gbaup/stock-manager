# Stock Manager — Context

A small business that buys football jerseys in batches, holds them as stock, and sells them on. This file is the canonical glossary: when code or conversation names a concept, use the term defined here.

## Language

### Catalog and stock

**Model**:
A jersey design — the team, season, version, color, sleeve, etc. A `Model` is the *kind of thing* you can sell; the physical units are `InventoryItem`s.
_Avoid_: `CatalogProduct` (used only as the Prisma table name; no other code path should mention it), Product, Jersey, SKU.

**InventoryItem**:
One physical jersey. Belongs to exactly one `Model` and exactly one `Batch`. Carries a size, a cost, and a `status` of `available` or `sold`.
_Avoid_: Unit, Stock item.

**Stock**:
The set of `InventoryItem`s whose `Batch` has arrived **and** whose `status` is `available`. "How much stock do we have of this model in size M?" → count of items meeting both conditions.

**In transit**:
`InventoryItem`s whose `Batch` has not arrived yet, regardless of `status`. They exist in the catalog but cannot be sold.

**Photo**:
A single image attached to a `Model`. Stored in Cloudinary; identified by a `publicId` (needed to delete) and exposed as a `url`. A `Model` holds an ordered array of photos; index 0 is the primary photo (shown in listings) by convention.
_Avoid_: Image, Picture, Thumbnail.

**Inventory**:
The whole pool of `InventoryItem`s the business owns. Used both as the domain concept and as the name of the module (`app/lib/inventory.ts`) that owns reads and writes against it.

### Operations

**Batch**:
A purchase order. Groups one or more `InventoryItem`s with a supplier, an exchange rate, shipping costs, a tracking number, and an `arrivalDate` (null while in transit, set when it lands).
_Avoid_: Order, Shipment, Purchase (purchase is the *action*, batch is the *thing*).

**Sale**:
The record of one `InventoryItem` being sold to a person. One Sale = one item. Carries the final price (typically UYU), the date, the method, and who collected the money.
_Avoid_: Order, Transaction.

**Expense**:
A standalone cost in UYU or USD that is not tied to a Batch (e.g. office, fees).

**Adjustment**:
A manual correction to a person's balance. Does not touch inventory.

**Conversion**:
A UYU ↔ USD swap between two people. Recorded as a single event that affects both balances.

### Reporting

**Movement**:
A `Sale`, `Purchase` (i.e. a Batch payment), `Expense`, `Adjustment`, or `Conversion` projected onto a single person's running balance. Movements are what shows up in the saldos screen.

**Saldos**:
The per-person balance view (UYU and USD), built by folding movements.

### Money

**UYU / USD**:
The two currencies the business operates in. `InventoryItem.basePriceUsd` is the supplier-side price; `Sale.finalPriceUyu` is what the buyer paid.

**Exchange rate**:
A UYU-per-USD number, snapshotted on the `Batch` at purchase time and on the `Sale` at sale time so historical conversions stay stable.

**Live rate / Fallback rate**:
The live rate is fetched from an external FX source (`app/lib/fx.ts`). When the live fetch fails, the system uses a hardcoded **fallback rate**; any UI that displays a converted amount derived from the fallback must surface that fact to the user (so they know they're seeing an estimate, not the rate that will be persisted).

## Example dialogue

> **Owner:** How much stock do we have of the Boca '99 home in size L?
> **Dev:** That's the count of `InventoryItem`s where the `Model` is Boca '99 home, size is L, the `Batch` has arrived, and the status is `available`.
> **Owner:** And if I sold three of them yesterday?
> **Dev:** Three new `Sale` rows, three items flipped to `sold`, stock drops by three. Each `Sale` is one item — no batched rows.
> **Owner:** What if a new shipment is on the way?
> **Dev:** Those are `InventoryItem`s in transit — same `Model`, but their `Batch` has no `arrivalDate` yet. They show up as "in transit," not as stock.

## Flagged ambiguities

- **`quantity` on Sale forms.** Historically the sale form has accepted a `quantity` field, but a `Sale` is 1:1 with an `InventoryItem`. The model is one Sale per item; any UI batching must be implemented as a loop at the call site, not as a `quantity` column.
