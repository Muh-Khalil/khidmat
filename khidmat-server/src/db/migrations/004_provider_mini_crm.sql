CREATE TABLE IF NOT EXISTS provider_customers (
  id VARCHAR(64) PRIMARY KEY, provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  linked_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(128) NOT NULL, phone VARCHAR(32), sector VARCHAR(64), notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_customers_phone ON provider_customers(provider_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_customers_user ON provider_customers(provider_id, linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS provider_appointments (
  id VARCHAR(64) PRIMARY KEY, provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  provider_customer_id VARCHAR(64) NOT NULL REFERENCES provider_customers(id) ON DELETE CASCADE,
  marketplace_job_id VARCHAR(64) REFERENCES jobs(id) ON DELETE SET NULL,
  category VARCHAR(32) NOT NULL, description TEXT NOT NULL, scheduled_at BIGINT NOT NULL,
  scheduled_label VARCHAR(128) NOT NULL, status VARCHAR(16) NOT NULL CHECK (status IN ('scheduled','completed','cancelled')),
  quoted_amount INT, final_amount INT, reminder_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_appointments_schedule ON provider_appointments(provider_id, status, scheduled_at);
ALTER TABLE dues ADD COLUMN IF NOT EXISTS provider_customer_id VARCHAR(64) REFERENCES provider_customers(id) ON DELETE SET NULL;
