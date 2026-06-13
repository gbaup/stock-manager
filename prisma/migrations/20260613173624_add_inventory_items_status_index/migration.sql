-- CreateIndex
CREATE INDEX "inventory_items_status_idx" ON "inventory_items"("status");

-- CreateIndex
CREATE INDEX "inventory_items_catalog_product_id_status_idx" ON "inventory_items"("catalog_product_id", "status");
