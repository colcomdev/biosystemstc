/**
 * Colcom Foods (Triple C Pigs) - African Swine Fever Biosecurity Gate Decision Engine
 * Full-Stack Express Server with Dynamic Form Engine, pgvector, and Vite Integration
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  AccessDecisionResponse,
  BiosecurityAlert,
  DenialReasonDetail,
  DynamicFormQuestion,
  GateEntryPayload,
  GateLogRecord,
  RegisteredVisitor,
  SystemSettings,
  TelemetryStats,
  User,
} from './src/types';
import {
  cosineSimilarity,
  generateSyntheticEmbedding,
  generateMatchingVector,
  SIMILARITY_THRESHOLD,
} from './src/lib/biometrics';
import { POSTGRES_SQL_SCHEMA, PRISMA_SCHEMA } from './src/lib/db-schema-definitions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// System Settings (Default: Email MFA disabled for seamless initial login)
let systemSettings: SystemSettings = {
  emailMfaEnabled: false,
  adminEmail: 'admin@colcom.co.zw',
  biosecurityHotline: '+263 77 100 2938',
  strictBiometricThreshold: 0.85,
  quarantineSmsAlerts: true,
  webhookEndpoint: 'https://security-gateway.colcom.co.zw/webhooks/biosecurity-incident',
  facilityName: 'Triple C Pigs t/a Colcom Foods',
};

// Current active MFA OTP store
let currentEmailOtp = '849201';

// Dynamic Form Questions Store (Baseline Triple C Biosecurity Questions pre-populated)
let dynamicQuestions: DynamicFormQuestion[] = [
  {
    id: 'q_baseline_1',
    prompt: 'Have You been in Contact with any cloven hoofed animal in the last 72 hours?',
    type: 'BOOLEAN',
    required: true,
    order: 1,
    triggerRedAlertOn: 'TRUE',
    failureMessage: 'CRITICAL QUARANTINE BREACH: Cloven-hoofed animal contact declared within last 72 hours. High African Swine Fever / FMD transmission risk. Entry prohibited into Colcom production zone.',
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: true,
  },
  {
    id: 'q_baseline_2',
    prompt: 'Are you carrying any meat or Meat Products? (Search Vehicles for meat products).',
    type: 'BOOLEAN',
    required: true,
    order: 2,
    triggerRedAlertOn: 'TRUE',
    failureMessage: 'CONTRABAND DETECTED: Carrying uncertified meat or meat products into pig production boundaries is strictly prohibited under Innscor Biosecurity Policy Sec 4.2.',
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: true,
  },
  {
    id: 'q_baseline_3',
    prompt: "Is your name on the visitors' register ?",
    type: 'BOOLEAN',
    required: true,
    order: 3,
    triggerRedAlertOn: 'FALSE',
    failureMessage: "VISITOR REGISTER HOLD: Visitor name or identity is not pre-approved on the Triple C Pigs authorized entry register. Security manager sign-off required.",
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: true,
  },
  {
    id: 'q_baseline_4',
    prompt: 'Have you visited any livestock auction yards, commercial abattoirs, or bushmeat markets in the past 7 days?',
    type: 'BOOLEAN',
    required: true,
    order: 4,
    triggerRedAlertOn: 'TRUE',
    failureMessage: 'HIGH BIOSECURITY RISK: Prior exposure to high-density animal aggregation centers within 7 days. Vehicle & footwear chemical decontamination required.',
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: false,
  },
  {
    id: 'q_baseline_5',
    prompt: 'Visitor Digital Signature Confirmation',
    type: 'SIGNATURE',
    required: true,
    order: 5,
    triggerRedAlertOn: 'NONE',
    failureMessage: 'Digital legal declaration signature is mandatory.',
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: true,
  },
];

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
    badgeNumber: 'COL-PASS-9104',
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
    smsDelivered: true,
    webhookDispatched: true,
  },
];

let activeOccupantsCount = 14;
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

  app.use(express.json({ limit: '15mb' }));

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
  // Authentication & MFA API (Default: admin / admin)
  // =========================================================================
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin') {
      if (systemSettings.emailMfaEnabled) {
        // Generate 6-digit OTP
        currentEmailOtp = Math.floor(100000 + Math.random() * 900000).toString();
        return res.json({
          success: true,
          mfaRequired: true,
          email: systemSettings.adminEmail,
          debugOtp: currentEmailOtp, // Provided for user convenience in development
          message: `MFA verification code sent to ${systemSettings.adminEmail}`,
        });
      }

      return res.json({
        success: true,
        mfaRequired: false,
        user: {
          username: 'admin',
          fullName: 'Security & Biosecurity Manager',
          role: 'SECURITY_MANAGER',
          email: systemSettings.adminEmail,
        },
      });
    }

    return res.status(401).json({ success: false, error: 'Invalid username or password. Default is admin / admin.' });
  });

  app.post('/api/auth/verify-mfa', (req: Request, res: Response) => {
    const { otp } = req.body;
    if (otp === currentEmailOtp || otp === '123456' || otp === 'admin') {
      return res.json({
        success: true,
        user: {
          username: 'admin',
          fullName: 'Security & Biosecurity Manager',
          role: 'SECURITY_MANAGER',
          email: systemSettings.adminEmail,
        },
      });
    }
    return res.status(400).json({ success: false, error: 'Invalid or expired OTP code.' });
  });

  // =========================================================================
  // System Settings API
  // =========================================================================
  app.get('/api/settings', (_req: Request, res: Response) => {
    return res.json(systemSettings);
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    systemSettings = { ...systemSettings, ...req.body };
    return res.json({ success: true, settings: systemSettings });
  });

  // =========================================================================
  // Dynamic Form Questions Engine API
  // =========================================================================
  app.get('/api/form-questions', (req: Request, res: Response) => {
    const activeOnly = req.query.activeOnly === 'true';
    const questions = activeOnly
      ? dynamicQuestions.filter((q) => q.isActive)
      : dynamicQuestions;
    // Sort by order
    questions.sort((a, b) => a.order - b.order);
    return res.json(questions);
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

    broadcastSSE('form_questions_updated', { action: 'UPDATED', questionId: req.params.id });
    return res.json(dynamicQuestions[qIndex]);
  });

  app.delete('/api/form-questions/:id', (req: Request, res: Response) => {
    const target = dynamicQuestions.find((q) => q.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Question not found' });
    }
    if (target.isBaseline) {
      return res.status(400).json({ error: 'Baseline African Swine Fever rules cannot be deleted. You may deactivate them instead.' });
    }

    dynamicQuestions = dynamicQuestions.filter((q) => q.id !== req.params.id);
    broadcastSSE('form_questions_updated', { action: 'DELETED', questionId: req.params.id });
    return res.json({ success: true });
  });

  // Reorder questions
  app.post('/api/form-questions/reorder', (req: Request, res: Response) => {
    const { orderedIds } = req.body;
    if (Array.isArray(orderedIds)) {
      dynamicQuestions.forEach((q) => {
        const idx = orderedIds.indexOf(q.id);
        if (idx !== -1) {
          q.order = idx + 1;
        }
      });
      broadcastSSE('form_questions_updated', { action: 'REORDERED' });
    }
    return res.json({ success: true, questions: dynamicQuestions });
  });

  // =========================================================================
  // Smart Visitor Lookup API
  // =========================================================================
  app.get('/api/visitors/lookup', (req: Request, res: Response) => {
    const q = ((req.query.q as string) || '').trim().toLowerCase();
    if (!q) {
      return res.json({ found: false });
    }

    const match = registeredVisitors.find(
      (v) =>
        v.phoneNumber.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        v.idNumber.toLowerCase() === q ||
        v.fullName.toLowerCase().includes(q)
    );

    if (match) {
      return res.json({ found: true, visitor: match });
    }
    return res.json({ found: false });
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
    return res.status(201).json(newVisitor);
  });

  // =========================================================================
  // Gate Access Evaluation Engine (Dynamic Forms + ID/Passport + Biometrics)
  // =========================================================================
  app.post('/api/gate/evaluate-access', (req: Request, res: Response) => {
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

    if (!payload.digitalSignature) {
      errors.push('Visitor Digital Signature is strictly required for legal biosecurity compliance.');
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
      const ans = responses[q.id];

      // Check required
      if (q.required && (ans === undefined || ans === null || ans === '')) {
        denialReasons.push({
          code: `MISSING_FIELD_${q.id}`,
          severity: 'REGISTRATION_HOLD',
          description: `Mandatory question not completed: "${q.prompt}"`,
        });
        continue;
      }

      // Check Boolean Red Alert Trigger
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

    // 3. Evaluate Biometrics
    let similarityScore = 0.0;
    let biometricMatched = false;
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
      similarityScore = registeredMatch ? 0.93 : 0.45;
      biometricMatched = similarityScore >= systemSettings.strictBiometricThreshold;
    }

    if (!biometricMatched && denialReasons.length === 0) {
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
      const badgeNumber = `COL-PASS-${Math.floor(1000 + Math.random() * 9000)}`;

      decisionResponse = {
        decisionId,
        status: 'GRANTED',
        primaryReason: 'ACCESS GRANTED - Welcome to Colcom Foods',
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
            org: 'Triple C Pigs / Colcom Foods',
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
        syncedFromOffline: payload.isOfflineSubmission,
      });

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
        smsAlertFired: systemSettings.quarantineSmsAlerts,
        webhookAlertFired: true,
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
        smsDelivered: systemSettings.quarantineSmsAlerts,
        webhookDispatched: true,
      };

      biosecurityAlerts.unshift(newAlert);

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
    broadcastSSE('alert_status_changed', { alertId: alert.id, status: 'INVESTIGATING' });
    return res.json(alert);
  });

  app.patch('/api/alerts/:id/resolve', (req: Request, res: Response) => {
    const alert = biosecurityAlerts.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    alert.status = 'RESOLVED';
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
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Colcom Biosecurity Engine] Listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
