/*
  Warnings:

  - You are about to drop the column `name` on the `customers` table. All the data in the column will be lost.
  - Added the required column `barangay` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city_municipality` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `province` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zip_code` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Made the column `contact_number` on table `customers` required. This step will fail if there are existing NULL values in that column.

*/

DELETE FROM "customers";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "name",
ADD COLUMN     "barangay" TEXT NOT NULL,
ADD COLUMN     "city_municipality" TEXT NOT NULL,
ADD COLUMN     "first_name" TEXT NOT NULL,
ADD COLUMN     "last_name" TEXT NOT NULL,
ADD COLUMN     "middle_name" TEXT,
ADD COLUMN     "province" TEXT NOT NULL,
ADD COLUMN     "region" TEXT NOT NULL,
ADD COLUMN     "suffix" TEXT,
ADD COLUMN     "zip_code" TEXT NOT NULL,
ALTER COLUMN "contact_number" SET NOT NULL;
