-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('none', 'pending', 'verified', 'rejected');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "contact_number" TEXT,
    "discount_type" "DiscountType" NOT NULL DEFAULT 'none',
    "discount_id_path" TEXT,
    "discount_status" "DiscountStatus" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
