-- Migration: Add Paystack fields to payments table
-- Run with: npx prisma migrate deploy
-- Or apply manually in MySQL

ALTER TABLE `payments`
  ADD COLUMN IF NOT EXISTS `paystackRef`  VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `gateway`      VARCHAR(191) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS `gatewayData`  JSON NULL,
  ADD COLUMN IF NOT EXISTS `processedAt`  DATETIME(3) NULL;

-- Unique index on paystackRef (allows NULL, unique when set)
CREATE UNIQUE INDEX IF NOT EXISTS `payments_paystackRef_key`
  ON `payments`(`paystackRef`);

-- Index for fast webhook lookup
CREATE INDEX IF NOT EXISTS `payments_paystackRef_idx`
  ON `payments`(`paystackRef`);
