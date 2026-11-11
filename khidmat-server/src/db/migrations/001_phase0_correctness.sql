-- Phase 0: persist the provider coverage already collected by onboarding.
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS service_radius_km INT NOT NULL DEFAULT 10;

ALTER TABLE providers
  DROP CONSTRAINT IF EXISTS providers_service_radius_km_check;

ALTER TABLE providers
  ADD CONSTRAINT providers_service_radius_km_check
  CHECK (service_radius_km BETWEEN 1 AND 100);

CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
