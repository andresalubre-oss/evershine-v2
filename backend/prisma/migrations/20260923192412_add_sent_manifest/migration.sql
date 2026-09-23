-- CreateTable
CREATE TABLE "sent_manifests" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "sent_by_admin_id" TEXT NOT NULL,
    "recipient_account_ids" TEXT[],
    "extra_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sent_manifests_created_at_idx" ON "sent_manifests"("created_at");

-- AddForeignKey
ALTER TABLE "sent_manifests" ADD CONSTRAINT "sent_manifests_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_manifests" ADD CONSTRAINT "sent_manifests_sent_by_admin_id_fkey" FOREIGN KEY ("sent_by_admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
