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
A purchase order. Groups one or more `InventoryItem`s with a supplier, supplier payments, and an exchange rate. A batch lands in one or more `Shipment`s — it does not itself carry shipping cost or arrival data.
_Avoid_: Order, Purchase (purchase is the *action*, batch is the *thing*). A `Shipment` is a part of a batch, not a synonym for it.

**Shipment**:
One physical delivery of *some* of a `Batch`'s items. A batch can arrive in several shipments over time (partial deliveries), so a `Shipment` owns the things that vary per delivery: its `date`, tracking number, shipping cost (USD + snapshotted UYU), weight, who paid the shipping, and the set of `InventoryItem`s it carried. An item becomes `Stock` only once it belongs to a shipment.

**Purchase status**:
A `Batch`'s arrival state, *derived* from how many of its items belong to a shipment — never stored. **transit** = none arrived, **partial** = some, **arrived** = all.

**Supplier payment**:
A partner's contribution toward a `Batch`'s **base cost** (the sum of its items' `basePriceUsd`). A batch can be paid by more than one partner, so payments are stored as rows (`BatchSupplierPayment`), one per paying partner — not a single payer column. Always in USD.
_Avoid_: payer, "paid by" (those described the old single-payer column, now dropped).

**Reconciliation**:
The rule binding supplier payments to a batch's base cost. A batch is in one of three states: **empty** (nobody has paid yet — a legitimate state for initial stock carried at reference prices, no balance is touched), **exact** (the partners' payments sum to the base cost), or **mismatch** (they were entered but don't sum to it — invalid, blocked). Only `exact` and `empty` may be saved.

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
