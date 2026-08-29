-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SCHEDULED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "senders" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'SCHEDULED',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "job_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_integrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "access_token" TEXT,
    "webhook_url" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "senders_email_key" ON "senders"("email");

-- CreateIndex
CREATE UNIQUE INDEX "emails_job_id_key" ON "emails"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_integrations_tenant_id_key" ON "slack_integrations"("tenant_id");

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "senders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
