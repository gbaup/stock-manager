-- CreateTable
CREATE TABLE "conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "from_user_id" UUID NOT NULL,
    "from_cur" VARCHAR(5) NOT NULL,
    "to_user_id" UUID NOT NULL,
    "to_cur" VARCHAR(5) NOT NULL,
    "from_amount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "to_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
