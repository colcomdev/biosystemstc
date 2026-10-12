/**
 * PostgreSQL Database Architecture & Schema Specification
 * INNSCOR AFRICA LTD (Triple C Pigs) - Swine Biosecurity Gate Control
 * 
 * Includes:
 * - Dynamic Form Engine: form_templates, form_questions, visit_responses
 * - Visitors & Visits (Supporting National ID / Passport, Country of Origin, optional photo/biometrics)
 * - System Settings & Email Config (real-time denial alert recipients, EOD PDF report schedules)
 * - pgvector extension for facial vector embeddings
 */

export const POSTGRES_SQL_SCHEMA = `-- ==============================================================================
-- TRIPLE C PIGS t/a COLCOM FOODS (INNSCOR AFRICA GROUP)
-- Biometric Visitor Management, Automated Email Alerts & EOD Report Schema
-- PostgreSQL 16+ with Dynamic Form Engine & Email Configuration
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enumerated Types
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

-- 3. System Users & RBAC
CREATE TABLE system_users (
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

-- 4. Global System Settings
CREATE TABLE system_settings (
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

-- 5. Email & Automated PDF Report Configuration Table
CREATE TABLE email_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipients JSONB NOT NULL DEFAULT '["biosecurity@colcom.co.zw", "security.mgr@colcom.co.zw"]'::jsonb,
    email_alerts_on_denial BOOLEAN NOT NULL DEFAULT true,
    eod_report_enabled BOOLEAN NOT NULL DEFAULT true,
    eod_report_schedule_time VARCHAR(10) NOT NULL DEFAULT '18:00',
    sender_email VARCHAR(255) NOT NULL DEFAULT 'no-reply.security@colcom.co.zw',
    smtp_host VARCHAR(255) NOT NULL DEFAULT 'smtp.colcom.co.zw',
    smtp_port INT NOT NULL DEFAULT 587,
    last_eod_report_generated_at TIMESTAMPTZ,
    last_eod_report_sent_to JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Visitors Master Registry (National ID OR Passport Number, Country of Origin)
CREATE TABLE visitors (
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

CREATE INDEX idx_visitors_phone ON visitors(phone_number);
CREATE INDEX idx_visitors_id_number ON visitors(id_number);
CREATE INDEX idx_visitors_country ON visitors(country_of_origin);

-- 7. Dynamic Form Templates & Question Builder
CREATE TABLE form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(150) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE form_questions (
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

CREATE INDEX idx_form_questions_active ON form_questions(is_active, sort_order);

-- 8. Visits (Gate Evaluations & Decisions)
CREATE TABLE visits (
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
    captured_photo_url TEXT, -- Optional photo capture
    gate_id VARCHAR(50) NOT NULL DEFAULT 'MAIN_BIOSECURITY_GATE_01',
    operator_id UUID REFERENCES system_users(id),
    is_offline_synced BOOLEAN NOT NULL DEFAULT false,
    email_alert_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_phone_digits CHECK (length(phone_number) >= 10),
    CONSTRAINT chk_purpose_length CHECK (length(purpose_of_visit) <= 3500)
);

CREATE INDEX idx_visits_created_at ON visits(created_at DESC);
CREATE INDEX idx_visits_status ON visits(status);

-- 9. Visit Responses (Answers to Dynamic Form Questions)
CREATE TABLE visit_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES form_questions(id),
    question_prompt TEXT NOT NULL,
    response_value_json JSONB NOT NULL,
    triggered_red_alert BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visit_responses_visit_id ON visit_responses(visit_id);

-- 10. Email Notification Logs Table
CREATE TABLE email_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_type VARCHAR(50) NOT NULL, -- REALTIME_DENIAL, EOD_REPORT_PDF
    recipients JSONB NOT NULL,
    subject TEXT NOT NULL,
    preview_text TEXT NOT NULL,
    has_attachment BOOLEAN NOT NULL DEFAULT false,
    delivery_status VARCHAR(50) NOT NULL DEFAULT 'DELIVERED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export const PRISMA_SCHEMA = `// ==============================================================================
// Colcom Foods - Triple C Pigs Biosecurity Gate Decision Engine
// Prisma ORM Schema with Dynamic Form Engine & Email Configuration
// ==============================================================================

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

enum UserRole {
  GATE_OPERATOR
  BIOSECURITY_OFFICER
  SECURITY_MANAGER
  AUDITOR
}

enum IdentificationType {
  NATIONAL_ID
  PASSPORT
}

enum GateDecisionStatus {
  GRANTED
  DENIED
}

enum QuestionDataType {
  BOOLEAN
  TEXT
  SELECT
  SIGNATURE
}

enum RedTriggerCondition {
  TRUE
  FALSE
  NONE
}

model SystemUser {
  id           String     @id @default(uuid())
  username     String     @unique
  email        String     @unique
  passwordHash String     @map("password_hash")
  fullName     String     @map("full_name")
  role         UserRole   @default(GATE_OPERATOR)
  mfaEnabled   Boolean    @default(false) @map("mfa_enabled")
  gateAssigned String     @default("MAIN_BIOSECURITY_GATE_01") @map("gate_assigned")
  isActive     Boolean    @default(true) @map("is_active")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  visits       Visit[]

  @@map("system_users")
}

