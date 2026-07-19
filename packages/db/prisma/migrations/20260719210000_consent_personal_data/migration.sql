-- Client quiz consent rework (customer decision, audio 2026-07-19):
-- the only checkbox is now personal-data processing consent (152-FZ).
-- "no understatement" and "agree to pay 20%" checkboxes are removed from
-- the form; their historical columns become nullable and stay for old deals.

ALTER TABLE "Deal" ADD COLUMN "consentPersonalData" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deal" ALTER COLUMN "consentNoUnderstatement" DROP NOT NULL;
ALTER TABLE "Deal" ALTER COLUMN "consentPaymentTerms" DROP NOT NULL;
