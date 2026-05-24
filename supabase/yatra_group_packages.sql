-- Solo vs Group yatra packages for brajmarg-admin
-- Run the UP block in the Supabase SQL Editor. Reuses bucket: brajmarg_yatra_images.
--
-- Adds package_type plus group-only scheduling fields to the existing yatra_packages
-- table. Additive and backward compatible: every existing row backfills to 'solo'
-- via the column DEFAULT. The `price` column is reused (solo = full vehicle price,
-- group = price per seat). Seat model is rolling-week: seats_total + recurring
-- weekdays + departure/arrival time. Concrete weekly dates are computed in the app;
-- this table only stores the schedule and capacity.

-- ============================ UP ============================
ALTER TABLE yatra_packages
  ADD COLUMN IF NOT EXISTS package_type         TEXT NOT NULL DEFAULT 'solo'
    CHECK (package_type IN ('solo', 'group')),
  ADD COLUMN IF NOT EXISTS weekdays             SMALLINT[] NOT NULL DEFAULT '{}', -- 0=Sun .. 6=Sat
  ADD COLUMN IF NOT EXISTS departure_time       TIME,
  ADD COLUMN IF NOT EXISTS arrival_time         TIME,
  ADD COLUMN IF NOT EXISTS seats_total          INTEGER,
  -- Payment options shown to users on the booking page (both package types).
  -- At least one is enforced true by the app; defaults keep existing rows bookable.
  ADD COLUMN IF NOT EXISTS allow_direct_payment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_cod            BOOLEAN NOT NULL DEFAULT true;

-- Filter group packages quickly (storefront lists them separately).
CREATE INDEX IF NOT EXISTS idx_yatra_packages_type
  ON yatra_packages (package_type, is_active, display_order);

-- ============================ DOWN ===========================
-- Run only to roll back. Drops group-specific data; existing solo packages are
-- unaffected because their data lives in the original columns.
--
-- DROP INDEX IF EXISTS idx_yatra_packages_type;
-- ALTER TABLE yatra_packages
--   DROP COLUMN IF EXISTS allow_cod,
--   DROP COLUMN IF EXISTS allow_direct_payment,
--   DROP COLUMN IF EXISTS seats_total,
--   DROP COLUMN IF EXISTS arrival_time,
--   DROP COLUMN IF EXISTS departure_time,
--   DROP COLUMN IF EXISTS weekdays,
--   DROP COLUMN IF EXISTS package_type;
