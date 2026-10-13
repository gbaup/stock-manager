-- AlterTable
ALTER TABLE "users" ADD COLUMN     "meli_user_id" VARCHAR(20);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "meli_order_id" VARCHAR(30);

-- CreateTable
CREATE TABLE "meli_listings" (
    "meli_item_id" VARCHAR(20) NOT NULL,
    "catalog_product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meli_listings_pkey" PRIMARY KEY ("meli_item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_meli_user_id_key" ON "users"("meli_user_id");

-- CreateIndex
CREATE INDEX "sales_meli_order_id_idx" ON "sales"("meli_order_id");

-- CreateIndex
CREATE INDEX "meli_listings_catalog_product_id_idx" ON "meli_listings"("catalog_product_id");

-- AddForeignKey
ALTER TABLE "meli_listings" ADD CONSTRAINT "meli_listings_catalog_product_id_fkey" FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
