-- Deal.handoffSentAt: when the application was posted to the executors'
-- noname channel (TZ 4.5). NULL = not delivered (Telegram down / not
-- configured) -> admin card shows a badge and a resend button; without this
-- column a skipped handoff was invisible outside docker logs.
-- Deal.contractSignedAt: manual "contract signed" mark (TZ 4.8; the signing
-- mechanism itself is the open question 11.14).

ALTER TABLE "Deal" ADD COLUMN "handoffSentAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "contractSignedAt" TIMESTAMP(3);
