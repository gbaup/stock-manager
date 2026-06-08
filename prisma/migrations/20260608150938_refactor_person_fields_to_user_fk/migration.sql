-- Add alias to users: nullable first so we can populate, then NOT NULL
ALTER TABLE "users" ADD COLUMN "alias" VARCHAR(50);
UPDATE "users" SET "alias" = initcap("last_name");
ALTER TABLE "users" ALTER COLUMN "alias" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_alias_key" UNIQUE ("alias");

-- Batch: add FK columns (nullable), populate from stored lowercase strings, drop old cols
ALTER TABLE "batches" ADD COLUMN "supplier_paid_by_user_id" UUID;
ALTER TABLE "batches" ADD COLUMN "shipping_paid_by_user_id" UUID;
UPDATE "batches" b SET "supplier_paid_by_user_id" = u."id" FROM "users" u WHERE LOWER(u."alias") = b."supplier_paid_by";
UPDATE "batches" b SET "shipping_paid_by_user_id" = u."id" FROM "users" u WHERE LOWER(u."alias") = b."shipping_paid_by";
ALTER TABLE "batches" DROP COLUMN "supplier_paid_by";
ALTER TABLE "batches" DROP COLUMN "shipping_paid_by";
ALTER TABLE "batches" ADD CONSTRAINT "batches_supplier_paid_by_user_id_fkey" FOREIGN KEY ("supplier_paid_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "batches" ADD CONSTRAINT "batches_shipping_paid_by_user_id_fkey" FOREIGN KEY ("shipping_paid_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sale: add FK column (nullable), populate, drop old col
ALTER TABLE "sales" ADD COLUMN "collected_by_user_id" UUID;
UPDATE "sales" s SET "collected_by_user_id" = u."id" FROM "users" u WHERE LOWER(u."alias") = s."collected_by";
ALTER TABLE "sales" DROP COLUMN "collected_by";
ALTER TABLE "sales" ADD CONSTRAINT "sales_collected_by_user_id_fkey" FOREIGN KEY ("collected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Expense: add FK column (nullable), populate, make NOT NULL, drop old col
ALTER TABLE "expenses" ADD COLUMN "paid_by_user_id" UUID;
UPDATE "expenses" e SET "paid_by_user_id" = u."id" FROM "users" u WHERE LOWER(u."alias") = e."paid_by";
ALTER TABLE "expenses" ALTER COLUMN "paid_by_user_id" SET NOT NULL;
ALTER TABLE "expenses" DROP COLUMN "paid_by";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_user_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

