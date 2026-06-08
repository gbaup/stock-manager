-- CreateTable
CREATE TABLE "conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "from_person" VARCHAR(50) NOT NULL,
    "from_cur" VARCHAR(5) NOT NULL,
    "to_person" VARCHAR(50) NOT NULL,
    "to_cur" VARCHAR(5) NOT NULL,
    "from_amount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "to_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);
