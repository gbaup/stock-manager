# Inventory owns Sale writes

`inventory.recordSale` is the only path that creates a `Sale` row. It runs in one Prisma transaction that picks an available `InventoryItem` (FIFO by `Batch.arrivalDate`, then item id), flips its status to `sold`, writes both `finalPriceUyu` and `finalPriceUsd`, and inserts the matching `Sale`. The Server Action at `actions/sales.ts` is now thin — parse input, fetch the exchange rate, call `inventory.recordSale`, invalidate caches, redirect.

The obvious alternative was a `sale` module that owns Sale writes and calls into `inventory` to flip the item. We rejected that because the caller never has an item id (the form expresses intent — model + size + price — not a specific unit). Whoever picks the item must also write the Sale row to keep the operation atomic; splitting the responsibility would either leak Prisma transaction handles across module boundaries or open a race window between item-flip and Sale insert.

Consequence: if Sale grows reporting-heavy logic later (date ranges, payment methods, by-person revenue), the *read* path can be extracted into its own module — but the *write* path stays inside Inventory. Future readers should not "promote" Sale into a write-owning module without also rethinking how items are selected.
