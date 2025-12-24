-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" SERIAL NOT NULL,
    "purchase_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrival_date" DATE,
    "total_price" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "quantity" INTEGER NOT NULL,
    "tracking_number" VARCHAR(100),
    "description" TEXT,
    "shipping_price_usd" DECIMAL(10,2),
    "shipping_price_uyu" DECIMAL(10,2),
    "weight" DECIMAL(10,2),

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_products" (
    "id" SERIAL NOT NULL,
    "team" VARCHAR(100) NOT NULL,
    "season" VARCHAR(20) NOT NULL,
    "version" VARCHAR(50),
    "color" VARCHAR(50) NOT NULL,
    "number" INTEGER,
    "player" VARCHAR(100),
    "description" TEXT,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "catalog_product_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "size" VARCHAR(10) NOT NULL,
    "base_price_usd" DECIMAL(10,2) NOT NULL,
    "final_price_usd" DECIMAL(10,2),
    "final_price_uyu" DECIMAL(10,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" VARCHAR(150),
    "description" TEXT,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sales_inventory_item_id_key" ON "sales"("inventory_item_id");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_catalog_product_id_fkey" FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
