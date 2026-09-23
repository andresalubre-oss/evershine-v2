-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin', 'coast_guard');

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "coast_guard_chat_last_read_at" TIMESTAMP(3),
ADD COLUMN     "coast_guard_station" TEXT,
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'admin';

-- CreateTable
CREATE TABLE "coast_guard_messages" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "sender_role" "AdminRole" NOT NULL,
    "sender_station" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coast_guard_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coast_guard_messages_created_at_idx" ON "coast_guard_messages"("created_at");

-- AddForeignKey
ALTER TABLE "coast_guard_messages" ADD CONSTRAINT "coast_guard_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
