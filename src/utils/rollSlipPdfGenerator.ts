import { jsPDF } from 'jspdf';
import { Student } from '../types';
import { Exam } from './examStore';
import { SchoolSettings, getSchoolSettings } from './settingsHelper';
import { getStudentAvatar } from './studentAvatarHelper';

export interface RollSlipDateSheetItem {
  examName: string;
  subjectName: string;
  date: string;
  time: string;
  totalMarks: number;
  passingMarks: number;
  room: string;
}

export interface RollSlipData {
  student: Student;
  rollNo: string;
  exams: Exam[];
  dateSheet: RollSlipDateSheetItem[];
  folderName: string;
}

/**
 * Helper to load an image URL (data URI or local asset PNG) as base64 PNG data URL for jsPDF
 */
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/png') || url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) {
    return url;
  }
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 160;
        canvas.height = img.naturalHeight || 200;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Generates an individual single-slip PDF matching the active template
 */
export async function generateSingleRollNumberSlipPDF(
  slipData: RollSlipData,
  schoolSettings?: SchoolSettings
): Promise<void> {
  await generateBulkA4RollNumberSlipsPDF([slipData], schoolSettings);
}

/**
 * Generates the complete PDF of roll number slips in a vertical stream
 * matching the exact active template selected in Settings -> Templates.
 */
