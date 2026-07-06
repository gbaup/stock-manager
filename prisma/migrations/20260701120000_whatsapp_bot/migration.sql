-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone_number" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateTable
CREATE TABLE "bot_conversations" (
    "phone" VARCHAR(20) NOT NULL,
    "role" VARCHAR(10) NOT NULL,
    "step" VARCHAR(40) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "last_message_id" VARCHAR(128),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_conversations_pkey" PRIMARY KEY ("phone")
);
