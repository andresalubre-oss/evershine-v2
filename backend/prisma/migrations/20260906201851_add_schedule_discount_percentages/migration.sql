-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "pwd_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
ADD COLUMN     "senior_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
ADD COLUMN     "student_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 20.00;
