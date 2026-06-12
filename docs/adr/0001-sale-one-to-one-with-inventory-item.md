# Sale is one-to-one with InventoryItem

A `Sale` row represents the sale of exactly one `InventoryItem`. There is no `quantity` column on `Sale` and no notion of a "batched" sale at the data layer — selling three jerseys at once produces three `Sale` rows, three item flips, three ledger movements.

This makes reporting trivial (every sale is already a unit), keeps `Movement` projection straightforward (one event → known number of movements), and lets the FIFO item-picking inside `inventory.recordSale` stay simple (one call, one item, no partial-fulfilment branching). The cost is that any UI that wants to capture multiple jerseys in one form action has to loop on the client or in the Server Action.

If the business ever needs "true" batched sales (e.g. a single invoice line covering many items at one negotiated price), this decision needs revisiting — but the right reaction at that point is probably a new `SaleGroup` concept, not a `quantity` column on `Sale`.
