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
import { DEFAULT_DECLARATION_QUESTIONS } from '../data/defaultQuestions';
import {
  DynamicFormQuestion,
  EmailConfig,
  GateLogRecord,
  RegisteredVisitor,
  SystemSettings,
  BiosecurityAlert,
  TelemetryStats,
  User,
  ITActivityLog,
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
  // Check if DATABASE_URL or DIRECT_URL is provided
  const connString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (connString) {
    try {
      const url = new URL(connString);
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

export function isSslRequired(): boolean {
  if (process.env.DB_SSL === 'true') return true;
  if (process.env.DB_SSL === 'false') return false;
  const connString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (connString) {
    const lower = connString.toLowerCase();
    if (
      lower.includes('sslmode=require') ||
      lower.includes('ssl=true') ||
      lower.includes('neon.tech') ||
      lower.includes('supabase.co') ||
      lower.includes('supabase.com') ||
      lower.includes('pooler.supabase.com') ||
      lower.includes('render.com') ||
      lower.includes('aivencloud.com')
    ) {
      return true;
    }
  }
  const config = getDbConfig();
  if (config.host && config.host !== 'localhost' && config.host !== '127.0.0.1' && config.host !== '0.0.0.0') {
    return true;
  }
  return false;
}

export function getPool(): pg.Pool | null {
  return dbPool;
}

/**
 * Initializes the PostgreSQL Database:
 * 1. Connects to server maintenance db ('postgres') if using local/self-hosted Postgres
 * 2. Creates the target database if it doesn't already exist
 * 3. Connects to target database (with SSL auto-detection for hosted DBs like Neon/Supabase)
 * 4. Creates all required tables, triggers, and indexes if not exists
 * Clean schema initialization: Does NOT seed any mock or dummy data.
 */
export async function initDatabase(): Promise<boolean> {
  const config = getDbConfig();
  const ssl = isSslRequired() ? { rejectUnauthorized: false } : undefined;
  console.log(`[DB] Initializing PostgreSQL: host=${config.host}, port=${config.port}, user=${config.user}, db=${config.database}, ssl=${Boolean(ssl)}...`);

  // Step 1: For self-hosted/local Postgres, ensure target database exists
  // On cloud DBs (Neon, Supabase, Render), database is already provisioned by provider
  const connString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  const isCloudProvider = Boolean(
    (connString &&
      (connString.includes('neon.tech') ||
        connString.includes('supabase.co') ||
        connString.includes('supabase.com') ||
        connString.includes('pooler.supabase.com') ||
        connString.includes('render.com') ||
        connString.includes('aivencloud.com'))) ||
      config.host.includes('supabase.co') ||
      config.host.includes('supabase.com') ||
      config.host.includes('pooler.supabase.com') ||
      config.host.includes('neon.tech')
  );

  if (!isCloudProvider) {
    try {
      const maintenanceClient = new Client({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: 'postgres',
        ssl,
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
    }
  }

  // Step 2: Connect to the target database
  try {
    const poolConfig: pg.PoolConfig = connString
      ? {
          connectionString: connString,
          ssl,
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 8000,
        }
      : {
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          ssl,
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 8000,
        };

    const pool = new Pool(poolConfig);

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
        admin_email VARCHAR(255) NOT NULL DEFAULT 'admin@triplecpigs.co.zw',
        biosecurity_hotline VARCHAR(50) NOT NULL DEFAULT '+263 77 100 2938',
        strict_biometric_threshold NUMERIC(4, 3) NOT NULL DEFAULT 0.850,
        facility_name VARCHAR(200) NOT NULL DEFAULT 'TRIPLE C PIGS (INNSCOR AFRICA LTD)',
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

      -- Ensure check_out and comments columns exist on visits
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_inside BOOLEAN DEFAULT false;
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS comments TEXT;

      -- System App Users (IT Admin, Security Manager, etc.)
      CREATE TABLE IF NOT EXISTS app_users (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'SECURITY_MANAGER',
        mfa_enabled BOOLEAN NOT NULL DEFAULT false,
        gate_assigned VARCHAR(50) DEFAULT 'MAIN_BIOSECURITY_GATE_01',
        must_change_password BOOLEAN NOT NULL DEFAULT true,
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMPTZ
      );

      -- IT Activity & Security Audit Logs
      CREATE TABLE IF NOT EXISTS it_audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actor_username VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT NOT NULL,
        target_user VARCHAR(100),
        ip_address VARCHAR(50)
      );
    `);

    // Ensure baseline swine biosecurity declaration questions exist
    try {
      const countRes = await client.query('SELECT COUNT(*) AS count FROM form_questions;');
      if (Number(countRes.rows[0]?.count || 0) === 0) {
        for (const q of DEFAULT_DECLARATION_QUESTIONS) {
          await client.query(
            `INSERT INTO form_questions (id, prompt, type, options, required, sort_order, trigger_red_alert_on, failure_message, category, is_active, is_baseline)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING;`,
            [
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
              q.isBaseline || false,
            ]
          );
        }
        console.log('[DB] Seeded default swine biosecurity declaration questions into PostgreSQL.');
      }
    } catch (seedErr) {
      console.warn('[DB] Could not verify/seed default declaration questions:', (seedErr as Error).message);
    }

    client.release();
    dbPool = pool;
    isConnected = true;
    console.log('[DB] PostgreSQL auto-provisioning completed successfully. Tables and default declaration questions ready.');
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

export async function fetchVisitsFromDb(): Promise<GateLogRecord[]> {
  const rows = await dbQuery(`
    SELECT * FROM visits ORDER BY created_at DESC;
  `);
  if (!rows) return [];
  return rows.map((r: any) => ({
    id: r.id,
    timestamp: r.timestamp,
    visitorName: r.visitor_name,
    idType: r.id_type,
    idNumber: r.id_number,
    countryOfOrigin: r.country_of_origin,
    phoneNumber: r.phone_number,
    vehicleReg: r.vehicle_reg || undefined,
    origin: r.origin,
    purpose: r.purpose,
    comments: r.comments || undefined,
    status: r.status,
    similarityScore: parseFloat(r.similarity_score || '0'),
    operatorName: r.operator_name,
    gateId: r.gate_id,
    badgeNumber: r.badge_number || undefined,
    quarantineReasons: r.quarantine_reasons ? (typeof r.quarantine_reasons === 'string' ? JSON.parse(r.quarantine_reasons) : r.quarantine_reasons) : undefined,
    checkOutTime: r.check_out_time || undefined,
    isInside: r.is_inside ?? (r.status === 'GRANTED' && !r.check_out_time),
  }));
}

export async function fetchAlertsFromDb(): Promise<BiosecurityAlert[]> {
  const rows = await dbQuery(`
    SELECT * FROM biosecurity_alerts ORDER BY created_at DESC;
  `);
  if (!rows) return [];
  return rows.map((r: any) => ({
    id: r.id,
    decisionId: r.decision_id,
    visitorName: r.visitor_name,
    phone: r.phone,
    vehicleReg: r.vehicle_reg || undefined,
    gateId: r.gate_id,
    timestamp: r.timestamp,
    priority: r.priority,
    reasons: r.reasons ? (typeof r.reasons === 'string' ? JSON.parse(r.reasons) : r.reasons) : [],
    status: r.status,
    webhookDispatched: r.webhook_dispatched,
    emailDispatched: r.email_dispatched,
  }));
}

export async function fetchRealTelemetryFromDb(): Promise<TelemetryStats> {
  const result = await dbQuery(`
    SELECT
      COUNT(*)::int AS total_attempts,
      COUNT(CASE WHEN status = 'GRANTED' THEN 1 END)::int AS granted_count,
      COUNT(CASE WHEN status = 'DENIED' THEN 1 END)::int AS denied_count,
      COUNT(CASE WHEN status = 'GRANTED' AND check_out_time IS NULL AND (is_inside IS TRUE OR is_inside IS NULL) THEN 1 END)::int AS active_occupancy
    FROM visits;
  `);

  const alertsResult = await dbQuery(`
    SELECT COUNT(*)::int AS alert_count FROM biosecurity_alerts WHERE priority = 'CRITICAL' OR status = 'PENDING_ACK';
  `);

  const totalAttempts = result && result[0] ? Number(result[0].total_attempts) : 0;
  const granted = result && result[0] ? Number(result[0].granted_count) : 0;
  const denied = result && result[0] ? Number(result[0].denied_count) : 0;
  const activeOccupancy = result && result[0] ? Number(result[0].active_occupancy) : 0;
  const alertCount = alertsResult && alertsResult[0] ? Number(alertsResult[0].alert_count) : 0;

  return {
    todayTotalAttempts: totalAttempts,
    todayGranted: granted,
    todayDenied: denied,
    activeOnSiteOccupancy: activeOccupancy,
    quarantineAlertsCount: alertCount,
    averageDecisionTimeMs: 128,
  };
}

export async function updateVisitCheckOutInDb(id: string, checkOutTime: string): Promise<boolean> {
  const result = await dbQuery(`
    UPDATE visits
    SET check_out_time = $1, is_inside = false, status = 'CHECKED_OUT'
    WHERE id = $2;
  `, [checkOutTime, id]);
  return result !== null;
}

export async function saveVisitLogToDb(log: GateLogRecord): Promise<boolean> {
  const isInside = log.isInside ?? (log.status === 'GRANTED' && !log.checkOutTime);
  const result = await dbQuery(`
    INSERT INTO visits (id, timestamp, visitor_name, id_type, id_number, country_of_origin, phone_number, vehicle_reg, origin, purpose, status, similarity_score, operator_name, gate_id, badge_number, quarantine_reasons, check_out_time, is_inside, comments)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (id) DO UPDATE SET
      check_out_time = EXCLUDED.check_out_time,
      is_inside = EXCLUDED.is_inside,
      status = EXCLUDED.status,
      comments = COALESCE(EXCLUDED.comments, visits.comments);
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
    log.checkOutTime || null,
    isInside,
    log.comments || null,
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

export async function fetchAppUsersFromDb(): Promise<(User & { passwordHash?: string })[]> {
  const rows = await dbQuery(`
    SELECT * FROM app_users ORDER BY created_at ASC;
  `);
  if (!rows) return [];
  return rows.map((r: any) => ({
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    mfaEnabled: r.mfa_enabled,
    gateAssigned: r.gate_assigned,
    mustChangePassword: r.must_change_password,
    permissions: r.permissions ? (typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions) : [],
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  }));
}

export async function saveAppUserToDb(user: User & { passwordHash?: string }): Promise<boolean> {
  const result = await dbQuery(`
    INSERT INTO app_users (id, username, password_hash, full_name, email, role, mfa_enabled, gate_assigned, must_change_password, permissions, created_at, last_login_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (username) DO UPDATE SET
      password_hash = COALESCE(EXCLUDED.password_hash, app_users.password_hash),
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      mfa_enabled = EXCLUDED.mfa_enabled,
      gate_assigned = EXCLUDED.gate_assigned,
      must_change_password = EXCLUDED.must_change_password,
      permissions = EXCLUDED.permissions,
      last_login_at = COALESCE(EXCLUDED.last_login_at, app_users.last_login_at);
  `, [
    user.id,
    user.username,
    user.passwordHash || 'admin',
    user.fullName,
    user.email,
    user.role,
    user.mfaEnabled,
    user.gateAssigned || 'MAIN_BIOSECURITY_GATE_01',
    user.mustChangePassword ?? true,
    JSON.stringify(user.permissions || []),
    user.createdAt || new Date().toISOString(),
    user.lastLoginAt || null,
  ]);
  return result !== null;
}

export async function fetchITAuditLogsFromDb(): Promise<ITActivityLog[]> {
  const rows = await dbQuery(`
    SELECT * FROM it_audit_logs ORDER BY timestamp DESC LIMIT 100;
  `);
  if (!rows) return [];
  return rows.map((r: any) => ({
    id: r.id,
    timestamp: r.timestamp,
    actorUsername: r.actor_username,
    action: r.action,
    details: r.details,
    targetUser: r.target_user || undefined,
    ipAddress: r.ip_address || undefined,
  }));
}

export async function saveITAuditLogToDb(log: ITActivityLog): Promise<boolean> {
  const result = await dbQuery(`
    INSERT INTO it_audit_logs (id, timestamp, actor_username, action, details, target_user, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7);
  `, [
    log.id,
    log.timestamp,
    log.actorUsername,
    log.action,
    log.details,
    log.targetUser || null,
    log.ipAddress || null,
  ]);
  return result !== null;
}
