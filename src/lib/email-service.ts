/**
 * Automated Email Alert & Notification Service
 * Dispatches real-time entry denial alerts and scheduled EOD PDF reports to configured stakeholders.
 */

import { EmailConfig, EmailDispatchLog, DenialReasonDetail, GateLogRecord, TelemetryStats } from '../types';
import { generateEodPdfReport } from './pdf-report-generator';

export const emailDispatchLogs: EmailDispatchLog[] = [
  {
    id: 'eml_seed_1',
    type: 'REALTIME_DENIAL',
    recipients: ['soc@triplecpigs.co.zw', 'biosecurity@triplecpigs.co.zw'],
    subject: '[BIOSECURITY ALERT] ENTRY DENIED: Kudakwashe Shumba - Triple C Pigs Gate 01',
    previewText: 'Triggered African Swine Fever Quarantine Rule: Cloven-Hoofed Animal Contact within 72h.',
    hasAttachment: false,
    sentAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: 'DELIVERED',
  },
];

/**
 * Triggers real-time email notification when an entry is denied
 */
export async function sendDenialEmailAlert(
  config: EmailConfig,
  details: {
    visitorName: string;
    idType: string;
    idNumber: string;
    countryOfOrigin: string;
    phoneNumber: string;
    vehicleReg?: string;
    origin: string;
    purpose: string;
    denialReasons: DenialReasonDetail[];
    gateId: string;
  }
): Promise<EmailDispatchLog | null> {
  if (!config.emailAlertsOnDenial || !config.recipients || config.recipients.length === 0) {
    return null;
  }

  const subject = `[BIOSECURITY ALERT] ENTRY DENIED: ${details.visitorName} - Triple C Pigs ${details.gateId}`;
  const reasonsList = details.denialReasons.map((r) => `• [${r.code}] ${r.description}`).join('\n');

  const previewText = `Entry denied for ${details.visitorName} (${details.idType}: ${details.idNumber}) from ${details.origin}. Reasons: ${details.denialReasons[0]?.description || 'Biosecurity check failed'}`;

  const logEntry: EmailDispatchLog = {
    id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'REALTIME_DENIAL',
    recipients: [...config.recipients],
    subject,
    previewText,
    hasAttachment: false,
    sentAt: new Date().toISOString(),
    status: 'DELIVERED',
  };

  emailDispatchLogs.unshift(logEntry);

  // In production with live SMTP:
  // const transporter = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort });
  // await transporter.sendMail({ from: config.senderEmail, to: config.recipients, subject, text, html });

  console.log(`[Email Dispatcher] Alert sent to [${config.recipients.join(', ')}] -> ${subject}`);
  return logEntry;
}

/**
 * Compiles and emails the End-of-Day (EOD) PDF report to stakeholders
 */
export async function sendEodReportEmail(
  config: EmailConfig,
  stats: TelemetryStats,
  logs: GateLogRecord[],
  logoBase64?: string | null
): Promise<EmailDispatchLog> {
  const reportDate = new Date().toLocaleDateString('en-GB');
  const subject = `[EOD REPORT] Triple C Pigs Daily Biosecurity & Gate Audit Summary (${reportDate})`;
  const previewText = `Daily summary compiled: ${stats.todayTotalAttempts} total attempts, ${stats.todayGranted} granted, ${stats.todayDenied} denied. PDF report attached.`;

  // Generate binary PDF with embedded corporate logo
  const pdfBytes = generateEodPdfReport(stats, logs, reportDate, logoBase64);

  const logEntry: EmailDispatchLog = {
    id: `eml_eod_${Date.now()}`,
    type: 'EOD_REPORT_PDF',
    recipients: [...config.recipients],
    subject,
    previewText,
    hasAttachment: true,
    sentAt: new Date().toISOString(),
    status: 'DELIVERED',
  };

  emailDispatchLogs.unshift(logEntry);
  config.lastEodReportGeneratedAt = new Date().toISOString();
  config.lastEodReportSentTo = [...config.recipients];

  console.log(`[Email Dispatcher] EOD PDF report (${pdfBytes.length} bytes) sent to [${config.recipients.join(', ')}]`);
  return logEntry;
}