model SystemSettings {
  id                       String   @id @default(uuid())
  emailMfaEnabled          Boolean  @default(false) @map("email_mfa_enabled")
  adminEmail               String   @default("admin@colcom.co.zw") @map("admin_email")
  biosecurityHotline       String   @default("+263 77 100 2938") @map("biosecurity_hotline")
  strictBiometricThreshold Decimal  @default(0.850) @db.Decimal(4, 3) @map("strict_biometric_threshold")
  quarantineSmsAlerts      Boolean  @default(true) @map("quarantine_sms_alerts")
  webhookEndpoint          String   @default("https://security-gateway.colcom.co.zw/webhooks/biosecurity-incident") @map("webhook_endpoint")
  facilityName             String   @default("Triple C Pigs t/a Colcom Foods") @map("facility_name")
  updatedAt                DateTime @updatedAt @map("updated_at")

  @@map("system_settings")
}

model EmailConfig {
  id                    String    @id @default(uuid())
  recipients            Json      // List of recipient email addresses
  emailAlertsOnDenial   Boolean   @default(true) @map("email_alerts_on_denial")
  eodReportEnabled      Boolean   @default(true) @map("eod_report_enabled")
  eodReportScheduleTime String    @default("18:00") @map("eod_report_schedule_time")
  senderEmail           String    @default("no-reply.security@colcom.co.zw") @map("sender_email")
  smtpHost              String    @default("smtp.colcom.co.zw") @map("smtp_host")
  smtpPort              Int       @default(587) @map("smtp_port")
  lastEodGeneratedAt    DateTime? @map("last_eod_generated_at")
  lastEodSentTo         Json?     @map("last_eod_sent_to")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  @@map("email_config")
}

model Visitor {
  id              String             @id @default(uuid())
  fullName        String             @map("full_name")
  idType          IdentificationType @default(NATIONAL_ID) @map("id_type")
  idNumber        String             @map("id_number")
  countryOfOrigin String             @default("Zimbabwe") @map("country_of_origin")
  phoneNumber     String             @map("phone_number")
  company         String?
  category        String             @default("CONTRACTOR")
  isPreApproved   Boolean            @default(true) @map("is_pre_approved")
  photoUrl        String?            @map("photo_url")
  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt @map("updated_at")

  visits          Visit[]

  @@unique([idType, idNumber], name: "uq_visitor_identity")
  @@index([phoneNumber])
  @@index([idNumber])
  @@index([countryOfOrigin])
  @@map("visitors")
}

model FormTemplate {
  id           String         @id @default(uuid())
  templateName String         @map("template_name")
  version      Int            @default(1)
  isActive     Boolean        @default(true) @map("is_active")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  questions    FormQuestion[]

  @@map("form_templates")
}

model FormQuestion {
  id                 String              @id @default(uuid())
  templateId         String?             @map("template_id")
  template           FormTemplate?       @relation(fields: [templateId], references: [id], onDelete: Cascade)
  prompt             String
  type               QuestionDataType    @default(BOOLEAN)
  options            Json?
  required           Boolean             @default(true)
  sortOrder          Int                 @default(0) @map("sort_order")
  triggerRedAlertOn  RedTriggerCondition @default(NONE) @map("trigger_red_alert_on")
  failureMessage     String              @map("failure_message")
  category           String              @default("BIOSECURITY")
  isActive           Boolean             @default(true) @map("is_active")
  isBaseline         Boolean             @default(false) @map("is_baseline")
  createdAt          DateTime            @default(now()) @map("created_at")

  responses          VisitResponse[]

  @@index([isActive, sortOrder])
  @@map("form_questions")
}

model Visit {
  id               String             @id @default(uuid())
  visitorId        String?            @map("visitor_id")
  visitor          Visitor?           @relation(fields: [visitorId], references: [id], onDelete: SetNull)
  visitorName      String             @map("visitor_name")
  idType           IdentificationType @map("id_type")
  idNumber         String             @map("id_number")
  countryOfOrigin  String             @map("country_of_origin")
  phoneNumber      String             @map("phone_number")
  vehicleRegNumber String?            @map("vehicle_reg_number")
  purposeOfVisit   String             @db.Text @map("purpose_of_visit")
  fromOrigin       String             @map("from_origin")
  status           GateDecisionStatus
  primaryReason    String             @map("primary_reason")
  similarityScore  Decimal            @default(0.0000) @db.Decimal(5, 4) @map("similarity_score")
  badgeNumber      String?            @map("badge_number")
  capturedPhotoUrl String?            @map("captured_photo_url")
  gateId           String             @default("MAIN_BIOSECURITY_GATE_01") @map("gate_id")
  operatorId       String?            @map("operator_id")
  operator         SystemUser?        @relation(fields: [operatorId], references: [id])
  isOfflineSynced  Boolean            @default(false) @map("is_offline_synced")
  emailAlertSent   Boolean            @default(false) @map("email_alert_sent")
  createdAt        DateTime           @default(now()) @map("created_at")

  responses        VisitResponse[]

  @@index([createdAt])
  @@index([status])
  @@map("visits")
}

model VisitResponse {
  id                 String       @id @default(uuid())
  visitId            String       @map("visit_id")
  visit              Visit        @relation(fields: [visitId], references: [id], onDelete: Cascade)
  questionId         String       @map("question_id")
  question           FormQuestion @relation(fields: [questionId], references: [id])
  questionPrompt     String       @map("question_prompt")
  responseValueJson  Json         @map("response_value_json")
  triggeredRedAlert  Boolean      @default(false) @map("triggered_red_alert")
  failureReason      String?      @map("failure_reason")
  createdAt          DateTime     @default(now()) @map("created_at")

  @@index([visitId])
  @@index([triggeredRedAlert])
  @@map("visit_responses")
}
`;
