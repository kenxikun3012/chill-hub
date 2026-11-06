-- Start reminders are sent once per scheduled start (LOB-12).
ALTER TABLE "lobbies" ADD COLUMN "reminder_sent_at" TIMESTAMP(3);

-- A notification can go out by push or email without appearing in the inbox.
ALTER TABLE "notifications" ADD COLUMN "inbox" BOOLEAN NOT NULL DEFAULT true;

-- Empty until push, email and live delivery have been attempted.
ALTER TABLE "notifications" ADD COLUMN "delivered_at" TIMESTAMP(3);

-- Existing notifications were never pushed, and must not all go out now.
UPDATE "notifications" SET "delivered_at" = "created_at";

CREATE INDEX "notifications_delivered_at_idx" ON "notifications"("delivered_at");
