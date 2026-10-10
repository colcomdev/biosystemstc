/**
 * PostgreSQL Auto-Initialization & Database Access Layer
 * INNSCOR AFRICA LTD (Colcom Foods) T/A TRIPLE C PIGS
 * 
 * Automatically connects to PostgreSQL using credentials in .env,
 * creates the database if it doesn't exist, provisions all tables and indexes,
 * and seeds baseline biosecurity configurations and visitors.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import {
  DynamicFormQuestion,
  EmailConfig,
  GateLogRecord,
  RegisteredVisitor,
  SystemSettings,
  BiosecurityAlert,
} from '../types';

dotenv.config();

const { Pool, Client } = pg;

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

let dbPool: pg.Pool | null = null;
let isConnected = false;

export function getDbConfig(): DbConfig {
  // Check if DATABASE_URL is provided
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      return {
        host: url.hostname || 'localhost',
        port: Number(url.port) || 5432,
        user: decodeURIComponent(url.username || 'postgres'),
        password: decodeURIComponent(url.password || ''),
        database: url.pathname.replace(/^\//, '') || 'colcom_biosecurity_db',
      };
    } catch {
      // Fallback if URL parsing fails
    }
  }

  return {
    host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    user: process.env.DB_USER || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
    database: process.env.DB_NAME || process.env.PGDATABASE || 'colcom_biosecurity_db',
  };
}

export function isDbConnected(): boolean {
  return isConnected && dbPool !== null;
}

export function getPool(): pg.Pool | null {
  return dbPool;
}

/**
 * Initializes the PostgreSQL Database:
 * 1. Connects to server maintenance db ('postgres')
 * 2. Creates the target database if it doesn't already exist
 * 3. Connects to target database
 * 4. Creates all required tables, triggers, and indexes if not exists
 * Clean schema initialization: Does NOT seed any mock or dummy data.
 */