export async function generateBulkA4RollNumberSlipsPDF(
  slipsData: RollSlipData[],
  schoolSettings?: SchoolSettings
): Promise<void> {
  if (slipsData.length === 0) return;

  const school = schoolSettings || getSchoolSettings();
  const activeTemplate = school.rollNumberSlipTemplate || 'minimal-stream';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4' // 210mm x 297mm
  });

  // Preload avatar images for all students so they render identically to the preview
  const avatarCache = new Map<string, string | null>();
  await Promise.all(
    slipsData.map(async slip => {
      const avatarUrl = getStudentAvatar(slip.student);
      if (!avatarCache.has(avatarUrl)) {
        const dataUrl = await loadImageAsDataUrl(avatarUrl);
        avatarCache.set(avatarUrl, dataUrl);
      }
    })
  );

  const totalSlips = slipsData.length;
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const cardWidth = pageWidth - marginX * 2; // 182mm
  let currentY = 12;

  for (let i = 0; i < totalSlips; i++) {
    const slip = slipsData[i];
    const rowCount = Math.max(1, slip.dateSheet.length);
    const tableHeight = 7 + rowCount * 6.5;
    const cardHeight =
      activeTemplate === 'classic-bordered'
        ? 18 + 28 + 10 + tableHeight + 14 + 16
        : 14 + 28 + 10 + tableHeight + 16; // Dynamic height matching content

    // If this slip would overflow the bottom of the A4 page, add a new page
    if (i > 0 && currentY + cardHeight > pageHeight - 12) {
      doc.addPage('a4', 'portrait');
      currentY = 12;
    }

    const avatarUrl = getStudentAvatar(slip.student);
    const avatarDataUrl = avatarCache.get(avatarUrl) || null;

    if (activeTemplate === 'classic-bordered') {
      renderClassicBorderedSlipPDF(
        doc,
        slip,
        school,
        marginX,
        currentY,
        cardWidth,
        cardHeight,
        i + 1,
        totalSlips,
        avatarDataUrl
      );
    } else {
      renderMinimalStreamSlipPDF(
        doc,
        slip,
        school,
        marginX,
        currentY,
        cardWidth,
        cardHeight,
        i + 1,
        totalSlips,
        avatarDataUrl
      );
    }

    currentY += cardHeight + 10; // 10mm vertical gap between slips in the stream
  }

  const examClean = (slipsData[0]?.folderName || 'Roll_Number_Slips').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${examClean}_(${totalSlips}_Slips).pdf`);
}

/**
 * Renders a single Roll Number Slip card on the PDF matching MinimalStreamSlipCard in the UI preview
 */
function renderMinimalStreamSlipPDF(
  doc: jsPDF,
  slip: RollSlipData,
  school: SchoolSettings,
  x: number,
  y: number,
  w: number,
  h: number,
  index: number,
  total: number,
  avatarDataUrl: string | null
): void {
  const pad = 5;
  const innerX = x + pad;
  const innerW = w - pad * 2;

  // Outer Card Border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(x, y, w, h);

  let curY = y + 6;

  // 1. Top Metadata Row: SLIP #X OF Y (left) | SESSION (right)
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`SLIP #${index} OF ${total}`, innerX, curY);
  doc.text(`SESSION: ${school.session || '2025 - 2026'}`, innerX + innerW, curY, { align: 'right' });

  // School Name (Centered, bold uppercase)
  curY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const schoolName = (school.schoolName || 'DEMO SCHOOL SYSTEM').toUpperCase();
  doc.text(schoolName, x + w / 2, curY, { align: 'center' });

  // Black Badge: [EXAM TITLE] — ROLL NUMBER SLIP
  curY += 2.5;
  const examTitleText = `${(slip.folderName || 'EXAMINATION').toUpperCase()} — ROLL NUMBER SLIP`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const badgeTextW = doc.getTextWidth(examTitleText);
  const badgeW = Math.min(innerW, badgeTextW + 10);
  const badgeH = 5.2;
  const badgeX = x + (w - badgeW) / 2;

  doc.setFillColor(0, 0, 0);
  doc.rect(badgeX, curY, badgeW, badgeH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(examTitleText, x + w / 2, curY + 3.7, { align: 'center' });

  // Header bottom border line
  curY += badgeH + 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(innerX, curY, innerX + innerW, curY);

  // 2. Student Info (2x2 Grid on Left) + Photo Frame on Right
  const sectionTopY = curY + 3;
  const photoW = 20;
  const photoH = 24;
  const photoX = innerX + innerW - photoW;
  const photoY = sectionTopY;

  // Draw Photo Box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(photoX, photoY, photoW, photoH);

  if (avatarDataUrl) {
    try {
      doc.addImage(avatarDataUrl, 'PNG', photoX + 0.4, photoY + 0.4, photoW - 0.8, photoH - 0.8);
    } catch {
      // Fallback initial if image fails
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(slip.student.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 2, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(slip.student.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 2, { align: 'center' });
  }

  // 2x2 Grid Columns on Left
  const gridW = innerW - photoW - 6;
  const col1X = innerX;
  const col2X = innerX + gridW / 2;

  // Row 1: STUDENT NAME | FATHER / GUARDIAN
  let rowY = sectionTopY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('STUDENT NAME', col1X, rowY);
  doc.text('FATHER / GUARDIAN', col2X, rowY);

  rowY += 4.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  const studentNameStr = (slip.student.name || '-').toUpperCase();
  const fatherNameStr = (slip.student.fatherName || slip.student.family || '-').toUpperCase();
  doc.text(doc.splitTextToSize(studentNameStr, gridW / 2 - 3)[0] || studentNameStr, col1X, rowY);
  doc.text(doc.splitTextToSize(fatherNameStr, gridW / 2 - 3)[0] || fatherNameStr, col2X, rowY);

  // Row 2: CLASS & SECTION | ROLL NUMBER
  rowY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('CLASS & SECTION', col1X, rowY);
  doc.text('ROLL NUMBER', col2X, rowY);

  rowY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`${slip.student.class} (${slip.student.section || 'A'})`, col1X, rowY);

  // Roll Number Black Pill
  const rollStr = String(slip.rollNo);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  const rollW = Math.max(12, doc.getTextWidth(rollStr) + 6);
  doc.setFillColor(0, 0, 0);
  doc.rect(col2X, rowY - 3.8, rollW, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(rollStr, col2X + rollW / 2, rowY - 0.2, { align: 'center' });

  // Student section bottom border line
  curY = sectionTopY + photoH + 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(innerX, curY, innerX + innerW, curY);

  // 3. Minimal 5-Column Schedule Table (# | SUBJECT | DATE | TIME | MARKS)
  curY += 4;
  const rowCount = Math.max(1, slip.dateSheet.length);
  const headerH = 7;
  const rowH = 6.5;
  const tableH = headerH + rowCount * rowH;

  // Column widths summing to innerW (172mm)
  const c0W = 12; // #
  const c4W = 22; // MARKS
  const c3W = 42; // TIME
  const c2W = 34; // DATE
  const c1W = innerW - (c0W + c2W + c3W + c4W); // SUBJECT

  const col0 = innerX;
  const col1 = col0 + c0W;
  const col2 = col1 + c1W;
  const col3 = col2 + c2W;
  const col4 = col3 + c3W;

  // Header background
  doc.setFillColor(241, 245, 249);
  doc.rect(innerX, curY, innerW, headerH, 'F');

  // Table outer border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(innerX, curY, innerW, tableH);

  // Header bottom line
  doc.line(innerX, curY + headerH, innerX + innerW, curY + headerH);

  // Column vertical lines
  doc.line(col1, curY, col1, curY + tableH);
  doc.line(col2, curY, col2, curY + tableH);
  doc.line(col3, curY, col3, curY + tableH);
  doc.line(col4, curY, col4, curY + tableH);

  // Header text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const hTextY = curY + 4.7;
  doc.text('#', col0 + c0W / 2, hTextY, { align: 'center' });
  doc.text('SUBJECT', col1 + 3, hTextY);
  doc.text('DATE', col2 + c2W / 2, hTextY, { align: 'center' });
  doc.text('TIME', col3 + c3W / 2, hTextY, { align: 'center' });
  doc.text('MARKS', col4 + c4W / 2, hTextY, { align: 'center' });

  // Table rows
  slip.dateSheet.forEach((item, idx) => {
    const rTop = curY + headerH + idx * rowH;
    const rTextY = rTop + 4.4;

    if (idx > 0) {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.15);
      doc.line(innerX, rTop, innerX + innerW, rTop);
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(String(idx + 1), col0 + c0W / 2, rTextY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const subj = (item.subjectName || '').toUpperCase();
    doc.text(doc.splitTextToSize(subj, c1W - 5)[0] || subj, col1 + 3, rTextY);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(item.date || '-', col2 + c2W / 2, rTextY, { align: 'center' });
    doc.text(item.time || '-', col3 + c3W / 2, rTextY, { align: 'center' });
    doc.text(String(item.totalMarks ?? 100), col4 + c4W / 2, rTextY, { align: 'center' });
  });

  // 4. Minimal Footer Signatures
  const footerLineY = curY + tableH + 9;
  const signLineW = 42;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  // Left signature line
  doc.line(innerX, footerLineY, innerX + signLineW, footerLineY);
  // Right signature line
  doc.line(innerX + innerW - signLineW, footerLineY, innerX + innerW, footerLineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('CANDIDATE SIGN', innerX + signLineW / 2, footerLineY + 4, { align: 'center' });
  doc.text('CONTROLLER OF EXAMS', innerX + innerW - signLineW / 2, footerLineY + 4, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`ID: ${slip.student.id}`, x + w / 2, footerLineY + 3.5, { align: 'center' });
}

/**
 * Renders the Classic Bordered Roll Number Slip card on the PDF
 */
function renderClassicBorderedSlipPDF(
  doc: jsPDF,
  slip: RollSlipData,
  school: SchoolSettings,
  x: number,
  y: number,
  w: number,
  h: number,
  index: number,
  total: number,
  avatarDataUrl: string | null
): void {
  const pad = 5;
  const innerX = x + pad;
  const innerW = w - pad * 2;

  // Double Outer Card Border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, h);
  doc.setLineWidth(0.2);
  doc.rect(x + 1.2, y + 1.2, w - 2.4, h - 2.4);

  let curY = y + 6.5;

  // Top Metadata Row
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text(`ADMIT CARD #${index} OF ${total}`, innerX, curY);
  doc.text(`SESSION: ${school.session || '2025 - 2026'}`, innerX + innerW, curY, { align: 'right' });

  // School Name & Campus
  curY += 5.5;
  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(0, 0, 0);
  const schoolName = (school.schoolName || 'DEMO SCHOOL SYSTEM').toUpperCase();
  doc.text(schoolName, x + w / 2, curY, { align: 'center' });

  curY += 3.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`${school.campusName || 'Main Campus'} • ${school.schoolAddress || 'Official Examination Center'}`, x + w / 2, curY, { align: 'center' });

  // Exam Title Banner
  curY += 2.2;
  const examTitleText = `ROLL NUMBER SLIP — ${(slip.folderName || 'EXAMINATION').toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const badgeTextW = doc.getTextWidth(examTitleText);
  const badgeW = Math.min(innerW, badgeTextW + 12);
  const badgeH = 5.2;
  const badgeX = x + (w - badgeW) / 2;

  doc.setFillColor(15, 23, 42);
  doc.rect(badgeX, curY, badgeW, badgeH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(examTitleText, x + w / 2, curY + 3.7, { align: 'center' });

  curY += badgeH + 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(innerX, curY, innerX + innerW, curY);

  // Student Info + Photo Box
  const sectionTopY = curY + 3;
  const photoW = 20;
  const photoH = 24;
  const photoX = innerX + innerW - photoW;
  const photoY = sectionTopY;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(photoX, photoY, photoW, photoH);

  if (avatarDataUrl) {
    try {
      doc.addImage(avatarDataUrl, 'PNG', photoX + 0.4, photoY + 0.4, photoW - 0.8, photoH - 0.8);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(slip.student.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 2, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(slip.student.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 2, { align: 'center' });
  }

  const gridW = innerW - photoW - 6;
  const col1X = innerX;
  const col2X = innerX + gridW / 2;

  let rowY = sectionTopY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('CANDIDATE NAME', col1X, rowY);
  doc.text('FATHER / GUARDIAN', col2X, rowY);

  rowY += 4.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  const studentNameStr = (slip.student.name || '-').toUpperCase();
  const fatherNameStr = (slip.student.fatherName || slip.student.family || '-').toUpperCase();
  doc.text(doc.splitTextToSize(studentNameStr, gridW / 2 - 3)[0] || studentNameStr, col1X, rowY);
  doc.text(doc.splitTextToSize(fatherNameStr, gridW / 2 - 3)[0] || fatherNameStr, col2X, rowY);

  rowY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('CLASS & SECTION', col1X, rowY);
  doc.text('ROLL NUMBER & ID', col2X, rowY);

  rowY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`${slip.student.class} (${slip.student.section || 'A'})`, col1X, rowY);
  doc.text(`${slip.rollNo}  •  ${slip.student.id}`, col2X, rowY);

  curY = sectionTopY + photoH + 3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(innerX, curY, innerX + innerW, curY);

  // 6-Column Schedule Table (# | SUBJECT | DATE | TIME | ROOM | MARKS)
  curY += 3.5;
  const rowCount = Math.max(1, slip.dateSheet.length);
  const headerH = 7;
  const rowH = 6.5;
  const tableH = headerH + rowCount * rowH;

  const c0W = 10; // #
  const c5W = 18; // MARKS
  const c4W = 22; // ROOM
  const c3W = 38; // TIME
  const c2W = 30; // DATE
  const c1W = innerW - (c0W + c2W + c3W + c4W + c5W); // SUBJECT

  const col0 = innerX;
  const col1 = col0 + c0W;
  const col2 = col1 + c1W;
  const col3 = col2 + c2W;
  const col4 = col3 + c3W;
  const col5 = col4 + c4W;

  doc.setFillColor(226, 232, 240);
  doc.rect(innerX, curY, innerW, headerH, 'F');

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(innerX, curY, innerW, tableH);
  doc.line(innerX, curY + headerH, innerX + innerW, curY + headerH);

  doc.line(col1, curY, col1, curY + tableH);
  doc.line(col2, curY, col2, curY + tableH);
  doc.line(col3, curY, col3, curY + tableH);
  doc.line(col4, curY, col4, curY + tableH);
  doc.line(col5, curY, col5, curY + tableH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const hTextY = curY + 4.7;
  doc.text('SR', col0 + c0W / 2, hTextY, { align: 'center' });
  doc.text('SUBJECT', col1 + 3, hTextY);
  doc.text('DATE', col2 + c2W / 2, hTextY, { align: 'center' });
  doc.text('TIME', col3 + c3W / 2, hTextY, { align: 'center' });
  doc.text('ROOM', col4 + c4W / 2, hTextY, { align: 'center' });
  doc.text('MARKS', col5 + c5W / 2, hTextY, { align: 'center' });

  slip.dateSheet.forEach((item, idx) => {
    const rTop = curY + headerH + idx * rowH;
    const rTextY = rTop + 4.4;

    if (idx > 0) {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.15);
      doc.line(innerX, rTop, innerX + innerW, rTop);
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(String(idx + 1), col0 + c0W / 2, rTextY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    const subj = (item.subjectName || '').toUpperCase();
    doc.text(doc.splitTextToSize(subj, c1W - 5)[0] || subj, col1 + 3, rTextY);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.8);
    doc.text(item.date || '-', col2 + c2W / 2, rTextY, { align: 'center' });
    doc.text(item.time || '-', col3 + c3W / 2, rTextY, { align: 'center' });
    doc.text(item.room || 'Hall A', col4 + c4W / 2, rTextY, { align: 'center' });
    doc.text(String(item.totalMarks ?? 100), col5 + c5W / 2, rTextY, { align: 'center' });
  });

  // Candidate Instructions Strip
  const instY = curY + tableH + 3;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.2);
  doc.rect(innerX, instY, innerW, 10, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 40, 40);
  doc.text('INSTRUCTIONS: 1. Arrive 20 minutes before exam time.  2. Keep this admit card on your desk during all papers.', innerX + 3, instY + 4.2);
  doc.text('3. Mobile phones, smartwatches, and unauthorized study material are strictly prohibited in the examination hall.', innerX + 3, instY + 8);

  // Footer Signatures
  const footerLineY = instY + 19;
  const signLineW = 42;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(innerX, footerLineY, innerX + signLineW, footerLineY);
  doc.line(innerX + innerW - signLineW, footerLineY, innerX + innerW, footerLineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('CANDIDATE SIGNATURE', innerX + signLineW / 2, footerLineY + 4, { align: 'center' });
  doc.text('CONTROLLER OF EXAMINATIONS', innerX + innerW - signLineW / 2, footerLineY + 4, { align: 'center' });
}

