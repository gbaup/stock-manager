-- DropIndex
DROP INDEX "sales_inventory_item_id_key";

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "sales_inventory_item_id_idx" ON "sales"("inventory_item_id");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- Partial unique index: at most ONE active sale per inventory item. Cancelled
-- sales keep their item link for history, so a plain unique constraint would
-- block re-selling a returned item. Prisma cannot express partial indexes;
-- this is maintained by hand here.
CREATE UNIQUE INDEX "sales_inventory_item_id_active_key"
  ON "sales"("inventory_item_id") WHERE "status" = 'active';