export async function initDatabase(): Promise<boolean> {
  const config = getDbConfig();
  console.log(`[DB] Initializing PostgreSQL connection: host=${config.host}, port=${config.port}, user=${config.user}, db=${config.database}...`);

  // Step 1: Connect to maintenance db to ensure target database exists
  try {
    const maintenanceClient = new Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: 'postgres',
      connectionTimeoutMillis: 4000,
    });

    await maintenanceClient.connect();
    
    // Check if target database exists
    const checkDbRes = await maintenanceClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database]
    );

    if (checkDbRes.rowCount === 0) {
      console.log(`[DB] Database "${config.database}" does not exist. Creating database...`);
      // Escape database name safely
      const safeDbName = config.database.replace(/"/g, '""');
      await maintenanceClient.query(`CREATE DATABASE "${safeDbName}";`);
      console.log(`[DB] Successfully created database "${config.database}".`);
    } else {
      console.log(`[DB] Database "${config.database}" exists.`);
    }

    await maintenanceClient.end();
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.warn(`[DB] Notice: Could not connect to maintenance db to verify/create database: ${errorMsg}`);
    // We continue attempting to connect directly in case user has restricted access or database already exists
  }

  // Step 2: Connect to the target database
  try {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const client = await pool.connect();
    console.log(`[DB] Successfully connected to database "${config.database}". Provisioning tables...`);

    // Step 3: Run table schema creation (idempotent IF NOT EXISTS)
    await client.query(`
      -- System Users
      CREATE TABLE IF NOT EXISTS system_users (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'SECURITY_MANAGER',
        mfa_enabled BOOLEAN NOT NULL DEFAULT false,
        gate_assigned VARCHAR(50) DEFAULT 'MAIN_BIOSECURITY_GATE_01',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- System Settings
      CREATE TABLE IF NOT EXISTS system_settings (
        id VARCHAR(50) PRIMARY KEY,
        email_mfa_enabled BOOLEAN NOT NULL DEFAULT false,
        admin_email VARCHAR(255) NOT NULL DEFAULT 'admin@colcom.co.zw',
        biosecurity_hotline VARCHAR(50) NOT NULL DEFAULT '+263 77 100 2938',
        strict_biometric_threshold NUMERIC(4, 3) NOT NULL DEFAULT 0.850,
        facility_name VARCHAR(200) NOT NULL DEFAULT 'INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS',
        logo_url TEXT,
        default_theme VARCHAR(20) NOT NULL DEFAULT 'dark',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Email & EOD Report Config
      CREATE TABLE IF NOT EXISTS email_config (
        id VARCHAR(50) PRIMARY KEY,
        recipients JSONB NOT NULL DEFAULT '["soc@triplecpigs.co.zw", "biosecurity@triplecpigs.co.zw"]'::jsonb,
        email_alerts_on_denial BOOLEAN NOT NULL DEFAULT true,
        eod_report_enabled BOOLEAN NOT NULL DEFAULT true,
        eod_report_schedule_time VARCHAR(10) NOT NULL DEFAULT '18:00',
        sender_email VARCHAR(255) NOT NULL DEFAULT 'no-reply.soc@triplecpigs.co.zw',
        smtp_host VARCHAR(255) NOT NULL DEFAULT 'smtp.triplecpigs.co.zw',
        smtp_port INT NOT NULL DEFAULT 587,
        last_eod_report_generated_at TIMESTAMPTZ,
        last_eod_report_sent_to JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Dynamic Form Questions
      CREATE TABLE IF NOT EXISTS form_questions (
        id VARCHAR(100) PRIMARY KEY,
        prompt TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'BOOLEAN',
        options JSONB,
        required BOOLEAN NOT NULL DEFAULT true,
        sort_order INT NOT NULL DEFAULT 0,
        trigger_red_alert_on VARCHAR(50) NOT NULL DEFAULT 'NONE',
        failure_message TEXT NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'BIOSECURITY',
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_baseline BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Pre-Registered & Master Visitors
      CREATE TABLE IF NOT EXISTS visitors (
        id VARCHAR(100) PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        id_type VARCHAR(50) NOT NULL DEFAULT 'NATIONAL_ID',
        id_number VARCHAR(100) NOT NULL,
        country_of_origin VARCHAR(100) NOT NULL DEFAULT 'Zimbabwe',
        phone_number VARCHAR(50) NOT NULL,
        company VARCHAR(150),
        category VARCHAR(50) NOT NULL DEFAULT 'CONTRACTOR',
        is_pre_approved BOOLEAN NOT NULL DEFAULT true,
        photo_url TEXT,
        embedding_vector JSONB,
        registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_visit_at TIMESTAMPTZ,
        CONSTRAINT uq_visitor_id UNIQUE (id_type, id_number)
      );

      -- Visitor Logs & Gate Access Decisions
      CREATE TABLE IF NOT EXISTS visits (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        visitor_name VARCHAR(150) NOT NULL,
        id_type VARCHAR(50) NOT NULL,
        id_number VARCHAR(100) NOT NULL,
        country_of_origin VARCHAR(100) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        vehicle_reg VARCHAR(50),
        origin VARCHAR(255) NOT NULL,
        purpose TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        similarity_score NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
        operator_name VARCHAR(100) NOT NULL DEFAULT 'Gate Operator',
        gate_id VARCHAR(50) NOT NULL DEFAULT 'MAIN_BIOSECURITY_GATE_01',
        badge_number VARCHAR(50),
        quarantine_reasons JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Biosecurity Alerts Table
      CREATE TABLE IF NOT EXISTS biosecurity_alerts (
        id VARCHAR(100) PRIMARY KEY,
        decision_id VARCHAR(100),
        visitor_name VARCHAR(150) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        vehicle_reg VARCHAR(50),
        gate_id VARCHAR(50) NOT NULL DEFAULT 'MAIN_BIOSECURITY_GATE_01',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        priority VARCHAR(50) NOT NULL DEFAULT 'CRITICAL',
        reasons JSONB NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING_ACK',
        webhook_dispatched BOOLEAN NOT NULL DEFAULT true,
        email_dispatched BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Email Dispatch Audit Logs
      CREATE TABLE IF NOT EXISTS email_dispatch_logs (
        id VARCHAR(100) PRIMARY KEY,
        dispatch_type VARCHAR(50) NOT NULL,
        recipients JSONB NOT NULL,
        subject TEXT NOT NULL,
        preview_text TEXT NOT NULL,
        has_attachment BOOLEAN NOT NULL DEFAULT false,
        delivery_status VARCHAR(50) NOT NULL DEFAULT 'DELIVERED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for High Performance Lookup
      CREATE INDEX IF NOT EXISTS idx_visitors_lookup_name ON visitors(full_name);
      CREATE INDEX IF NOT EXISTS idx_visitors_lookup_id ON visitors(id_number);
      CREATE INDEX IF NOT EXISTS idx_visitors_lookup_phone ON visitors(phone_number);
      CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_form_questions_order ON form_questions(sort_order ASC);
    `);

    client.release();
    dbPool = pool;
    isConnected = true;
    console.log('[DB] PostgreSQL auto-provisioning completed successfully. Tables ready (clean schema, no seed data).');
    return true;
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.warn(`[DB] PostgreSQL connection/initialization failed: ${errorMsg}`);
    console.warn(`[DB] Application will operate smoothly in resilient in-memory mode. When PostgreSQL is started with .env credentials, restart to connect.`);
    dbPool = null;
    isConnected = false;
    return false;
  }
}

// -----------------------------------------------------------------------------
// Database Query Helpers
// -----------------------------------------------------------------------------

export async function dbQuery(text: string, params?: any[]): Promise<pg.QueryResult | null> {
  if (!dbPool) return null;
  try {
    return await dbPool.query(text, params);
  } catch (err) {
    console.error(`[DB Query Error]: ${(err as Error).message}`, { query: text });
    return null;
  }
}

