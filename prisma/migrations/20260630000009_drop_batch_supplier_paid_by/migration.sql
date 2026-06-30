/*
  Warnings:

  - You are about to drop the column `supplier_paid_by_user_id` on the `batches` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "batches" DROP CONSTRAINT "batches_supplier_paid_by_user_id_fkey";

-- AlterTable
ALTER TABLE "batches" DROP COLUMN "supplier_paid_by_user_id";
