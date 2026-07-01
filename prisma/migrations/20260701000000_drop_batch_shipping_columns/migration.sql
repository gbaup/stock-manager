/*
  Warnings:

  - You are about to drop the columns `shipping_price_usd`, `shipping_price_uyu`,
    `weight`, and `shipping_paid_by_user_id` on the `batches` table. Delivery data
    now lives on `shipments` (see ADR 0004); the `add_shipments` migration already
    backfilled every arrived batch into a shipment, so no data is lost.

*/
-- DropForeignKey
ALTER TABLE "batches" DROP CONSTRAINT "batches_shipping_paid_by_user_id_fkey";

-- AlterTable
ALTER TABLE "batches" DROP COLUMN "shipping_price_usd";
ALTER TABLE "batches" DROP COLUMN "shipping_price_uyu";
ALTER TABLE "batches" DROP COLUMN "weight";
ALTER TABLE "batches" DROP COLUMN "shipping_paid_by_user_id";
