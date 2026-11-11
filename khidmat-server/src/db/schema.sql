-- Khidmat Unified Spatial-Vector & Relational Database Schema
-- Requires PostgreSQL 15+ with PostGIS and pgvector

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(128),
    role VARCHAR(16) NOT NULL CHECK (role IN ('customer', 'provider')),
    sector VARCHAR(64),
    avatar_url TEXT,
    phone_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_credentials (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Providers Table (Spatial + Vector)
CREATE TABLE IF NOT EXISTS providers (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    category VARCHAR(32) NOT NULL,
    experience_years INT NOT NULL DEFAULT 1,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.0,
    total_jobs INT NOT NULL DEFAULT 0,
    hourly_rate INT NOT NULL DEFAULT 1000,
    service_radius_km INT NOT NULL DEFAULT 10 CHECK (service_radius_km BETWEEN 1 AND 100),
    location GEOMETRY(Point, 4326) NOT NULL,
    sector VARCHAR(64) NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT true,
    skill_embedding vector(768),
    available_slots JSONB NOT NULL DEFAULT '["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial GIST index for fast radius search (ST_DWithin)
CREATE INDEX IF NOT EXISTS idx_providers_location ON providers USING GIST (location);

-- HNSW Vector Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_providers_skill_embedding ON providers USING hnsw (skill_embedding vector_cosine_ops);

-- Category and status filter index
CREATE INDEX IF NOT EXISTS idx_providers_category_online ON providers (category, is_online);

CREATE TABLE IF NOT EXISTS provider_customers (
    id VARCHAR(64) PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    linked_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(128) NOT NULL, phone VARCHAR(32), sector VARCHAR(64), notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_customers_phone ON provider_customers(provider_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_customers_user ON provider_customers(provider_id, linked_user_id) WHERE linked_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS provider_appointments (
    id VARCHAR(64) PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    provider_customer_id VARCHAR(64) NOT NULL REFERENCES provider_customers(id) ON DELETE CASCADE,
    marketplace_job_id VARCHAR(64), category VARCHAR(32) NOT NULL, description TEXT NOT NULL,
    scheduled_at BIGINT NOT NULL, scheduled_label VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('scheduled','completed','cancelled')),
    quoted_amount INT, final_amount INT, reminder_at TIMESTAMPTZ, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_appointments_schedule ON provider_appointments(provider_id, status, scheduled_at);

-- External source IDs may be retained; third-party listing content remains transient until claimed.
CREATE TABLE IF NOT EXISTS provider_source_references (
    id VARCHAR(64) PRIMARY KEY,
    source VARCHAR(32) NOT NULL CHECK (source IN ('google_places')),
    external_id TEXT NOT NULL,
    provider_id VARCHAR(64) REFERENCES providers(id) ON DELETE SET NULL,
    claimed_by_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('EXTERNAL', 'CLAIMED', 'VERIFIED', 'ACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source, external_id)
);

-- 3. Jobs / Bookings Table
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_name VARCHAR(128),
    customer_phone VARCHAR(32),
    provider_id VARCHAR(64) REFERENCES providers(id) ON DELETE SET NULL,
    provider_name VARCHAR(128),
    category VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'requested' CHECK (
        status IN ('requested', 'matched', 'dispatched', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled')
    ),
    issue_description TEXT NOT NULL,
    urgency VARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'urgent')),
    location GEOMETRY(Point, 4326) NOT NULL,
    sector VARCHAR(64) NOT NULL,
    scheduled_for VARCHAR(128) NOT NULL,
    scheduled_timestamp BIGINT NOT NULL,
    estimated_fare INT NOT NULL DEFAULT 1500,
    final_fare INT,
    explainability_rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_provider_status ON jobs (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at DESC);

-- 4. Customer Dues & Micro-ERP Ledger
CREATE TABLE IF NOT EXISTS dues (
    id VARCHAR(64) PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    customer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    provider_customer_id VARCHAR(64) REFERENCES provider_customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(128) NOT NULL,
    customer_phone VARCHAR(32),
    service_category VARCHAR(32) NOT NULL,
    job_id VARCHAR(64) REFERENCES jobs(id) ON DELETE SET NULL,
    amount INT NOT NULL CHECK (amount > 0),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    due_date VARCHAR(64) NOT NULL,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dues_provider_status ON dues (provider_id, status);

-- 5. Audit & Explainability Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) REFERENCES jobs(id) ON DELETE SET NULL,
    session_id VARCHAR(64),
    event_type VARCHAR(64) NOT NULL,
    intent_data JSONB,
    matched_candidates JSONB,
    chosen_provider_id VARCHAR(64),
    rationale TEXT,
    latency_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_job_id ON audit_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs (session_id);

-- 6. Marketplace requests are separate from accepted jobs.
CREATE TABLE IF NOT EXISTS service_requests (
    id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_name VARCHAR(128),
    customer_phone VARCHAR(32),
    category VARCHAR(32) NOT NULL,
    issue_description TEXT NOT NULL,
    urgency VARCHAR(16) NOT NULL CHECK (urgency IN ('low', 'medium', 'urgent')),
    location GEOMETRY(Point, 4326) NOT NULL,
    sector VARCHAR(64) NOT NULL,
    requested_start_at BIGINT NOT NULL,
    requested_time_label VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('collecting_responses', 'ready_to_choose', 'booked', 'cancelled', 'expired')),
    response_deadline_at TIMESTAMPTZ NOT NULL,
    accepted_response_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS request_dispatches (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    wave INT NOT NULL,
    rank INT NOT NULL,
    composite_score NUMERIC(8, 5) NOT NULL,
    distance_km NUMERIC(8, 2) NOT NULL,
    rationale TEXT NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'responded', 'declined', 'expired', 'withdrawn')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE(request_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatches_provider_status ON request_dispatches(provider_id, status, sent_at DESC);

CREATE TABLE IF NOT EXISTS provider_responses (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    dispatch_id VARCHAR(64) NOT NULL UNIQUE REFERENCES request_dispatches(id) ON DELETE CASCADE,
    provider_id VARCHAR(64) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    available BOOLEAN NOT NULL,
    proposed_start_at BIGINT,
    proposed_time_label VARCHAR(128),
    amount INT CHECK (amount IS NULL OR amount > 0),
    price_type VARCHAR(16) CHECK (price_type IS NULL OR price_type IN ('visit_fee', 'estimate', 'fixed_quote')),
    message VARCHAR(500),
    valid_until TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_responses_request ON provider_responses(request_id, created_at);
