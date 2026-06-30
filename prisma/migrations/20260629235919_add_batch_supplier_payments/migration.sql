-- CreateTable
CREATE TABLE "batch_supplier_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "batch_supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_supplier_payments_batch_id_idx" ON "batch_supplier_payments"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_supplier_payments_batch_id_user_id_key" ON "batch_supplier_payments"("batch_id", "user_id");

-- AddForeignKey
ALTER TABLE "batch_supplier_payments" ADD CONSTRAINT "batch_supplier_payments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_supplier_payments" ADD CONSTRAINT "batch_supplier_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: each existing batch with a single payer becomes one payment row whose
-- amount equals the batch's base cost (sum of its items' base price), reproducing the
-- exact -baseUsd supplier movement for that same partner.
INSERT INTO "batch_supplier_payments" ("id", "batch_id", "user_id", "amount_usd")
SELECT gen_random_uuid(), b.id, b.supplier_paid_by_user_id, s.total
FROM "batches" b
JOIN (
  SELECT batch_id, SUM(base_price_usd) AS total
  FROM "inventory_items" GROUP BY batch_id
) s ON s.batch_id = b.id
WHERE b.supplier_paid_by_user_id IS NOT NULL AND s.total > 0;
