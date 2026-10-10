-- ==============================================================================
-- TRIPLE C PIGS t/a COLCOM FOODS (INNSCOR AFRICA GROUP)
-- PostgreSQL + pgvector Database Initialization Script
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM (
    'GATE_OPERATOR',
    'BIOSECURITY_OFFICER',
    'SECURITY_MANAGER',
    'AUDITOR'
);

CREATE TYPE identification_type AS ENUM (
    'NATIONAL_ID',
    'PASSPORT'
);

CREATE TYPE gate_decision_status AS ENUM (
    'GRANTED',
    'DENIED'
);

CREATE TYPE question_data_type AS ENUM (
    'BOOLEAN',
    'TEXT',
    'SELECT',
    'SIGNATURE'
);

CREATE TYPE red_trigger_condition AS ENUM (
    'TRUE',
    'FALSE',
    'NONE'
);

CREATE TYPE alert_priority_level AS ENUM (
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE alert_lifecycle_status AS ENUM (
    'PENDING_ACK',
    'INVESTIGATING',
    'ESCALATED',
    'RESOLVED'
);

-- System Users & Initial Admin
CREATE TABLE IF NOT EXISTS system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'GATE_OPERATOR',
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    gate_assigned VARCHAR(50) DEFAULT 'MAIN_BIOSECURITY_GATE_01',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_users (username, email, password_hash, full_name, role, mfa_enabled)
VALUES ('admin', 'admin@colcom.co.zw', crypt('admin', gen_salt('bf')), 'Security & Biosecurity Manager', 'SECURITY_MANAGER', false)
ON CONFLICT (username) DO NOTHING;

-- Global System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    admin_email VARCHAR(255) NOT NULL DEFAULT 'admin@colcom.co.zw',
    biosecurity_hotline VARCHAR(50) NOT NULL DEFAULT '+263 77 100 2938',
    strict_biometric_threshold NUMERIC(4, 3) NOT NULL DEFAULT 0.850,
    quarantine_sms_alerts BOOLEAN NOT NULL DEFAULT true,
    webhook_endpoint TEXT NOT NULL DEFAULT 'https://security-gateway.colcom.co.zw/webhooks/biosecurity-incident',
    facility_name VARCHAR(150) NOT NULL DEFAULT 'Triple C Pigs t/a Colcom Foods',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (email_mfa_enabled, admin_email)
VALUES (false, 'admin@colcom.co.zw')
ON CONFLICT DO NOTHING;

-- Visitors Master Registry
CREATE TABLE IF NOT EXISTS visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    id_type identification_type NOT NULL DEFAULT 'NATIONAL_ID',
    id_number VARCHAR(60) NOT NULL,
    country_of_origin VARCHAR(100) NOT NULL DEFAULT 'Zimbabwe',
    phone_number VARCHAR(25) NOT NULL,
    company VARCHAR(150),
    category VARCHAR(50) NOT NULL DEFAULT 'CONTRACTOR',
    is_pre_approved BOOLEAN NOT NULL DEFAULT true,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_visitor_id UNIQUE (id_type, id_number)
);

CREATE INDEX IF NOT EXISTS idx_visitors_phone ON visitors(phone_number);
CREATE INDEX IF NOT EXISTS idx_visitors_id_number ON visitors(id_number);
CREATE INDEX IF NOT EXISTS idx_visitors_country ON visitors(country_of_origin);

-- Dynamic Form Templates & Question Builder
CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(150) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES form_templates(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    type question_data_type NOT NULL DEFAULT 'BOOLEAN',
    options JSONB,
    required BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    trigger_red_alert_on red_trigger_condition NOT NULL DEFAULT 'NONE',
    failure_message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'BIOSECURITY',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_baseline BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Baseline Questions
INSERT INTO form_questions (prompt, type, required, sort_order, trigger_red_alert_on, failure_message, category, is_active, is_baseline)
VALUES 
('Have You been in Contact with any cloven hoofed animal in the last 72 hours?', 'BOOLEAN', true, 1, 'TRUE', 'CRITICAL QUARANTINE BREACH: Cloven-hoofed animal contact declared within last 72 hours. High African Swine Fever / FMD transmission risk.', 'BIOSECURITY', true, true),
('Are you carrying any meat or Meat Products? (Search Vehicles for meat products).', 'BOOLEAN', true, 2, 'TRUE', 'CONTRABAND DETECTED: Carrying uncertified meat or meat products into pig production boundaries is strictly prohibited under Innscor Biosecurity Policy Sec 4.2.', 'BIOSECURITY', true, true),
('Is your name on the visitors'' register ?', 'BOOLEAN', true, 3, 'FALSE', 'VISITOR REGISTER HOLD: Visitor name or identity is not pre-approved on the Triple C Pigs authorized entry register.', 'BIOSECURITY', true, true),
('Visitor Digital Signature Confirmation', 'SIGNATURE', true, 4, 'NONE', 'Digital legal declaration signature is mandatory.', 'BIOSECURITY', true, true)
ON CONFLICT DO NOTHING;

-- Visits Table
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
    visitor_name VARCHAR(150) NOT NULL,
    id_type identification_type NOT NULL,
    id_number VARCHAR(60) NOT NULL,
    country_of_origin VARCHAR(100) NOT NULL,
    phone_number VARCHAR(25) NOT NULL,
    vehicle_reg_number VARCHAR(25),
    purpose_of_visit TEXT NOT NULL,
    from_origin VARCHAR(255) NOT NULL,
    status gate_decision_status NOT NULL,
    primary_reason TEXT NOT NULL,
    similarity_score NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    badge_number VARCHAR(50),
    gate_id VARCHAR(50) NOT NULL DEFAULT 'MAIN_BIOSECURITY_GATE_01',
    operator_id UUID REFERENCES system_users(id),
    is_offline_synced BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

-- Visit Responses Table
CREATE TABLE IF NOT EXISTS visit_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES form_questions(id),
    question_prompt TEXT NOT NULL,
    response_value_json JSONB NOT NULL,
    triggered_red_alert BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Biometrics Table with pgvector(512)
CREATE TABLE IF NOT EXISTS biometrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
    visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
    vector_embedding vector(512),
    similarity_score NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    verification_passed BOOLEAN NOT NULL DEFAULT false,
    captured_photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_biometrics_cosine 
ON biometrics 
USING hnsw (vector_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Biosecurity Alerts Table
CREATE TABLE IF NOT EXISTS biosecurity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    visitor_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(25) NOT NULL,
    vehicle_reg VARCHAR(25),
    priority alert_priority_level NOT NULL DEFAULT 'CRITICAL',
    alert_status alert_lifecycle_status NOT NULL DEFAULT 'PENDING_ACK',
    violation_reasons JSONB NOT NULL,
    sms_dispatched BOOLEAN NOT NULL DEFAULT true,
    webhook_dispatched BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
