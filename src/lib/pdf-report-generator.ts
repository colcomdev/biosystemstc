/**
 * End-of-Day (EOD) Biosecurity Audit PDF Report Generator
 * Triple C Pigs t/a Colcom Foods (Innscor Africa Group)
 * Generates formatted PDF reports with daily telemetry, denial breakdowns, and gate audit logs.
 */

import { jsPDF } from 'jspdf';
import { GateLogRecord, TelemetryStats } from '../types';

export function generateEodPdfReport(
  stats: TelemetryStats,
  logs: GateLogRecord[],
  reportDate = new Date().toLocaleDateString('en-GB')
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 18;

  // Header Banner Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Title & Branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('TRIPLE C PIGS t/a COLCOM FOODS', 14, currentY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text('INNSCOR AFRICA GROUP • BIOSECURITY & GATE ACCESS DAILY REPORT', 14, currentY + 6);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${new Date().toLocaleString()} | Gate: MAIN_BIOSECURITY_GATE_01`, 14, currentY + 11);

  currentY = 40;

  // Executive Summary Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`DAILY BIOSECURITY SUMMARY (${reportDate})`, 14, currentY);

  currentY += 5;

  // KPI Metrics Grid Cards
  const kpiWidth = (pageWidth - 28 - 9) / 4;
  const kpiHeight = 18;

  // 1. Total Attempts
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, currentY, kpiWidth, kpiHeight, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ATTEMPTS', 18, currentY + 5);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(stats.todayTotalAttempts), 18, currentY + 14);

  // 2. Access Granted
  const kpi2X = 14 + kpiWidth + 3;
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(kpi2X, currentY, kpiWidth, kpiHeight, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('PASSED / GRANTED', kpi2X + 4, currentY + 5);
  doc.setFontSize(14);
  doc.setTextColor(4, 120, 87);
  doc.text(String(stats.todayGranted), kpi2X + 4, currentY + 14);

  // 3. Entries Denied
  const kpi3X = kpi2X + kpiWidth + 3;
  doc.setFillColor(255, 241, 242);
  doc.roundedRect(kpi3X, currentY, kpiWidth, kpiHeight, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(225, 29, 72);
  doc.text('DENIED / REFUSED', kpi3X + 4, currentY + 5);
  doc.setFontSize(14);
  doc.setTextColor(190, 18, 60);
  doc.text(String(stats.todayDenied), kpi3X + 4, currentY + 14);

  // 4. Critical Flags
  const kpi4X = kpi3X + kpiWidth + 3;
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(kpi4X, currentY, kpiWidth, kpiHeight, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text('ASF QUARANTINE', kpi4X + 4, currentY + 5);
  doc.setFontSize(14);
  doc.setTextColor(180, 83, 9);
  doc.text(String(stats.quarantineAlertsCount), kpi4X + 4, currentY + 14);

  currentY += kpiHeight + 10;

  // Section 2: Denied Entries Breakdown (Crucial for Veterinary Audits)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(190, 18, 60);
  doc.text('CRITICAL QUARANTINE & REFUSAL INCIDENTS', 14, currentY);

  currentY += 4;
  const deniedLogs = logs.filter((l) => l.status === 'DENIED');

  if (deniedLogs.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Zero biosecurity breaches or denied entries recorded for this reporting period.', 14, currentY + 4);
    currentY += 10;
  } else {
    deniedLogs.forEach((log) => {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(255, 241, 242);
      doc.roundedRect(14, currentY, pageWidth - 28, 14, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(159, 18, 57);
      doc.text(`${log.visitorName} (${log.idType}: ${log.idNumber}) - From: ${log.origin}`, 17, currentY + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      const reasonsStr = (log.quarantineReasons || ['Biosecurity verification failed']).join('; ');
      const truncatedReason = reasonsStr.length > 115 ? reasonsStr.substring(0, 112) + '...' : reasonsStr;
      doc.text(`Trigger: ${truncatedReason}`, 17, currentY + 8.5);
      doc.text(`Logged at: ${new Date(log.timestamp).toLocaleTimeString()} | Phone: +${log.phoneNumber} | Vehicle: ${log.vehicleReg || 'None'}`, 17, currentY + 11.5);

      currentY += 16;
    });
  }

  currentY += 4;

  // Section 3: Gate Access Log Registry Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('COMPLETE GATE TRAFFIC AUDIT LOG', 14, currentY);

  currentY += 5;

  // Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(14, currentY, pageWidth - 28, 7, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('TIME', 17, currentY + 4.5);
  doc.text('VISITOR / COMPANY', 32, currentY + 4.5);
  doc.text('CREDENTIALS', 78, currentY + 4.5);
  doc.text('COUNTRY', 115, currentY + 4.5);
  doc.text('STATUS', 142, currentY + 4.5);
  doc.text('BADGE / REMARKS', 165, currentY + 4.5);

  currentY += 7;

  logs.forEach((log) => {
    if (currentY > 265) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    doc.text(timeStr, 17, currentY + 4);

    const nameStr = log.visitorName.length > 22 ? log.visitorName.substring(0, 20) + '..' : log.visitorName;
    doc.text(nameStr, 32, currentY + 4);

    doc.text(`${log.idType === 'PASSPORT' ? 'PPT' : 'ID'}: ${log.idNumber}`, 78, currentY + 4);
    doc.text(log.countryOfOrigin || 'Zimbabwe', 115, currentY + 4);

    if (log.status === 'GRANTED') {
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('GRANTED', 142, currentY + 4);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(log.badgeNumber || 'PASS', 165, currentY + 4);
    } else {
      doc.setTextColor(225, 29, 72);
      doc.setFont('helvetica', 'bold');
      doc.text('DENIED', 142, currentY + 4);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('QUARANTINE', 165, currentY + 4);
    }

    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, currentY + 5.5, pageWidth - 14, currentY + 5.5);

    currentY += 6;
  });

  // Footer & Legal Sign-off
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('CONFIDENTIAL • TRIPLE C PIGS BIOSECURITY COMPLIANCE AUDIT • INNSCOR AFRICA GROUP', 14, pageHeight - 8);
  doc.text(`Page 1 of 1`, pageWidth - 28, pageHeight - 8);

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}
