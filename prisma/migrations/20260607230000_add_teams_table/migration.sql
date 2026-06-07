-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- DropIndex
DROP INDEX "catalog_products_team_season_version_color_number_sleeve_ty_key";

-- AlterTable
ALTER TABLE "catalog_products" DROP COLUMN "team";
ALTER TABLE "catalog_products" ADD COLUMN "team_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_team_id_season_version_color_number_sleeve_type_key" ON "catalog_products"("team_id", "season", "version", "color", "number", "sleeve", "type");
