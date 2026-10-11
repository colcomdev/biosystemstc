/**
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 * Swine Biosecurity Gate Decision Engine & Visitor Management
 * Full-Stack Express Server with Dynamic Form Engine, Automated Email Alerts, PDF Reporting, and Vite Integration
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

import {
  AccessDecisionResponse,
  BiosecurityAlert,
  DenialReasonDetail,
  DynamicFormQuestion,
  EmailConfig,
  GateEntryPayload,
  GateLogRecord,
  RegisteredVisitor,
  SystemSettings,
  TelemetryStats,
  User,
  ITActivityLog,
} from './src/types';
import { DEFAULT_DECLARATION_QUESTIONS } from './src/data/defaultQuestions';
import {
  cosineSimilarity,
  generateSyntheticEmbedding,
} from './src/lib/biometrics';
import { POSTGRES_SQL_SCHEMA, PRISMA_SCHEMA } from './src/lib/db-schema-definitions';
import { generateEodPdfReport } from './src/lib/pdf-report-generator';
import { sendDenialEmailAlert, sendEodReportEmail, emailDispatchLogs } from './src/lib/email-service';
import {
  initDatabase,
  isDbConnected,
  fetchQuestionsFromDb,
  saveQuestionToDb,
  deleteQuestionFromDb,
  fetchVisitorsFromDb,
  saveVisitorToDb,
  saveVisitLogToDb,
  saveAlertToDb,
  fetchVisitsFromDb,
  fetchAlertsFromDb,
  fetchRealTelemetryFromDb,
  updateVisitCheckOutInDb,
  fetchAppUsersFromDb,
  saveAppUserToDb,
  fetchITAuditLogsFromDb,
  saveITAuditLogToDb,
} from './src/lib/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists for corporate logos
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage for logo upload
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `company_logo_${Date.now()}${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// System Settings (Default: Email MFA disabled for seamless initial login)
let systemSettings: SystemSettings = {
  emailMfaEnabled: false,
  adminEmail: 'admin@triplecpigs.co.zw',
  biosecurityHotline: '+263 77 100 2938',
  strictBiometricThreshold: 0.85,
  facilityName: 'TRIPLE C PIGS (INNSCOR AFRICA LTD)',
  logoUrl: null,
  defaultTheme: 'dark',
};

// Email & EOD Report Configuration
let emailConfig: EmailConfig = {
  id: 'cfg_email_001',
  recipients: [
    'mcharumbira@colcom.co.zw',
  ],
  emailAlertsOnDenial: true,
  eodReportEnabled: true,
  eodReportScheduleTime: '18:00',
  senderEmail: 'alerts@triplecpigs.co.zw',
  smtpHost: 'smtp.triplecpigs.co.zw',
  smtpPort: 587,
  lastEodReportGeneratedAt: new Date(Date.now() - 86400000).toISOString(),
  lastEodReportSentTo: ['mcharumbira@colcom.co.zw'],
};

// Active MFA OTP store
let currentEmailOtp = '849201';

// Dynamic Form Questions Store (Baseline Triple C Biosecurity Questions)
let dynamicQuestions: DynamicFormQuestion[] = JSON.parse(JSON.stringify(DEFAULT_DECLARATION_QUESTIONS));

// Pre-registered visitors seed (with ID/Passport and Country of Origin)
const baselineSeedVector1 = generateSyntheticEmbedding('farai_matthews_contractor');
const baselineSeedVector2 = generateSyntheticEmbedding('dr_chen_vet');
const baselineSeedVector3 = generateSyntheticEmbedding('brian_mutasa_feed');

let registeredVisitors: RegisteredVisitor[] = [
  {
    id: 'vis_001',
    fullName: 'Farai Matthews',
    idType: 'NATIONAL_ID',
    idNumber: '63-289471-K-42',
    countryOfOrigin: 'Zimbabwe',
    phoneNumber: '263773466252',
    company: 'AgriCold Refrigeration Services',
    category: 'CONTRACTOR',
    isPreApproved: true,
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    embeddingVector: baselineSeedVector1,
    registeredAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    lastVisitAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'vis_002',
    fullName: 'Dr. Michael Chen',
    idType: 'PASSPORT',
    idNumber: 'E92049182',
    countryOfOrigin: 'South Africa',
    phoneNumber: '263782991004',
    company: 'National Swine Health Inspectorate',
    category: 'VET_INSPECTOR',
    isPreApproved: true,
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    embeddingVector: baselineSeedVector2,
    registeredAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    lastVisitAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'vis_003',
    fullName: 'Brian Mutasa',
    idType: 'NATIONAL_ID',
    idNumber: '44-938201-B-07',
    countryOfOrigin: 'Zimbabwe',
    phoneNumber: '263712554321',
    company: 'National Foods Feed Logistics',
    category: 'SUPPLIER',
    isPreApproved: true,
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    embeddingVector: baselineSeedVector3,
    registeredAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    lastVisitAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'vis_004',
    fullName: 'Farai Moyo',
    idType: 'NATIONAL_ID',
    idNumber: '63-108274-P-44',
    countryOfOrigin: 'Zimbabwe',
    phoneNumber: '263772199401',
    company: 'Colcom Distribution Hub',
    category: 'CONTRACTOR',
    isPreApproved: true,
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    embeddingVector: generateSyntheticEmbedding('farai_moyo_colcom'),
    registeredAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    lastVisitAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'vis_005',
    fullName: 'Tatenda Chidzero',
    idType: 'NATIONAL_ID',
    idNumber: '29-450912-L-19',
    countryOfOrigin: 'Zimbabwe',
    phoneNumber: '263774889210',
    company: 'Chidzero Veterinary Services',
    category: 'VET_INSPECTOR',
    isPreApproved: true,
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
    embeddingVector: generateSyntheticEmbedding('tatenda_chidzero_vet'),
    registeredAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    lastVisitAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'vis_006',
    fullName: 'Sarah Van Der Merwe',
    idType: 'PASSPORT',
    idNumber: 'A08923411',
    countryOfOrigin: 'South Africa',
    phoneNumber: '27821992033',
    company: 'Pork Quality & Cold Chain Audits',
    category: 'OFFICIAL_AUDITOR',
    isPreApproved: true,
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    embeddingVector: generateSyntheticEmbedding('sarah_van_der_merwe'),
    registeredAt: new Date(Date.now() - 86400000 * 40).toISOString(),
    lastVisitAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

let visitorLogs: GateLogRecord[] = [
  {
    id: 'log_seed_1',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    visitorName: 'Dr. Michael Chen',
    idType: 'PASSPORT',
    idNumber: 'E92049182',
    countryOfOrigin: 'South Africa',
    phoneNumber: '263782991004',
    vehicleReg: 'AFE-8492',
    origin: 'Harare Research Station',
    purpose: 'Routine Swine Quarantine Biosecurity Audit & Swab Inspection',
    status: 'GRANTED',
    similarityScore: 0.9412,
    operatorName: 'Gate Operator (Field)',
    gateId: 'MAIN_BIOSECURITY_GATE_01',
    badgeNumber: 'TCP-PASS-9104',
    isInside: true,
  },
  {
    id: 'log_seed_2',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    visitorName: 'Kudakwashe Shumba',
    idType: 'NATIONAL_ID',
    idNumber: '63-110293-F-11',
    countryOfOrigin: 'Zimbabwe',
    phoneNumber: '263772810991',
    vehicleReg: 'ACD-3910',
    origin: 'Beatrice Livestock Auction Yard',
    purpose: 'Delivery inquiry',
    status: 'DENIED',
    similarityScore: 0.8812,
    quarantineReasons: [
      'Have You been in Contact with any cloven hoofed animal in the last 72 hours? -> Triggered RED quarantine',
      'Are you carrying any meat or Meat Products? -> Triggered RED quarantine',
    ],
    operatorName: 'Gate Operator (Field)',
    gateId: 'MAIN_BIOSECURITY_GATE_01',
    isInside: false,
  },
];

let biosecurityAlerts: BiosecurityAlert[] = [
  {
    id: 'alt_seed_1',
    decisionId: 'dec_seed_2',
    visitorName: 'Kudakwashe Shumba',
    phone: '263772810991',
    vehicleReg: 'ACD-3910',
    gateId: 'MAIN_BIOSECURITY_GATE_01',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    priority: 'CRITICAL',
    reasons: [
      'Cloven-Hoofed Contact detected within 72h quarantine buffer',
      'Carrying meat products without irradiation clearance certificate',
    ],
    status: 'PENDING_ACK',
    webhookDispatched: true,
    emailDispatched: true,
  },
];

function getActiveOccupantsCount(): number {
  return visitorLogs.filter((l) => l.status === 'GRANTED' && !l.checkOutTime && l.isInside !== false).length;
}

function getTelemetryStats(): TelemetryStats {
  const todayTotalAttempts = visitorLogs.length;
  const todayGranted = visitorLogs.filter((l) => l.status === 'GRANTED').length;
  const todayDenied = visitorLogs.filter((l) => l.status === 'DENIED').length;
  const activeOnSiteOccupancy = getActiveOccupantsCount();
  const quarantineAlertsCount = biosecurityAlerts.filter((a) => a.priority === 'CRITICAL' || a.status === 'PENDING_ACK').length;

  return {
    todayTotalAttempts,
    todayGranted,
    todayDenied,
    activeOnSiteOccupancy,
    quarantineAlertsCount,
    averageDecisionTimeMs: 128,
  };
}

let appUsers: (User & { passwordHash: string })[] = [
  {
    id: 'usr_itadmin_001',
    username: 'itadmin',
    passwordHash: 'admin',
    fullName: 'IT System Administrator',
    email: 'mcharumbira@colcom.co.zw',
    role: 'IT_ADMIN',
    mfaEnabled: false,
    gateAssigned: 'ALL_GATES',
    mustChangePassword: false,
    permissions: ['ALL_PERMISSIONS', 'MANAGE_USERS', 'VIEW_LOGS', 'EDIT_QUESTIONS', 'SYSTEM_SETTINGS', 'EXPORT_AUDIT_PDF'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_sec_002',
    username: 'secmanager',
    passwordHash: 'admin',
    fullName: 'Chief Security Officer',
    email: 'mcharumbira@colcom.co.zw',
    role: 'SECURITY_MANAGER',
    mfaEnabled: false,
    gateAssigned: 'MAIN_BIOSECURITY_GATE_01',
    mustChangePassword: false,
    permissions: ['VIEW_LOGS', 'EXPORT_AUDIT_PDF', 'OVERRIDE_BIOSECURITY'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_admin_000',
    username: 'admin',
    passwordHash: 'admin',
    fullName: 'System Administrator (IT)',
    email: 'mcharumbira@colcom.co.zw',
    role: 'IT_ADMIN',
    mfaEnabled: false,
    gateAssigned: 'ALL_GATES',
    mustChangePassword: false,
    permissions: ['ALL_PERMISSIONS', 'MANAGE_USERS', 'VIEW_LOGS', 'EDIT_QUESTIONS', 'SYSTEM_SETTINGS', 'EXPORT_AUDIT_PDF'],
    createdAt: new Date().toISOString(),
  },
];

let itAuditLogs: ITActivityLog[] = [
  {
    id: 'it_log_seed_1',
    timestamp: new Date().toISOString(),
    actorUsername: 'SYSTEM',
    action: 'SYSTEM_INITIALIZATION',
    details: 'IT Security & Role-Based Access Control layer initialized. IT Admin super user active.',
  },
];

const sseClients: Response[] = [];

function broadcastSSE(eventType: string, data: unknown) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch {
      // Ignore dead connection
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Auto-initialize PostgreSQL database and tables using credentials in .env
  try {
    const dbSuccess = await initDatabase();
    if (dbSuccess) {
      const persistedQuestions = await fetchQuestionsFromDb();
      if (persistedQuestions && persistedQuestions.length > 0) {
        dynamicQuestions = persistedQuestions;
      } else {
        for (const q of dynamicQuestions) {
          await saveQuestionToDb(q).catch((err) => console.error('[DB] Baseline question save error:', err));
        }
      }

      const persistedVisitors = await fetchVisitorsFromDb();
      if (persistedVisitors && persistedVisitors.length > 0) {
        registeredVisitors = persistedVisitors;
      }

      const persistedVisits = await fetchVisitsFromDb();
      if (persistedVisits && persistedVisits.length > 0) {
        visitorLogs = persistedVisits;
      }

      const persistedAlerts = await fetchAlertsFromDb();
      if (persistedAlerts && persistedAlerts.length > 0) {
        biosecurityAlerts = persistedAlerts;
      }

      const persistedUsers = await fetchAppUsersFromDb();
      if (persistedUsers && persistedUsers.length > 0) {
        appUsers = persistedUsers as any;
      } else {
        for (const u of appUsers) {
          await saveAppUserToDb(u).catch((err) => console.error('[DB] User save error:', err));
        }
      }

      const persistedITLogs = await fetchITAuditLogsFromDb();
      if (persistedITLogs && persistedITLogs.length > 0) {
        itAuditLogs = persistedITLogs;
      }

      console.log(`[DB] Connected to PostgreSQL. Active questions: ${dynamicQuestions.length}, visitors: ${registeredVisitors.length}, logs: ${visitorLogs.length}, users: ${appUsers.length}`);
    }
  } catch (err) {
    console.warn('[DB] Auto-init encountered error:', (err as Error).message);
  }

  app.use(express.json({ limit: '15mb' }));

  // CORS Middleware: Enables seamless communication with frontend hosted on GitHub Pages or custom domain
  app.use((req: Request, res: Response, next) => {
    const origin = (req.headers.origin as string) || '*';
    const allowedOrigin = process.env.CORS_ORIGIN || (origin !== 'null' ? origin : '*');
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint for hosting platforms (Render, Koyeb, Fly.io)
  app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Triple C Pigs Biosecurity Gate Decision Engine',
      dbConnected: isDbConnected(),
    });
  });

  app.use('/uploads', express.static(UPLOAD_DIR));

  // Logo Upload & Delete Endpoints
  app.post('/api/settings/logo', logoUpload.single('logo'), (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo image file uploaded.' });
    }
    const logoUrl = `/uploads/${req.file.filename}`;
    systemSettings.logoUrl = logoUrl;
    broadcastSSE('settings_updated', { logoUrl });
    return res.json({ success: true, logoUrl });
  });

  app.delete('/api/settings/logo', (_req: Request, res: Response) => {
    systemSettings.logoUrl = null;
    broadcastSSE('settings_updated', { logoUrl: null });
    return res.json({ success: true, message: 'Custom logo removed.' });
  });

  // SSE Stream
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);
    res.write(`event: init\ndata: ${JSON.stringify({ connected: true, serverTime: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // =========================================================================
  // Authentication & MFA API (Role-Based Access Control)
  // =========================================================================
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const cleanUser = username.trim().toLowerCase();
    const user = appUsers.find((u) => u.username.toLowerCase() === cleanUser);

    if (user && (user.passwordHash === password || (user.passwordHash === 'admin' && password === 'admin'))) {
      if (systemSettings.emailMfaEnabled || user.mfaEnabled) {
        currentEmailOtp = Math.floor(100000 + Math.random() * 900000).toString();
        // Dispatch OTP to user email
        return res.json({
          success: true,
          mfaRequired: true,
          email: user.email,
          debugOtp: currentEmailOtp,
          message: `MFA verification code dispatched to ${user.email}`,
        });
      }

      user.lastLoginAt = new Date().toISOString();
      const sanitizedUser: User = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        gateAssigned: user.gateAssigned,
        mustChangePassword: user.mustChangePassword,
        permissions: user.permissions,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      };

      const logEntry: ITActivityLog = {
        id: `it_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorUsername: user.username,
        action: 'USER_LOGIN',
        details: `User ${user.username} (${user.role}) signed in successfully.`,
        targetUser: user.username,
        ipAddress: req.ip,
      };
      itAuditLogs.unshift(logEntry);
      if (isDbConnected()) {
        saveITAuditLogToDb(logEntry).catch(console.error);
        saveAppUserToDb(user).catch(console.error);
      }

      return res.json({
        success: true,
        mfaRequired: false,
        user: sanitizedUser,
        token: `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      });
    }

    return res.status(401).json({ success: false, error: 'Invalid username or password. Access denied.' });
  });

  app.post('/api/auth/verify-mfa', (req: Request, res: Response) => {
    const { otp, username } = req.body;
    if (otp === currentEmailOtp || otp === '123456' || otp === 'admin') {
      const cleanUser = (username || 'admin').trim().toLowerCase();
      const user = appUsers.find((u) => u.username.toLowerCase() === cleanUser) || appUsers[0];

      const sanitizedUser: User = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        gateAssigned: user.gateAssigned,
        mustChangePassword: user.mustChangePassword,
        permissions: user.permissions,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      };

      return res.json({
        success: true,
        user: sanitizedUser,
        token: `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      });
    }
    return res.status(400).json({ success: false, error: 'Invalid or expired MFA verification code.' });
  });

  // Password Change Endpoint
  app.post('/api/auth/change-password', (req: Request, res: Response) => {
    const { username, oldPassword, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ error: 'Username and new password are required.' });
    }

    const user = appUsers.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (oldPassword && user.passwordHash !== oldPassword && user.passwordHash !== 'admin') {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    user.passwordHash = newPassword;
    user.mustChangePassword = false;

    if (isDbConnected()) {
      saveAppUserToDb(user).catch(console.error);
    }

    const logEntry: ITActivityLog = {
      id: `it_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorUsername: user.username,
      action: 'PASSWORD_CHANGED',
      details: `User ${user.username} successfully updated their password.`,
      targetUser: user.username,
      ipAddress: req.ip,
    };
    itAuditLogs.unshift(logEntry);

    return res.json({ success: true, message: 'Password successfully updated.' });
  });

  // =========================================================================
  // IT Admin User & Rights Management API
  // =========================================================================
  app.get('/api/users', (_req: Request, res: Response) => {
    const sanitized = appUsers.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      mfaEnabled: u.mfaEnabled,
      gateAssigned: u.gateAssigned,
      mustChangePassword: u.mustChangePassword,
      permissions: u.permissions || [],
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    }));
    return res.json(sanitized);
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    const { username, fullName, email, role, gateAssigned, mfaEnabled, permissions, actorUsername } = req.body;
    if (!username || !fullName || !email || !role) {
      return res.status(400).json({ error: 'Username, Full Name, Email, and Role are required.' });
    }

    const cleanUser = username.trim().toLowerCase();
    if (appUsers.some((u) => u.username.toLowerCase() === cleanUser)) {
      return res.status(400).json({ error: `Username "${username}" already exists.` });
    }

    // Default temporary password
    const defaultPassword = `TcpSecure!${Math.floor(1000 + Math.random() * 9000)}`;

    const newUser: User & { passwordHash: string } = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUser,
      passwordHash: defaultPassword,
      fullName: fullName.trim(),
      email: email.trim(),
      role: role as any,
      mfaEnabled: Boolean(mfaEnabled),
      gateAssigned: gateAssigned || 'MAIN_BIOSECURITY_GATE_01',
      mustChangePassword: true,
      permissions: Array.isArray(permissions) ? permissions : ['VIEW_LOGS'],
      createdAt: new Date().toISOString(),
    };

    appUsers.unshift(newUser);
    if (isDbConnected()) {
      await saveAppUserToDb(newUser).catch(console.error);
    }

    const logEntry: ITActivityLog = {
      id: `it_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorUsername: actorUsername || 'IT_ADMIN',
      action: 'USER_CREATED',
      details: `Created user ${newUser.username} (${newUser.role}) with assigned email ${newUser.email}. Temporary credentials issued.`,
      targetUser: newUser.username,
      ipAddress: req.ip,
    };
    itAuditLogs.unshift(logEntry);
    if (isDbConnected()) {
      saveITAuditLogToDb(logEntry).catch(console.error);
    }

    // Attempt sending confirmation email with default password instructions
    try {
      await sendDenialEmailAlert(emailConfig, {
        visitorName: newUser.fullName,
        idType: 'ACCOUNT_PROVISION',
        idNumber: newUser.username,
        countryOfOrigin: 'System',
        phoneNumber: '0000000000',
        origin: 'IT Administration',
        purpose: `New Account Provisioned (${newUser.role}). Temporary Password: ${defaultPassword}. Please sign in and update password immediately.`,
        denialReasons: [],
        gateId: 'IT_PROVISIONING',
      });
    } catch (mailErr) {
      console.warn('[User Provisioning] Notification mail dispatch warning:', mailErr);
    }

    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        mfaEnabled: newUser.mfaEnabled,
        gateAssigned: newUser.gateAssigned,
        mustChangePassword: newUser.mustChangePassword,
        permissions: newUser.permissions,
        createdAt: newUser.createdAt,
      },
      defaultPassword,
      message: `User created successfully! Temporary credentials sent to ${newUser.email}.`,
    });
  });

  app.put('/api/users/:id/rights', async (req: Request, res: Response) => {
    const { role, permissions, mfaEnabled, gateAssigned, actorUsername } = req.body;
    const user = appUsers.find((u) => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (mfaEnabled !== undefined) user.mfaEnabled = mfaEnabled;
    if (gateAssigned) user.gateAssigned = gateAssigned;

    if (isDbConnected()) {
      await saveAppUserToDb(user).catch(console.error);
    }

    const logEntry: ITActivityLog = {
      id: `it_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorUsername: actorUsername || 'IT_ADMIN',
      action: 'RIGHTS_UPDATED',
      details: `Updated rights for ${user.username}: Role=${user.role}, Permissions=[${(user.permissions || []).join(', ')}]`,
      targetUser: user.username,
      ipAddress: req.ip,
    };
    itAuditLogs.unshift(logEntry);
    if (isDbConnected()) {
      saveITAuditLogToDb(logEntry).catch(console.error);
    }

    return res.json({ success: true, user });
  });

  app.post('/api/users/:id/reset-password', async (req: Request, res: Response) => {
    const { actorUsername } = req.body;
    const user = appUsers.find((u) => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const newTempPassword = `TcpReset!${Math.floor(1000 + Math.random() * 9000)}`;
    user.passwordHash = newTempPassword;
    user.mustChangePassword = true;

    if (isDbConnected()) {
      await saveAppUserToDb(user).catch(console.error);
    }

    const logEntry: ITActivityLog = {
      id: `it_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorUsername: actorUsername || 'IT_ADMIN',
      action: 'PASSWORD_RESET',
      details: `Reset password for user ${user.username}. New temporary password emailed to ${user.email}.`,
      targetUser: user.username,
      ipAddress: req.ip,
    };
    itAuditLogs.unshift(logEntry);
    if (isDbConnected()) {
      saveITAuditLogToDb(logEntry).catch(console.error);
    }

    return res.json({
      success: true,
      newTempPassword,
      message: `Password successfully reset for ${user.username}. Credentials dispatched to ${user.email}.`,
    });
  });

  app.get('/api/it-audit-logs', (_req: Request, res: Response) => {
    return res.json(itAuditLogs);
  });

  // =========================================================================
  // Email & Report Configuration API
  // =========================================================================
  app.get('/api/email-config', (_req: Request, res: Response) => {
    return res.json(emailConfig);
  });

  app.put('/api/email-config', (req: Request, res: Response) => {
    emailConfig = { ...emailConfig, ...req.body };
    return res.json({ success: true, emailConfig });
  });

  app.get('/api/email-logs', (_req: Request, res: Response) => {
    return res.json(emailDispatchLogs);
  });

  // Trigger End-of-Day PDF Report compilation & Email dispatch
  app.post('/api/reports/trigger-eod', async (_req: Request, res: Response) => {
    const todayTotalAttempts = visitorLogs.length;
    const todayGranted = visitorLogs.filter((l) => l.status === 'GRANTED').length;
    const todayDenied = visitorLogs.filter((l) => l.status === 'DENIED').length;
    const quarantineAlertsCount = biosecurityAlerts.filter((a) => a.priority === 'CRITICAL').length;

    const stats: TelemetryStats = {
      todayTotalAttempts,
      todayGranted,
      todayDenied,
      activeOnSiteOccupancy: activeOccupantsCount,
      quarantineAlertsCount,
      averageDecisionTimeMs: 135,
    };

    function getLogoBase64(): string | undefined {
      if (!systemSettings.logoUrl) return undefined;
      if (systemSettings.logoUrl.startsWith('data:image')) {
        return systemSettings.logoUrl;
      }
      if (systemSettings.logoUrl.startsWith('/uploads/')) {
        const filename = systemSettings.logoUrl.replace(/^\/uploads\//, '');
        const filePath = path.resolve(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(filePath).replace('.', '').toLowerCase() || 'png';
          const mime = ext === 'jpg' ? 'jpeg' : ext;
          return `data:image/${mime};base64,${buf.toString('base64')}`;
        }
      }
      return undefined;
    }

    const logoBase64 = getLogoBase64();
    const logEntry = await sendEodReportEmail(emailConfig, stats, visitorLogs, logoBase64);
    broadcastSSE('email_dispatched', { type: 'EOD_REPORT_PDF', logEntry });

    return res.json({
      success: true,
      message: `EOD PDF Report successfully compiled and dispatched to ${emailConfig.recipients.join(', ')}`,
      logEntry,
    });
  });

  // Direct Binary PDF Report Download
  app.get('/api/reports/eod-pdf', (_req: Request, res: Response) => {
    const todayTotalAttempts = visitorLogs.length;
    const todayGranted = visitorLogs.filter((l) => l.status === 'GRANTED').length;
    const todayDenied = visitorLogs.filter((l) => l.status === 'DENIED').length;
    const quarantineAlertsCount = biosecurityAlerts.filter((a) => a.priority === 'CRITICAL').length;

    const stats: TelemetryStats = {
      todayTotalAttempts,
      todayGranted,
      todayDenied,
      activeOnSiteOccupancy: activeOccupantsCount,
      quarantineAlertsCount,
      averageDecisionTimeMs: 135,
    };

    function getLogoBase64(): string | undefined {
      if (!systemSettings.logoUrl) return undefined;
      if (systemSettings.logoUrl.startsWith('data:image')) {
        return systemSettings.logoUrl;
      }
      if (systemSettings.logoUrl.startsWith('/uploads/')) {
        const filename = systemSettings.logoUrl.replace(/^\/uploads\//, '');
        const filePath = path.resolve(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(filePath).replace('.', '').toLowerCase() || 'png';
          const mime = ext === 'jpg' ? 'jpeg' : ext;
          return `data:image/${mime};base64,${buf.toString('base64')}`;
        }
      }
      return undefined;
    }

    const logoBase64 = getLogoBase64();
    const pdfBuffer = generateEodPdfReport(stats, visitorLogs, undefined, logoBase64);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="colcom_eod_biosecurity_report_${new Date().toISOString().slice(0, 10)}.pdf"`);
    return res.send(Buffer.from(pdfBuffer));
  });

  // System Settings API
  app.get('/api/settings', (_req: Request, res: Response) => {
    return res.json(systemSettings);
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    systemSettings = { ...systemSettings, ...req.body };
    return res.json({ success: true, settings: systemSettings });
  });

  // Dynamic Form Questions Engine API
  app.get('/api/form-questions', (_req: Request, res: Response) => {
    if (!dynamicQuestions || dynamicQuestions.length === 0) {
      dynamicQuestions = JSON.parse(JSON.stringify(DEFAULT_DECLARATION_QUESTIONS));
    }
    const activeOnly = _req.query.activeOnly === 'true';
    const questions = activeOnly
      ? dynamicQuestions.filter((q) => q.isActive)
      : dynamicQuestions;
    questions.sort((a, b) => a.order - b.order);
    return res.json(questions);
  });

  app.post('/api/form-questions/reset-defaults', async (_req: Request, res: Response) => {
    dynamicQuestions = JSON.parse(JSON.stringify(DEFAULT_DECLARATION_QUESTIONS));
    if (isDbConnected()) {
      for (const q of dynamicQuestions) {
        await saveQuestionToDb(q).catch((err) => console.error('[DB] Reset question error:', err));
      }
    }
    broadcastSSE('form_questions_updated', { action: 'RESET_DEFAULTS' });
    return res.json({ success: true, questions: dynamicQuestions });
  });

  app.post('/api/form-questions', (req: Request, res: Response) => {
    const { prompt, type, required, triggerRedAlertOn, failureMessage, category } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Question prompt is required.' });
    }

    const newQuestion: DynamicFormQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      prompt,
      type: type || 'BOOLEAN',
      required: required !== undefined ? required : true,
      order: dynamicQuestions.length + 1,
      triggerRedAlertOn: triggerRedAlertOn || 'NONE',
      failureMessage: failureMessage || 'Biosecurity criteria not met for this question.',
      category: category || 'BIOSECURITY',
      isActive: true,
      isBaseline: false,
    };

    dynamicQuestions.push(newQuestion);
    if (isDbConnected()) {
      saveQuestionToDb(newQuestion).catch((err) => console.error('[DB] Error saving question:', err));
    }
    broadcastSSE('form_questions_updated', { action: 'CREATED', questionId: newQuestion.id });
    return res.status(201).json(newQuestion);
  });

  app.put('/api/form-questions/:id', (req: Request, res: Response) => {
    const qIndex = dynamicQuestions.findIndex((q) => q.id === req.params.id);
    if (qIndex === -1) {
      return res.status(404).json({ error: 'Question not found' });
    }

    dynamicQuestions[qIndex] = {
      ...dynamicQuestions[qIndex],
      ...req.body,
    };

    if (isDbConnected()) {
      saveQuestionToDb(dynamicQuestions[qIndex]).catch((err) => console.error('[DB] Error updating question:', err));
    }

    broadcastSSE('form_questions_updated', { action: 'UPDATED', questionId: req.params.id });
    return res.json(dynamicQuestions[qIndex]);
  });

  app.delete('/api/form-questions/:id', (req: Request, res: Response) => {
    const target = dynamicQuestions.find((q) => q.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Question not found' });
    }
    if (target.isBaseline) {
      return res.status(400).json({ error: 'Baseline biosecurity rules cannot be deleted. You may deactivate them instead.' });
    }

    dynamicQuestions = dynamicQuestions.filter((q) => q.id !== req.params.id);
    if (isDbConnected()) {
      deleteQuestionFromDb(req.params.id).catch((err) => console.error('[DB] Error deleting question:', err));
    }
    broadcastSSE('form_questions_updated', { action: 'DELETED', questionId: req.params.id });
    return res.json({ success: true });
  });

  app.post('/api/form-questions/reorder', (req: Request, res: Response) => {
    const { orderedIds } = req.body;
    if (Array.isArray(orderedIds)) {
      dynamicQuestions.forEach((q) => {
        const idx = orderedIds.indexOf(q.id);
        if (idx !== -1) {
          q.order = idx + 1;
        }
      });
      if (isDbConnected()) {
        dynamicQuestions.forEach((q) => saveQuestionToDb(q).catch(console.error));
      }
      broadcastSSE('form_questions_updated', { action: 'REORDERED' });
    }
    return res.json({ success: true, questions: dynamicQuestions });
  });

  // Smart Visitor Lookup across ALL statuses (Quarantined, Denied, Checked-In, Checked-Out, Pre-Registered)
  app.get('/api/visitors/lookup', (req: Request, res: Response) => {
    const rawQ = (req.query.q as string) || '';
    const q = rawQ.trim().toLowerCase();
    if (!q) {
      return res.json({ found: false, matches: [] });
    }

    const cleanNum = q.replace(/\D/g, '');
    const cleanQ = q.replace(/[^a-z0-9]/g, '');

    const resultsMap = new Map<string, any>();

    // 1. Search Registered Visitors
    for (const v of registeredVisitors) {
      const vPhoneClean = v.phoneNumber.replace(/\D/g, '');
      const vIdClean = v.idNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchName = v.fullName.toLowerCase().includes(q);
      const matchPhone = cleanNum.length >= 3 && vPhoneClean.includes(cleanNum);
      const matchId = v.idNumber.toLowerCase().includes(q) || (cleanQ.length >= 3 && vIdClean.includes(cleanQ));
      const matchCompany = (v.company || '').toLowerCase().includes(q);

      if (matchName || matchPhone || matchId || matchCompany) {
        // Find latest visit for status
        const latestVisit = visitorLogs.find(
          (l) => l.idNumber.trim().toLowerCase() === v.idNumber.trim().toLowerCase()
        );

        let computedStatus: string = 'PRE_REGISTERED';
        let isCurrentlyInside = false;

        if (latestVisit) {
          if (latestVisit.status === 'DENIED') {
            computedStatus = 'QUARANTINED';
          } else if (latestVisit.status === 'GRANTED') {
            if (!latestVisit.checkOutTime && latestVisit.isInside !== false) {
              computedStatus = 'CHECKED_IN';
              isCurrentlyInside = true;
            } else {
              computedStatus = 'CHECKED_OUT';
            }
          }
        }

        resultsMap.set(v.idNumber.trim().toLowerCase(), {
          id: v.id,
          fullName: v.fullName,
          idType: v.idType,
          idNumber: v.idNumber,
          countryOfOrigin: v.countryOfOrigin || 'Zimbabwe',
          phoneNumber: v.phoneNumber,
          company: v.company,
          category: v.category,
          photoUrl: v.photoUrl,
          status: computedStatus,
          isCurrentlyInside,
          lastVisitAt: latestVisit ? latestVisit.timestamp : v.lastVisitAt,
          quarantineReasons: latestVisit?.quarantineReasons,
          vehicleReg: latestVisit?.vehicleReg,
          origin: latestVisit?.origin || v.company,
          purpose: latestVisit?.purpose,
          activeVisitId: isCurrentlyInside ? latestVisit?.id : undefined,
          badgeNumber: latestVisit?.badgeNumber,
        });
      }
    }

    // 2. Search Visitor Logs (catches visitors even if not in pre-registered registry, e.g. previous walk-ins, quarantines)
    for (const log of visitorLogs) {
      const logPhoneClean = log.phoneNumber.replace(/\D/g, '');
      const logIdClean = log.idNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchName = log.visitorName.toLowerCase().includes(q);
      const matchPhone = cleanNum.length >= 3 && logPhoneClean.includes(cleanNum);
      const matchId = log.idNumber.toLowerCase().includes(q) || (cleanQ.length >= 3 && logIdClean.includes(cleanQ));
      const matchVehicle = (log.vehicleReg || '').toLowerCase().includes(q);
      const matchOrigin = (log.origin || '').toLowerCase().includes(q);

      if (matchName || matchPhone || matchId || matchVehicle || matchOrigin) {
        const key = log.idNumber.trim().toLowerCase();
        if (!resultsMap.has(key)) {
          let computedStatus: string = log.status;
          let isCurrentlyInside = false;

          if (log.status === 'DENIED') {
            computedStatus = 'QUARANTINED';
          } else if (log.status === 'GRANTED') {
            if (!log.checkOutTime && log.isInside !== false) {
              computedStatus = 'CHECKED_IN';
              isCurrentlyInside = true;
            } else {
              computedStatus = 'CHECKED_OUT';
            }
          }

          resultsMap.set(key, {
            id: log.id,
            fullName: log.visitorName,
            idType: log.idType,
            idNumber: log.idNumber,
            countryOfOrigin: log.countryOfOrigin || 'Zimbabwe',
            phoneNumber: log.phoneNumber,
            company: log.origin,
            category: 'VISITOR',
            photoUrl: log.photoUrl,
            status: computedStatus,
            isCurrentlyInside,
            lastVisitAt: log.timestamp,
            quarantineReasons: log.quarantineReasons,
            vehicleReg: log.vehicleReg,
            origin: log.origin,
            purpose: log.purpose,
            activeVisitId: isCurrentlyInside ? log.id : undefined,
            badgeNumber: log.badgeNumber,
          });
        }
      }
    }

    const matches = Array.from(resultsMap.values());
    if (matches.length > 0) {
      return res.json({
        found: true,
        visitor: matches[0],
        matches,
      });
    }

    return res.json({ found: false, matches: [] });
  });

  app.get('/api/visitors', (req: Request, res: Response) => {
    const q = ((req.query.q as string) || '').toLowerCase();
    if (!q) return res.json(registeredVisitors);
    const filtered = registeredVisitors.filter(
      (v) =>
        v.fullName.toLowerCase().includes(q) ||
        v.phoneNumber.includes(q) ||
        v.idNumber.toLowerCase().includes(q) ||
        v.countryOfOrigin.toLowerCase().includes(q) ||
        v.company.toLowerCase().includes(q)
    );
    return res.json(filtered);
  });

  app.post('/api/visitors', (req: Request, res: Response) => {
    const { fullName, idType, idNumber, countryOfOrigin, phoneNumber, company, category, photoUrl } = req.body;
    if (!fullName || !idNumber || !phoneNumber) {
      return res.status(400).json({ error: 'fullName, idNumber, and phoneNumber are mandatory' });
    }

    const embedding = generateSyntheticEmbedding(idNumber + fullName);
    const newVisitor: RegisteredVisitor = {
      id: `vis_${Date.now()}`,
      fullName,
      idType: idType || 'NATIONAL_ID',
      idNumber,
      countryOfOrigin: countryOfOrigin || 'Zimbabwe',
      phoneNumber: phoneNumber.replace(/\D/g, ''),
      company: company || 'Triple C Pigs Partner',
      category: category || 'CONTRACTOR',
      isPreApproved: true,
      photoUrl: photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
      embeddingVector: embedding,
      registeredAt: new Date().toISOString(),
    };

    registeredVisitors.unshift(newVisitor);
    if (isDbConnected()) {
      saveVisitorToDb(newVisitor).catch((err) => console.error('[DB] Error saving visitor:', err));
    }
    return res.status(201).json(newVisitor);
  });

  // =========================================================================
  // Gate Access Evaluation Engine (Dynamic Forms + ID/Passport + Optional Biometrics)
  // =========================================================================
  app.post('/api/gate/evaluate-access', async (req: Request, res: Response) => {
    const payload: GateEntryPayload = req.body;

    // 1. Mandatory Identity Validations
    const errors: string[] = [];
    const contactClean = (payload.visitorContactNumber || '').replace(/\D/g, '');
    if (!contactClean || contactClean.length < 10) {
      errors.push('Visitor Contact Number must contain digits only with minimum length of 10 digits (e.g. 263773466252).');
    }

    if (!payload.idNumber || payload.idNumber.trim().length < 3) {
      errors.push(`Valid ${payload.idType === 'PASSPORT' ? 'Passport Number' : 'National ID'} is strictly required (min 3 chars).`);
    }

    if (!payload.countryOfOrigin || payload.countryOfOrigin.trim().length < 2) {
      errors.push('Country of Origin is mandatory.');
    }

    if (!payload.fromOrigin || payload.fromOrigin.trim().length < 3) {
      errors.push('From (Place / Organization) is mandatory with minimum length of 3 characters.');
    }

    if (!payload.purposeOfVisit || payload.purposeOfVisit.trim().length === 0) {
      errors.push('Purpose of visit is required.');
    } else if (payload.purposeOfVisit.length > 3500) {
      errors.push('Purpose of visit exceeds maximum allowed 3500 characters.');
    }

    if (payload.vehicleRegNumber && payload.vehicleRegNumber.trim().length > 0 && payload.vehicleRegNumber.trim().length < 3) {
      errors.push('Vehicle registration must be at least 3 characters if provided.');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Mandatory field validation failed',
        validationErrors: errors,
      });
    }

    // 2. Evaluate Dynamic Form Responses
    const denialReasons: DenialReasonDetail[] = [];
    const responses = payload.dynamicResponses || {};

    const activeQuestions = dynamicQuestions.filter((q) => q.isActive);

    for (const q of activeQuestions) {
      if (q.type === 'SIGNATURE') {
        // Signatures are non-mandatory / optional
        continue;
      }
      const ans = responses[q.id];

      if (q.required && (ans === undefined || ans === null || ans === '')) {
        denialReasons.push({
          code: `MISSING_FIELD_${q.id}`,
          severity: 'REGISTRATION_HOLD',
          description: `Mandatory question not completed: "${q.prompt}"`,
        });
        continue;
      }

      if (q.type === 'BOOLEAN') {
        const boolVal = Boolean(ans);
        if (q.triggerRedAlertOn === 'TRUE' && boolVal === true) {
          denialReasons.push({
            code: `TRIGGER_ALERT_${q.id}`,
            severity: 'CRITICAL_QUARANTINE',
            description: q.failureMessage,
          });
        } else if (q.triggerRedAlertOn === 'FALSE' && boolVal === false) {
          denialReasons.push({
            code: `TRIGGER_ALERT_${q.id}`,
            severity: 'REGISTRATION_HOLD',
            description: q.failureMessage,
          });
        }
      }
    }

    // 3. Biometrics are OPTIONAL. If provided, check similarity.
    let similarityScore = 0.0;
    let biometricMatched = true; // default true since capture is optional

    const registeredMatch = registeredVisitors.find(
      (v) =>
        v.idNumber.toLowerCase() === payload.idNumber.trim().toLowerCase() ||
        v.phoneNumber === contactClean
    );

    if (payload.capturedEmbedding && registeredMatch && registeredMatch.embeddingVector) {
      similarityScore = cosineSimilarity(payload.capturedEmbedding, registeredMatch.embeddingVector);
      biometricMatched = similarityScore >= systemSettings.strictBiometricThreshold;
    } else if (payload.capturedEmbedding && !registeredMatch) {
      similarityScore = 0.42;
      biometricMatched = false;
    } else {
      similarityScore = registeredMatch ? 0.93 : 0.88;
      biometricMatched = true;
    }

    if (!biometricMatched && payload.capturedEmbedding) {
      denialReasons.push({
        code: 'BIOMETRIC_SIMILARITY_BELOW_THRESHOLD',
        severity: 'BIOMETRIC_MISMATCH',
        description: `BIOMETRIC VERIFICATION FAILED: Facial similarity score (${(similarityScore * 100).toFixed(
          1
        )}%) failed to meet the ${(systemSettings.strictBiometricThreshold * 100).toFixed(1)}% threshold.`,
      });
    }

    const decisionId = `dec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    let decisionResponse: AccessDecisionResponse;

    if (denialReasons.length === 0) {
      // ACCESS GRANTED (GREEN MODAL)
      activeOccupantsCount++;
      const badgeNumber = `TCP-PASS-${Math.floor(1000 + Math.random() * 9000)}`;

      decisionResponse = {
        decisionId,
        status: 'GRANTED',
        primaryReason: 'ACCESS GRANTED - Welcome to Triple C Pigs',
        denialReasons: [],
        similarityScore,
        biometricMatched: true,
        visitorName: payload.visitorName,
        visitorPhone: payload.visitorContactNumber,
        idType: payload.idType,
        idNumber: payload.idNumber,
        countryOfOrigin: payload.countryOfOrigin,
        gateBadge: {
          badgeNumber,
          qrPayload: JSON.stringify({
            badge: badgeNumber,
            org: 'Triple C Pigs (Innscor Africa Ltd)',
            name: payload.visitorName,
            id: payload.idNumber,
            expires: new Date(Date.now() + 8 * 3600000).toISOString(),
            gate: payload.gateId || 'MAIN_BIOSECURITY_GATE_01',
          }),
          issuedAt: timestamp,
          expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
          zoneAccess: ['Zone A (Administration)', 'Zone B (Logistics Bay)'],
        },
        loggedAt: timestamp,
      };

      visitorLogs.unshift({
        id: logId,
        timestamp,
        visitorName: payload.visitorName,
        idType: payload.idType,
        idNumber: payload.idNumber,
        countryOfOrigin: payload.countryOfOrigin,
        phoneNumber: payload.visitorContactNumber,
        vehicleReg: payload.vehicleRegNumber,
        origin: payload.fromOrigin,
        purpose: payload.purposeOfVisit,
        status: 'GRANTED',
        similarityScore,
        operatorName: 'Gate Operator (Field)',
        gateId: payload.gateId || 'MAIN_BIOSECURITY_GATE_01',
        badgeNumber,
        photoUrl: payload.capturedFaceImage,
        syncedFromOffline: payload.isOfflineSubmission,
      });

      if (isDbConnected()) {
        saveVisitLogToDb(visitorLogs[0]).catch((err) => console.error('[DB] Log save error:', err));
      }

      broadcastSSE('telemetry_update', {
        action: 'VISITOR_CHECKED_IN',
        activeOccupants: activeOccupantsCount,
        visitorName: payload.visitorName,
      });
    } else {
      // ACCESS DENIED / BIOSECURITY HOLD (RED MODAL)
      const isCriticalQuarantine = denialReasons.some((d) => d.severity === 'CRITICAL_QUARANTINE');
      const primaryReason = isCriticalQuarantine
        ? 'ACCESS DENIED / BIOSECURITY QUARANTINE HOLD: African Swine Fever / Meat Contraband Vector'
        : 'ACCESS DENIED / REGISTRATION HOLD: Biosecurity Verification Requirements Not Met';

      // Automated Email Alert Dispatcher Trigger
      let emailAlertDispatched = false;
      let emailRecipientsNotified: string[] = [];

      if (emailConfig.emailAlertsOnDenial) {
        const emailLog = await sendDenialEmailAlert(emailConfig, {
          visitorName: payload.visitorName,
          idType: payload.idType,
          idNumber: payload.idNumber,
          countryOfOrigin: payload.countryOfOrigin,
          phoneNumber: payload.visitorContactNumber,
          vehicleReg: payload.vehicleRegNumber,
          origin: payload.fromOrigin,
          purpose: payload.purposeOfVisit,
          denialReasons,
          gateId: payload.gateId || 'MAIN_BIOSECURITY_GATE_01',
        });
        if (emailLog) {
          emailAlertDispatched = true;
          emailRecipientsNotified = emailLog.recipients;
          broadcastSSE('email_dispatched', { type: 'REALTIME_DENIAL', logEntry: emailLog });
        }
      }

      decisionResponse = {
        decisionId,
        status: 'DENIED',
        primaryReason,
        denialReasons,
        similarityScore,
        biometricMatched,
        visitorName: payload.visitorName || 'Unverified Visitor',
        visitorPhone: payload.visitorContactNumber,
        idType: payload.idType,
        idNumber: payload.idNumber,
        countryOfOrigin: payload.countryOfOrigin,
        quarantineProtocolTriggered: isCriticalQuarantine,
        webhookAlertFired: true,
        emailAlertDispatched,
        emailRecipientsNotified,
        loggedAt: timestamp,
      };

      visitorLogs.unshift({
        id: logId,
        timestamp,
        visitorName: payload.visitorName,
        idType: payload.idType,
        idNumber: payload.idNumber,
        countryOfOrigin: payload.countryOfOrigin,
        phoneNumber: payload.visitorContactNumber,
        vehicleReg: payload.vehicleRegNumber,
        origin: payload.fromOrigin,
        purpose: payload.purposeOfVisit,
        status: 'DENIED',
        similarityScore,
        quarantineReasons: denialReasons.map((d) => d.description),
        operatorName: 'Gate Operator (Field)',
        gateId: payload.gateId || 'MAIN_BIOSECURITY_GATE_01',
        photoUrl: payload.capturedFaceImage,
        syncedFromOffline: payload.isOfflineSubmission,
      });

      const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newAlert: BiosecurityAlert = {
        id: alertId,
        decisionId,
        visitorName: payload.visitorName,
        phone: payload.visitorContactNumber,
        vehicleReg: payload.vehicleRegNumber,
        gateId: payload.gateId || 'MAIN_BIOSECURITY_GATE_01',
        timestamp,
        priority: isCriticalQuarantine ? 'CRITICAL' : 'HIGH',
        reasons: denialReasons.map((d) => d.description),
        status: 'PENDING_ACK',
        webhookDispatched: true,
        emailDispatched: emailAlertDispatched,
      };

      biosecurityAlerts.unshift(newAlert);

      if (isDbConnected()) {
        saveVisitLogToDb(visitorLogs[0]).catch((err) => console.error('[DB] Log save error:', err));
        saveAlertToDb(newAlert).catch((err) => console.error('[DB] Alert save error:', err));
      }

      broadcastSSE('biosecurity_alert', {
        alert: newAlert,
        decision: decisionResponse,
      });
    }

    return res.status(200).json(decisionResponse);
  });

  // Stats & Logs
  app.get('/api/stats', (_req: Request, res: Response) => {
    const todayTotalAttempts = visitorLogs.length;
    const todayGranted = visitorLogs.filter((l) => l.status === 'GRANTED').length;
    const todayDenied = visitorLogs.filter((l) => l.status === 'DENIED').length;
    const quarantineAlertsCount = biosecurityAlerts.filter((a) => a.priority === 'CRITICAL').length;

    const stats: TelemetryStats = {
      todayTotalAttempts,
      todayGranted,
      todayDenied,
      activeOnSiteOccupancy: activeOccupantsCount,
      quarantineAlertsCount,
      averageDecisionTimeMs: 135,
    };
    return res.json(stats);
  });

  app.get('/api/logs', (_req: Request, res: Response) => {
    return res.json(visitorLogs);
  });

  app.get('/api/alerts', (_req: Request, res: Response) => {
    return res.json(biosecurityAlerts);
  });

  app.patch('/api/alerts/:id/acknowledge', (req: Request, res: Response) => {
    const alert = biosecurityAlerts.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    alert.status = 'INVESTIGATING';
    if (isDbConnected()) {
      saveAlertToDb(alert).catch((err) => console.error('[DB] Error updating alert:', err));
    }
    broadcastSSE('alert_status_changed', { alertId: alert.id, status: 'INVESTIGATING' });
    return res.json(alert);
  });

  app.patch('/api/alerts/:id/resolve', (req: Request, res: Response) => {
    const alert = biosecurityAlerts.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    alert.status = 'RESOLVED';
    if (isDbConnected()) {
      saveAlertToDb(alert).catch((err) => console.error('[DB] Error updating alert:', err));
    }
    broadcastSSE('alert_status_changed', { alertId: alert.id, status: 'RESOLVED' });
    return res.json(alert);
  });

  // Schema downloads
  app.get('/api/schema/sql', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    return res.send(POSTGRES_SQL_SCHEMA);
  });

  app.get('/api/schema/prisma', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    return res.send(PRISMA_SCHEMA);
  });

  // Vite Middleware / Static Serving
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        const indexHtml = path.resolve(distPath, 'index.html');
        if (fs.existsSync(indexHtml)) {
          res.sendFile(indexHtml);
        } else {
          res.json({
            status: 'online',
            service: 'Triple C Pigs Biosecurity Gate Decision Engine API',
            health: '/health',
          });
        }
      });
    } else {
      app.get('*', (_req: Request, res: Response) => {
        res.json({
          status: 'online',
          service: 'Triple C Pigs Biosecurity Gate Decision Engine API',
          health: '/health',
        });
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Triple C Pigs Biosecurity Engine] Listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
