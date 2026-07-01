-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "tracking_number" VARCHAR(100),
    "shipping_price_usd" DECIMAL(10,2),
    "shipping_price_uyu" DECIMAL(10,2),
    "weight" DECIMAL(10,2),
    "shipping_paid_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipments_batch_id_idx" ON "shipments"("batch_id");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipping_paid_by_user_id_fkey" FOREIGN KEY ("shipping_paid_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN "shipment_id" UUID;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "inventory_items_shipment_id_idx" ON "inventory_items"("shipment_id");

-- Backfill: every already-arrived batch becomes a single shipment that covers all its items.
INSERT INTO "shipments" (
    "id", "batch_id", "date", "tracking_number",
    "shipping_price_usd", "shipping_price_uyu", "weight",
    "shipping_paid_by_user_id", "created_at", "updated_at"
)
SELECT
    gen_random_uuid(),
    b."id",
    b."arrival_date",
    b."tracking_number",
    b."shipping_price_usd",
    b."shipping_price_uyu",
    b."weight",
    b."shipping_paid_by_user_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "batches" b
WHERE b."arrival_date" IS NOT NULL;

-- Link every inventory item of an arrived batch to its newly-created shipment.
UPDATE "inventory_items" ii
SET "shipment_id" = s."id"
FROM "shipments" s
WHERE s."batch_id" = ii."batch_id"
  AND ii."shipment_id" IS NULL;
