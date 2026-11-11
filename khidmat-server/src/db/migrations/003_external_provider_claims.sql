-- Store only license-safe external identifiers until ownership is verified.
CREATE TABLE IF NOT EXISTS provider_source_references (
  id VARCHAR(64) PRIMARY KEY,
  source VARCHAR(32) NOT NULL CHECK (source IN ('google_places')),
  external_id TEXT NOT NULL,
  provider_id VARCHAR(64) REFERENCES providers(id) ON DELETE SET NULL,
  claimed_by_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('EXTERNAL','CLAIMED','VERIFIED','ACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, external_id)
);