export async function fetchQuestionsFromDb(): Promise<DynamicFormQuestion[] | null> {
  const result = await dbQuery(`SELECT * FROM form_questions ORDER BY sort_order ASC;`);
  if (!result) return null;
  return result.rows.map((r) => ({
    id: r.id,
    prompt: r.prompt,
    type: r.type,
    options: r.options ? (typeof r.options === 'string' ? JSON.parse(r.options) : r.options) : undefined,
    required: r.required,
    order: r.sort_order,
    triggerRedAlertOn: r.trigger_red_alert_on,
    failureMessage: r.failure_message,
    category: r.category,
    isActive: r.is_active,
    isBaseline: r.is_baseline,
  }));
}

export async function saveQuestionToDb(q: DynamicFormQuestion): Promise<boolean> {
  const result = await dbQuery(`
    INSERT INTO form_questions (id, prompt, type, options, required, sort_order, trigger_red_alert_on, failure_message, category, is_active, is_baseline)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      prompt = EXCLUDED.prompt,
      type = EXCLUDED.type,
      options = EXCLUDED.options,
      required = EXCLUDED.required,
      sort_order = EXCLUDED.sort_order,
      trigger_red_alert_on = EXCLUDED.trigger_red_alert_on,
      failure_message = EXCLUDED.failure_message,
      category = EXCLUDED.category,
      is_active = EXCLUDED.is_active;
  `, [
    q.id,
    q.prompt,
    q.type,
    q.options ? JSON.stringify(q.options) : null,
    q.required,
    q.order,
    q.triggerRedAlertOn,
    q.failureMessage,
    q.category,
    q.isActive,
    q.isBaseline ?? false,
  ]);
  return result !== null;
}

export async function deleteQuestionFromDb(id: string): Promise<boolean> {
  const result = await dbQuery(`DELETE FROM form_questions WHERE id = $1;`, [id]);
  return result !== null;
}

export async function fetchVisitorsFromDb(): Promise<RegisteredVisitor[] | null> {
  const result = await dbQuery(`SELECT * FROM visitors ORDER BY full_name ASC;`);
  if (!result) return null;
  return result.rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    idType: r.id_type,
    idNumber: r.id_number,
    countryOfOrigin: r.country_of_origin,
    phoneNumber: r.phone_number,
    company: r.company,
    category: r.category,
    isPreApproved: r.is_pre_approved,
    photoUrl: r.photo_url,
    embeddingVector: r.embedding_vector ? (typeof r.embedding_vector === 'string' ? JSON.parse(r.embedding_vector) : r.embedding_vector) : undefined,
    registeredAt: r.registered_at,
    lastVisitAt: r.last_visit_at,
  }));
}

export async function saveVisitorToDb(v: RegisteredVisitor): Promise<boolean> {
  const result = await dbQuery(`
    INSERT INTO visitors (id, full_name, id_type, id_number, country_of_origin, phone_number, company, category, is_pre_approved, photo_url, embedding_vector, registered_at, last_visit_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (id_type, id_number) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      country_of_origin = EXCLUDED.country_of_origin,
      phone_number = EXCLUDED.phone_number,
      company = EXCLUDED.company,
      category = EXCLUDED.category,
      is_pre_approved = EXCLUDED.is_pre_approved,
      photo_url = COALESCE(EXCLUDED.photo_url, visitors.photo_url),
      last_visit_at = COALESCE(EXCLUDED.last_visit_at, visitors.last_visit_at);
  `, [
    v.id,
    v.fullName,
    v.idType,
    v.idNumber,
    v.countryOfOrigin,
    v.phoneNumber,
    v.company,
    v.category,
    v.isPreApproved,
    v.photoUrl || null,
    v.embeddingVector ? JSON.stringify(v.embeddingVector) : null,
    v.registeredAt,
    v.lastVisitAt || null,
  ]);
  return result !== null;
}

export async function saveVisitLogToDb(log: GateLogRecord): Promise<boolean> {
  const result = await dbQuery(`
    INSERT INTO visits (id, timestamp, visitor_name, id_type, id_number, country_of_origin, phone_number, vehicle_reg, origin, purpose, status, similarity_score, operator_name, gate_id, badge_number, quarantine_reasons)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);
  `, [
    log.id,
    log.timestamp,
    log.visitorName,
    log.idType,
    log.idNumber,
    log.countryOfOrigin,
    log.phoneNumber,
    log.vehicleReg || null,
    log.origin,
    log.purpose,
    log.status,
    log.similarityScore,
    log.operatorName,
    log.gateId,
    log.badgeNumber || null,
    log.quarantineReasons ? JSON.stringify(log.quarantineReasons) : null,
  ]);
  return result !== null;
}

export async function saveAlertToDb(alert: BiosecurityAlert): Promise<boolean> {
  const result = await dbQuery(`
    INSERT INTO biosecurity_alerts (id, decision_id, visitor_name, phone, vehicle_reg, gate_id, timestamp, priority, reasons, status, webhook_dispatched, email_dispatched)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
  `, [
    alert.id,
    alert.decisionId,
    alert.visitorName,
    alert.phone,
    alert.vehicleReg || null,
    alert.gateId,
    alert.timestamp,
    alert.priority,
    JSON.stringify(alert.reasons),
    alert.status,
    alert.webhookDispatched,
    alert.emailDispatched,
  ]);
  return result !== null;
}
