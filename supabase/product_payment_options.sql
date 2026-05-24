-- Per-product payment options for brajmarg-admin
-- Run the UP block in the Supabase SQL Editor.
--
-- Adds the same two payment-method flags used on yatra_packages to every priced
-- product catalog table (cloth_items, prasad_items, frame_items, seva_items), so
-- the admin can configure which methods each item accepts. The storefront reads
-- these at checkout; this admin panel only sets them. Order-level payment state
-- (payment_status, etc.) lives on the existing `orders` table and is NOT touched
-- here. Defaults keep every existing row accepting both methods.

-- ============================ UP ============================
ALTER TABLE cloth_items
  ADD COLUMN IF NOT EXISTS allow_direct_payment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_cod            BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE prasad_items
  ADD COLUMN IF NOT EXISTS allow_direct_payment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_cod            BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE frame_items
  ADD COLUMN IF NOT EXISTS allow_direct_payment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_cod            BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE seva_items
  ADD COLUMN IF NOT EXISTS allow_direct_payment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_cod            BOOLEAN NOT NULL DEFAULT true;

-- ============================ DOWN ===========================
-- Run only to roll back.
--
-- ALTER TABLE cloth_items  DROP COLUMN IF EXISTS allow_cod, DROP COLUMN IF EXISTS allow_direct_payment;
-- ALTER TABLE prasad_items DROP COLUMN IF EXISTS allow_cod, DROP COLUMN IF EXISTS allow_direct_payment;
-- ALTER TABLE frame_items  DROP COLUMN IF EXISTS allow_cod, DROP COLUMN IF EXISTS allow_direct_payment;
-- ALTER TABLE seva_items   DROP COLUMN IF EXISTS allow_cod, DROP COLUMN IF EXISTS allow_direct_payment;
