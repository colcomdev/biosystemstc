/**
 * Colcom Foods - Triple C Pigs Biometric Visitor Management System
 * Shared Types & Domain Models (Dynamic Forms, ID/Passport, Email Alerts, PDF Reports)
 */

export type Role = 'GATE_OPERATOR' | 'BIOSECURITY_OFFICER' | 'SECURITY_MANAGER' | 'AUDITOR';

export type AccessStatus = 'GRANTED' | 'DENIED';

export type DenialSeverity = 'CRITICAL_QUARANTINE' | 'REGISTRATION_HOLD' | 'BIOMETRIC_MISMATCH' | 'IDENTITY_ERROR';

export type IdentificationType = 'NATIONAL_ID' | 'PASSPORT';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  mfaEnabled: boolean;
  gateAssigned: string;
}

export interface RegisteredVisitor {
  id: string;
  fullName: string;
  idType: IdentificationType;
  idNumber: string;
  countryOfOrigin: string;
  phoneNumber: string;
  company: string;
  category: 'CONTRACTOR' | 'SUPPLIER' | 'OFFICIAL_AUDITOR' | 'CUSTOMER' | 'VET_INSPECTOR';
  isPreApproved: boolean;
  photoUrl: string;
  embeddingVector?: number[]; // 512-dimensional vector (Optional)
  registeredAt: string;
  lastVisitAt?: string;
}

export type QuestionType = 'BOOLEAN' | 'TEXT' | 'SELECT' | 'SIGNATURE';

export type RedAlertTrigger = 'TRUE' | 'FALSE' | 'NONE';

export interface DynamicFormQuestion {
  id: string;
  prompt: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  order: number;
  triggerRedAlertOn: RedAlertTrigger;
  failureMessage: string;
  category: 'BIOSECURITY' | 'IDENTITY' | 'SAFETY' | 'GENERAL';
  isActive: boolean;
  isBaseline?: boolean; // Protect baseline questions from accidental deletion
}

export interface GateEntryPayload {
  visitorName: string;
  idType: IdentificationType;
  idNumber: string;
  countryOfOrigin: string;
  visitorContactNumber: string; // Numbers only, min length 10
  vehicleRegNumber?: string;    // Optional, min length 3
  purposeOfVisit: string;       // Textarea, max length 3500
  fromOrigin: string;           // Required, min length 3
  dynamicResponses: Record<string, boolean | string>;
  digitalSignature: string;      // Base64 PNG data URL or signature string
  capturedFaceImage?: string;   // Optional photo
  capturedEmbedding?: number[]; // Optional 512-dimensional vector
  gateId: string;
  operatorId: string;
  timestamp?: string;
  isOfflineSubmission?: boolean;
}

export interface DenialReasonDetail {
  code: string;
  severity: DenialSeverity;
  description: string;
}

export interface AccessDecisionResponse {
  decisionId: string;
  status: AccessStatus;
  primaryReason: string;
  denialReasons: DenialReasonDetail[];
  similarityScore: number;
  biometricMatched: boolean;
  visitorName: string;
  visitorPhone: string;
  idType: IdentificationType;
  idNumber: string;
  countryOfOrigin: string;
  gateBadge?: {
    badgeNumber: string;
    qrPayload: string;
    issuedAt: string;
    expiresAt: string;
    zoneAccess: string[];
  };
  quarantineProtocolTriggered?: boolean;
  smsAlertFired?: boolean;
  webhookAlertFired?: boolean;
  emailAlertDispatched?: boolean;
  emailRecipientsNotified?: string[];
  loggedAt: string;
}

export interface BiosecurityAlert {
  id: string;
  decisionId: string;
  visitorName: string;
  phone: string;
  vehicleReg?: string;
  gateId: string;
  timestamp: string;
  priority: 'HIGH' | 'CRITICAL';
  reasons: string[];
  status: 'PENDING_ACK' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED';
  smsDelivered: boolean;
  webhookDispatched: boolean;
  emailDispatched: boolean;
}

export interface GateLogRecord {
  id: string;
  timestamp: string;
  visitorName: string;
  idType: IdentificationType;
  idNumber: string;
  countryOfOrigin: string;
  phoneNumber: string;
  vehicleReg?: string;
  origin: string;
  purpose: string;
  status: AccessStatus;
  similarityScore: number;
  quarantineReasons?: string[];
  operatorName: string;
  gateId: string;
  badgeNumber?: string;
  photoUrl?: string;
  syncedFromOffline?: boolean;
}

export interface TelemetryStats {
  todayTotalAttempts: number;
  todayGranted: number;
  todayDenied: number;
  activeOnSiteOccupancy: number;
  quarantineAlertsCount: number;
  averageDecisionTimeMs: number;
}

export interface SystemSettings {
  emailMfaEnabled: boolean;
  adminEmail: string;
  biosecurityHotline: string;
  strictBiometricThreshold: number;
  quarantineSmsAlerts: boolean;
  webhookEndpoint: string;
  facilityName: string;
}

export interface EmailConfig {
  id: string;
  recipients: string[];
  emailAlertsOnDenial: boolean;
  eodReportEnabled: boolean;
  eodReportScheduleTime: string; // e.g. "18:00"
  senderEmail: string;
  smtpHost: string;
  smtpPort: number;
  lastEodReportGeneratedAt?: string;
  lastEodReportSentTo?: string[];
}

export interface EmailDispatchLog {
  id: string;
  type: 'REALTIME_DENIAL' | 'EOD_REPORT_PDF' | 'MFA_OTP';
  recipients: string[];
  subject: string;
  previewText: string;
  hasAttachment: boolean;
  sentAt: string;
  status: 'DELIVERED' | 'SIMULATED';
}
