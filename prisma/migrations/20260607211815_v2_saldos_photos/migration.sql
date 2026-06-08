-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "shipping_paid_by" VARCHAR(50),
ADD COLUMN     "supplier_paid_by" VARCHAR(50);

-- AlterTable
ALTER TABLE "catalog_products" ADD COLUMN     "photos" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "sizes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "sleeve" VARCHAR(10),
ADD COLUMN     "type" VARCHAR(20);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "collected_by" VARCHAR(50);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(5) NOT NULL,
    "paid_by" VARCHAR(50) NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
