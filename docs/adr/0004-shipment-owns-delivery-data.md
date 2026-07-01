# Shipment owns delivery data; purchase status is derived

A `Batch` is a purchase order; the act of *receiving* it is a `Shipment`. All data that varies per delivery — arrival date, tracking number, shipping cost (USD + snapshotted UYU), weight, and who paid the shipping — lives on `Shipment`, not on `Batch`. A batch can produce several shipments (partial deliveries), each carrying a subset of the batch's `InventoryItem`s via `InventoryItem.shipmentId`.

A batch's **purchase status** (`transit` | `partial` | `arrived`) is *derived* from how many of its items belong to a shipment — it is never stored. `transit` = no items shipped, `partial` = some, `arrived` = all.

The earlier model put a single `arrivalDate` plus shipping columns directly on `Batch`, which could only express "one delivery, all-or-nothing." That made partial arrivals impossible and forced status to be inferred from `arrivalDate != null`. When `Shipment` was introduced, the `add_shipments` migration backfilled every already-arrived batch into one synthetic shipment covering all its items, so **no batch exists without a shipment**. The Batch-level shipping columns (`shippingPriceUsd`, `shippingPriceUyu`, `weight`, `shippingPaidByUserId`) were therefore dropped — keeping them meant two homes for the same fact and a dead read-fallback that no row could reach.

`Batch.arrivalDate` is retained only as a denormalized convenience stamp (set when the last shipment lands); nothing derives status or shipping from it.

Future readers should not reintroduce shipping cost or arrival data onto `Batch`, and should not add a stored `status`/`arrived` column — derive it from the items' shipment membership. If shipping allocation ever stops being an equal split per shipment, change `shippingShareUyu` (its single owner), not the schema.
