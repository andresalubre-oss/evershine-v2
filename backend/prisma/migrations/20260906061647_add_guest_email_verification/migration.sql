-- CreateTable
CREATE TABLE "guest_email_verifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_email_verifications_email_idx" ON "guest_email_verifications"("email");
