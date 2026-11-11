-- Phase 1: one customer request can be sent to a limited provider shortlist.
-- Keep this migration aligned with schema.sql for fresh installations.
CREATE TABLE IF NOT EXISTS service_requests (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name VARCHAR(128), customer_phone VARCHAR(32), category VARCHAR(32) NOT NULL,
  issue_description TEXT NOT NULL,
  urgency VARCHAR(16) NOT NULL CHECK (urgency IN ('low', 'medium', 'urgent')),
  location GEOMETRY(Point, 4326) NOT NULL, sector VARCHAR(64) NOT NULL,
  requested_start_at BIGINT NOT NULL, requested_time_label VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('collecting_responses','ready_to_choose','booked','cancelled','expired')),
  response_deadline_at TIMESTAMPTZ NOT NULL, accepted_response_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS request_dispatches (
  id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(64) NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  wave INT NOT NULL, rank INT NOT NULL, composite_score NUMERIC(8,5) NOT NULL,
  distance_km NUMERIC(8,2) NOT NULL, rationale TEXT NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending','responded','declined','expired','withdrawn')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), responded_at TIMESTAMPTZ,
  UNIQUE(request_id, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_dispatches_provider_status ON request_dispatches(provider_id, status, sent_at DESC);

CREATE TABLE IF NOT EXISTS provider_responses (
  id VARCHAR(64) PRIMARY KEY, request_id VARCHAR(64) NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  dispatch_id VARCHAR(64) NOT NULL UNIQUE REFERENCES request_dispatches(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  available BOOLEAN NOT NULL, proposed_start_at BIGINT, proposed_time_label VARCHAR(128),
  amount INT CHECK (amount IS NULL OR amount > 0),
  price_type VARCHAR(16) CHECK (price_type IS NULL OR price_type IN ('visit_fee','estimate','fixed_quote')),
  message VARCHAR(500), valid_until TIMESTAMPTZ, accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_responses_request ON provider_responses(request_id, created_at);
