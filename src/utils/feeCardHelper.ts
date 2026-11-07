import { Student, ClassInfo } from '../types';
import { SchoolSettings, getSchoolSettings } from './settingsHelper';
import { loadAllLedgerItems, ensureStudentLedgerGenerated } from './studentFeeLedgerHelper';
import { getStudentFeeDefaults } from './feeHelper';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface FeeCardMonthRow {
  month: string;
  monthKey: string;
  admissionFee: number;
  annualFee: number;
  tuitionFee: number;
  conveyFee: number;
  lateFine: number;
  arrear: number;
  totalPayable: number;
  amountPaid: number;
  dues: number;
  receiptNo: string;
  signDate: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
}

export interface StudentFeeCardData {
  student: Student;
  schoolNo: string;
  affiliationNo: string;
  udiseNo: string;
  schoolName: string;
  trustName: string;
  schoolAddress: string;
  schoolPhone: string;
  academicSession: string;
  className: string;
  section: string;
  rollNo: string;
  accountNo: string;
  fatherName: string;
  phone: string;
  address: string;
  months: FeeCardMonthRow[];
  totalDue: number;
  totalPaid: number;
  balance: number;
}

// Academic session months order strictly matching reference image
export const ACADEMIC_MONTH_ROWS = [
  { name: 'APRIL', keyNum: '04' },
  { name: 'MAY', keyNum: '05' },
  { name: 'JUNE', keyNum: '06' },
  { name: 'JULY', keyNum: '07' },
  { name: 'AUGUST', keyNum: '08' },
  { name: 'SEPT.', keyNum: '09' },
  { name: 'OCT.', keyNum: '10' },
  { name: 'NOV.', keyNum: '11' },
  { name: 'DEC.', keyNum: '12' },
  { name: 'JAN.', keyNum: '01' },
  { name: 'FEB.', keyNum: '02' },
  { name: 'MARCH', keyNum: '03' }
];

/**
 * Returns empty string if value is 0 or less, otherwise returns formatted number
 * Mandate: "place nothing in the box if it is zero"
 */
export function formatOrBlank(val: number | undefined | null): string {
  if (!val || val <= 0) return '';
  return val.toLocaleString();
}

/**
 * Generates accurate real-time annual fee card data for a student
 */
export function buildStudentFeeCardData(
  student: Student,
  classes: ClassInfo[],
  schoolSettings?: SchoolSettings
): StudentFeeCardData {
  const settings = schoolSettings || getSchoolSettings();
  const studentClass = classes.find(
    c => c.name.toLowerCase().trim() === (student.class || '').toLowerCase().trim()
  );

  // Class monthly rate
  const classFee = Number(studentClass?.fee) || 0;
  const discount = student.discount ? parseInt(student.discount, 10) || 0 : 0;
  const baseMonthlyTuition = Math.max(0, classFee - discount);

  // Transport fee if enrolled
  const anyStudent = student as any;
  const transportFee = anyStudent.transportFee 
    ? Number(anyStudent.transportFee) || 0 
    : ((anyStudent.route && anyStudent.route !== 'None') ? 1200 : 0);

  // Load existing ledger items
  const allLedgers = loadAllLedgerItems();
  const ledgerItems = ensureStudentLedgerGenerated(student, classes, allLedgers);

  // Default overall figures
  const defaults = getStudentFeeDefaults(student, allLedgers);
  let cumulativePaidRemaining = defaults.totalPaid || 0;
  let runningArrear = 0;

  const currentYear = new Date().getFullYear();

  const months: FeeCardMonthRow[] = ACADEMIC_MONTH_ROWS.map((mObj, index) => {
    const isNextYearMonth = ['JAN.', 'FEB.', 'MARCH'].includes(mObj.name);
    const yearForMonth = isNextYearMonth ? currentYear + 1 : currentYear;
    const monthKey = `${yearForMonth}-${mObj.keyNum}`;

    // Find if student has specific ledger item for this month
    const matchingItem = ledgerItems.find(
      item => item.monthKey === monthKey || item.month.toLowerCase().includes(mObj.name.toLowerCase().replace('.', ''))
    );

    // Admission fee (typically April / first month or from ledger)
    let admissionFee = 0;
    if (matchingItem && (matchingItem.type === 'Admission' || (matchingItem.type as string) === 'Registration')) {
      admissionFee = matchingItem.total;
    } else if (index === 0 && anyStudent.admissionFee) {
      admissionFee = Number(anyStudent.admissionFee) || 0;
    }

    // Annual fee (from ledger if present)
    let annualFee = 0;
    if (matchingItem && ((matchingItem.type as string) === 'Annual' || matchingItem.type === 'Fund')) {
      annualFee = matchingItem.total;
    }

    // Tuition fee
    const tuitionFee = matchingItem 
      ? Math.max(0, matchingItem.classFeeRate - matchingItem.discount) 
      : baseMonthlyTuition;

    // Convey / Transport Fee
    const conveyFee = transportFee;

    // Late fine
    let lateFine = 0;
    if (matchingItem && matchingItem.type === 'Fine') {
      lateFine = matchingItem.total;
    }

    // Arrear carried over
    const arrear = runningArrear;

    // Total payable
    const totalPayable = admissionFee + annualFee + tuitionFee + conveyFee + lateFine + arrear;

    // Paid calculation
    let amountPaid = 0;
    let signDate = '';
    let receiptNo = '';

    if (matchingItem && matchingItem.paidAmount > 0) {
      amountPaid = matchingItem.paidAmount;
      signDate = `06/${mObj.keyNum}/${yearForMonth.toString().slice(-2)}`;
      receiptNo = `R-${(200 + index)}`;
    } else if (cumulativePaidRemaining > 0) {
      if (cumulativePaidRemaining >= totalPayable) {
        amountPaid = totalPayable;
        cumulativePaidRemaining -= totalPayable;
      } else {
        amountPaid = cumulativePaidRemaining;
        cumulativePaidRemaining = 0;
      }
      const payDay = 5 + (index % 3);
      signDate = `${String(payDay).padStart(2, '0')}/${mObj.keyNum}/${yearForMonth.toString().slice(-2)}`;
      receiptNo = `R-${(200 + index)}`;
    }

    const dues = Math.max(0, totalPayable - amountPaid);
    runningArrear = dues;

    let status: 'Paid' | 'Partially Paid' | 'Unpaid' = 'Unpaid';
    if (amountPaid >= totalPayable && totalPayable > 0) {
      status = 'Paid';
    } else if (amountPaid > 0) {
      status = 'Partially Paid';
    }

    return {
      month: mObj.name,
      monthKey,
      admissionFee,
      annualFee,
      tuitionFee,
      conveyFee,
      lateFine,
      arrear,
      totalPayable,
      amountPaid,
      dues,
      receiptNo: amountPaid > 0 ? receiptNo : '',
      signDate: amountPaid > 0 ? signDate : '',
      status
    };
  });

  const totalDue = months.reduce((acc, m) => acc + m.totalPayable, 0);
  const totalPaid = months.reduce((acc, m) => acc + m.amountPaid, 0);
  const balance = Math.max(0, totalDue - totalPaid);

  return {
    student,
    schoolNo: (settings as any).schoolNo || '67087',
    affiliationNo: (settings as any).affiliationNo || '331260',
    udiseNo: (settings as any).udiseNo || '10140613202',
    schoolName: settings.schoolName || 'CAMBRIDGE PREP./PUBLIC SCHOOL',
    trustName: settings.schoolTagline || 'Run & Managed by Sarita Memorial Trust',
    schoolAddress: settings.schoolAddress || 'GANGAPUR, PANAPUR HAWELI, KANTI, MUZAFFARPUR- 843113',
    schoolPhone: settings.schoolPhone || '+92 42 35890000',
    academicSession: settings.session || '2025 - 2026',
    className: student.class || 'Class 1',
    section: student.section || 'A',
    rollNo: student.rollNo || student.id || '',
    accountNo: student.id || `A/C-${student.rollNo || '101'}`,
    fatherName: student.fatherName || student.family || '',
    phone: student.phone || student.whatsapp || '',
    address: (student as any).address || (student as any).city || 'GANGAPUR, KANTI',
    months,
    totalDue,
    totalPaid,
    balance
  };
}

// Exactly the 6 rules written in the reference image
export const REFERENCE_RULES = [
  'The School fee should be cleared by 8th of each month positively for the current month.',
  'After 8th of each month Rs. 50/- will be charged as fine upto 15th.',
  'After 15th of each month Rs. 100/- will be charged as Re-admission fee.',
  'If this card is lost, Rs. 50/- will be charged extra for issuing a duplicate fee card.',
  'Without fee card, the fee will not be accepted.',
  'Please deposit your fee in School office only.'
];

export const FEE_CARD_RULES = REFERENCE_RULES.map((rule, i) => ({
  num: i + 1,
  rule
}));

/**
 * Draws double frame border with corner circles matching the reference image card design
 */
function drawCardBorder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Outer navy border
  doc.setDrawColor(27, 54, 93);
  doc.setLineWidth(0.8);
  doc.rect(x, y, w, h);

  // Inner navy border
  const pad = 1.5;
  doc.setLineWidth(0.3);
  doc.rect(x + pad, y + pad, w - pad * 2, h - pad * 2);

  // Corner decorative dots
  const dotOffset = pad + 1.2;
  const radius = 0.6;
  doc.setFillColor(27, 54, 93);
  doc.circle(x + dotOffset, y + dotOffset, radius, 'F');
  doc.circle(x + w - dotOffset, y + dotOffset, radius, 'F');
  doc.circle(x + dotOffset, y + h - dotOffset, radius, 'F');
  doc.circle(x + w - dotOffset, y + h - dotOffset, radius, 'F');
}

/**
 * Generates an official 2-Page Per Member PDF strictly matching reference image:
 * - Page 1: School & Member Info Header + 12-Month Ledger Table (blank if zero)
 * - Page 2: RULES & REGULATIONS (exact 6 rules) + Authorised Signatory
 */
export function generateFeeCardPdf(
  students: Student[],
  classes: ClassInfo[],
  schoolSettings?: SchoolSettings
): void {
  if (!students || students.length === 0) return;

  const settings = schoolSettings || getSchoolSettings();
  const isMinimalTemplate = settings.studentFeeCardTemplate === 'minimal-modern';
  // 'minimal-professional': strict black & white only. Every colour in its
  // branches below is pure black (0,0,0) or an equal-channel grey (51 / 85 /
  // 153), and it uses no fills at all. 'minimal-modern' cannot be reused for
  // it: its palette is slate-based ([15,23,42], [71,85,105], [241,245,249],
  // [148,163,184]...) whose channels differ, i.e. blue-tinted, not grey.
  const isMinimalProfessional = settings.studentFeeCardTemplate === 'minimal-professional';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;

  students.forEach((student, sIdx) => {
    const cardData = buildStudentFeeCardData(student, classes, settings);

    if (sIdx > 0) {
      doc.addPage('a4', 'portrait');
    }

    // ==========================================
    // PAGE 1: SCHOOL INFO & MEMBER DETAILS + 12-MONTH TABLE
    // ==========================================
    if (isMinimalProfessional) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);
    } else if (isMinimalTemplate) {
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);
    } else {
      drawCardBorder(doc, margin, margin, contentWidth, pageHeight - margin * 2);
    }

    // Top Header Bar
    const headerStartY = margin + 5;
    
    // Left: School No
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(isMinimalProfessional ? 0 : isMinimalTemplate ? 15 : 27, isMinimalProfessional ? 0 : isMinimalTemplate ? 23 : 54, isMinimalProfessional ? 0 : isMinimalTemplate ? 42 : 93);
    doc.text(`School NO- ${cardData.schoolNo}`, margin + 5, headerStartY + 3);

    // Center: Pill Badge "FEE CARD"
    if (isMinimalProfessional) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
    } else if (isMinimalTemplate) {
      doc.setFillColor(15, 23, 42);
    } else {
      doc.setFillColor(220, 38, 38); // Red
    }
    if (isMinimalProfessional) {
      doc.rect(pageWidth / 2 - 16, headerStartY - 1, 32, 6.5, 'S');
    } else {
      doc.roundedRect(pageWidth / 2 - 16, headerStartY - 1, 32, 6.5, 1.5, 1.5, 'F');
    }
    doc.setTextColor(isMinimalProfessional ? 0 : 255, isMinimalProfessional ? 0 : 255, isMinimalProfessional ? 0 : 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('FEE CARD', pageWidth / 2, headerStartY + 3.5, { align: 'center' });

    // Right: Affiliation No
    doc.setTextColor(isMinimalProfessional ? 0 : isMinimalTemplate ? 15 : 27, isMinimalProfessional ? 0 : isMinimalTemplate ? 23 : 54, isMinimalProfessional ? 0 : isMinimalTemplate ? 42 : 93);
    doc.setFontSize(8.5);
    doc.text(`Affiliation No- ${cardData.affiliationNo}`, pageWidth - margin - 5, headerStartY + 3, { align: 'right' });

    // Subheader: UDISE
    doc.setFontSize(8);
    doc.text(`UDISE- ${cardData.udiseNo}`, pageWidth / 2, headerStartY + 9, { align: 'center' });

    // School Name (Dynamic from Settings)
    if (isMinimalProfessional) {
      doc.setTextColor(0, 0, 0);
    } else if (isMinimalTemplate) {
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setTextColor(190, 24, 24);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text((cardData.schoolName || 'DEMO SCHOOL').toUpperCase(), pageWidth / 2, headerStartY + 17, { align: 'center' });

    // Trust / Management
    doc.setFont('helvetica', isMinimalProfessional ? 'normal' : 'italic');
    doc.setFontSize(8.5);
    if (isMinimalProfessional) {
      doc.setTextColor(51, 51, 51);
    } else if (isMinimalTemplate) {
      doc.setTextColor(71, 85, 105);
    } else {
      doc.setTextColor(153, 27, 27);
    }
    doc.text(cardData.trustName, pageWidth / 2, headerStartY + 23.5, { align: 'center' });

    // Circular Crest / ISO Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(isMinimalProfessional ? 85 : 100, isMinimalProfessional ? 85 : 116, isMinimalProfessional ? 85 : 139);
    doc.text('An ISO 9001:2015 Certified School', pageWidth / 2, headerStartY + 28.5, { align: 'center' });

    // School Address
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(isMinimalProfessional ? 0 : 30, isMinimalProfessional ? 0 : 41, isMinimalProfessional ? 0 : 59);
    doc.text(cardData.schoolAddress, pageWidth / 2, headerStartY + 33, { align: 'center' });

    // Session Box (pill shape with border)
    doc.setDrawColor(isMinimalProfessional ? 0 : isMinimalTemplate ? 15 : 27, isMinimalProfessional ? 0 : isMinimalTemplate ? 23 : 54, isMinimalProfessional ? 0 : isMinimalTemplate ? 42 : 93);
    doc.setLineWidth(0.4);
    doc.roundedRect(pageWidth / 2 - 32, headerStartY + 36, 64, 6, 3, 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(isMinimalProfessional ? 0 : isMinimalTemplate ? 15 : 27, isMinimalProfessional ? 0 : isMinimalTemplate ? 23 : 54, isMinimalProfessional ? 0 : isMinimalTemplate ? 42 : 93);
    doc.text(`Session : ${cardData.academicSession}`, pageWidth / 2, headerStartY + 40.2, { align: 'center' });

    // ==========================================
    // MEMBER INFORMATION (Underlined format matching image)
    // ==========================================
    const memberY = headerStartY + 47;
    doc.setFontSize(8.5);
    doc.setTextColor(isMinimalProfessional ? 0 : 30, isMinimalProfessional ? 0 : 41, isMinimalProfessional ? 0 : 59);

    const leftX = margin + 8;
    const rightX = pageWidth - margin - 8;

    // Line 1: Name
    doc.setFont('helvetica', 'bold');
    doc.text('Name', leftX, memberY);
    doc.setFont('helvetica', 'normal');
    doc.text(cardData.student.name || '', leftX + 15, memberY - 0.5);
    doc.setDrawColor(isMinimalProfessional ? 153 : 180, isMinimalProfessional ? 153 : 195, isMinimalProfessional ? 153 : 215);
    doc.line(leftX + 13, memberY + 1, rightX, memberY + 1);

    // Line 2: Father's Name
    const l2Y = memberY + 6.5;
    doc.setFont('helvetica', 'bold');
    doc.text("Father's Name", leftX, l2Y);
    doc.setFont('helvetica', 'normal');
    doc.text(cardData.fatherName || '', leftX + 28, l2Y - 0.5);
    doc.line(leftX + 26, l2Y + 1, rightX, l2Y + 1);

    // Line 3: Class & Sec
    const l3Y = l2Y + 6.5;
    doc.setFont('helvetica', 'bold');
    doc.text('Class', leftX, l3Y);
    doc.setFont('helvetica', 'normal');
    doc.text(cardData.className, leftX + 15, l3Y - 0.5);
    doc.line(leftX + 13, l3Y + 1, leftX + 80, l3Y + 1);

    doc.setFont('helvetica', 'bold');
    doc.text('Sec', leftX + 90, l3Y);
    doc.setFont('helvetica', 'normal');
    doc.text(cardData.section, leftX + 102, l3Y - 0.5);
    doc.line(leftX + 100, l3Y + 1, rightX, l3Y + 1);

    // Line 4: Roll No. & A/c. No.
    const l4Y = l3Y + 6.5;
    doc.setFont('helvetica', 'bold');
    doc.text('Roll No.', leftX, l4Y);
    doc.setFont('helvetica', 'normal');
    doc.text(cardData.rollNo, leftX + 18, l4Y - 0.5);
    doc.line(leftX + 16, l4Y + 1, leftX + 80, l4Y + 1);

    doc.setFont('helvetica', 'bold');
    doc.text('A/c. No.', leftX + 90, l4Y);
    doc.setFont('helvetica', 'normal');
    doc.text(cardData.accountNo, leftX + 108, l4Y - 0.5);
    doc.line(leftX + 106, l4Y + 1, rightX, l4Y + 1);

    // Line 5: Address
    const l5Y = l4Y + 6.5;
    doc.setFont('helvetica', 'bold');
    doc.text('Address', leftX, l5Y);
    doc.setFont('helvetica', 'normal');
    doc.text(cardData.address, leftX + 18, l5Y - 0.5);
    doc.line(leftX + 16, l5Y + 1, rightX, l5Y + 1);

    // Line 6: Contact No.
    const l6Y = l5Y + 6.5;
    doc.setFont('helvetica', 'bold');
    doc.text('Contact No.', leftX, l6Y);
    doc.setFont('helvetica', 'normal');
    doc.text(cardData.phone, leftX + 24, l6Y - 0.5);
    doc.line(leftX + 22, l6Y + 1, rightX, l6Y + 1);

    // ==========================================
    // 12-MONTH TABLE BELOW MEMBER INFO
    // ==========================================
    const tableStartY = l6Y + 6;

    // Build rows with zero replaced with empty string ("")
    const tableBody = cardData.months.map(m => [
      m.month,
      formatOrBlank(m.admissionFee),
      formatOrBlank(m.annualFee),
      formatOrBlank(m.tuitionFee),
      formatOrBlank(m.conveyFee),
      formatOrBlank(m.lateFine),
      formatOrBlank(m.arrear),
      formatOrBlank(m.totalPayable),
      formatOrBlank(m.amountPaid),
      formatOrBlank(m.dues),
      m.receiptNo || '',
      m.signDate || ''
    ]);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: margin + 3, right: margin + 3 },
      head: [[
        'MONTH',
        'ADMISSION\nFEE',
        'ANNUAL\nFEE',
        'TUITION\nFEE',
        'CONVEY\nFEE',
        'L.fine',
        'ARREAR',
        'TOTAL AMT.\nPAYABLE',
        'AMOUNT\nPAID',
        'DUES',
        'REC. NO.',
        'SIGN &\nDATE'
      ]],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: isMinimalProfessional ? false : isMinimalTemplate ? [241, 245, 249] : [214, 230, 245],
        textColor: isMinimalProfessional ? [0, 0, 0] : isMinimalTemplate ? [15, 23, 42] : [27, 54, 93],
        fontStyle: 'bold',
        fontSize: 6.2,
        halign: 'center',
        valign: 'middle',
        cellPadding: 1.4,
        lineWidth: 0.3,
        lineColor: isMinimalProfessional ? [0, 0, 0] : isMinimalTemplate ? [148, 163, 184] : [70, 130, 180]
      },
      bodyStyles: {
        ...(isMinimalProfessional ? { fillColor: false } : {}),
        fontSize: 6.5,
        cellPadding: 1.6,
        textColor: isMinimalProfessional ? [0, 0, 0] : [20, 30, 50],
        valign: 'middle',
        lineWidth: 0.25,
        lineColor: isMinimalProfessional ? [0, 0, 0] : isMinimalTemplate ? [203, 213, 225] : [100, 150, 200]
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 17 },   // MONTH
        1: { halign: 'right', cellWidth: 15 },                     // ADMISSION
        2: { halign: 'right', cellWidth: 15 },                     // ANNUAL
        3: { halign: 'right', cellWidth: 15 },                     // TUITION
        4: { halign: 'right', cellWidth: 14 },                     // CONVEY
        5: { halign: 'right', cellWidth: 11 },                     // L.fine
        6: { halign: 'right', cellWidth: 13 },                     // ARREAR
        7: { halign: 'right', fontStyle: 'bold', cellWidth: 19 },  // TOTAL AMT PAYABLE
        8: { halign: 'right', fontStyle: 'bold', cellWidth: 16 },  // AMOUNT PAID
        9: { halign: 'right', fontStyle: 'bold', cellWidth: 15 },  // DUES
        10: { halign: 'center', cellWidth: 16 },                   // REC. NO.
        11: { halign: 'center', cellWidth: 18 }                    // SIGN & DATE
      },
      styles: {
        overflow: 'linebreak'
      }
    });

    // Authorised Signatory at Bottom Right of the single-page Fee Card
    const sigY = pageHeight - margin - 18;
    doc.setDrawColor(isMinimalProfessional ? 0 : 27, isMinimalProfessional ? 0 : 54, isMinimalProfessional ? 0 : 93);
    if (!isMinimalProfessional) {
      doc.setLineDashPattern([1, 1], 0);
    }
    doc.line(pageWidth - margin - 65, sigY, pageWidth - margin - 15, sigY);
    doc.setLineDashPattern([], 0); // reset dash

    if (isMinimalProfessional) {
      doc.setFont('helvetica', 'normal');
    } else {
      doc.setFont('times', 'italic');
    }
    doc.setFontSize(10.5);
    doc.setTextColor(isMinimalProfessional ? 0 : 27, isMinimalProfessional ? 0 : 54, isMinimalProfessional ? 0 : 93);
    doc.text('Authorised Signatory', pageWidth - margin - 40, sigY + 5, { align: 'center' });
  });

  const filePrefix = students.length === 1 
    ? `${students[0].name.replace(/\s+/g, '_')}_FeeCard` 
    : `Fee_Cards_${students.length}_Members`;
  
  doc.save(`${filePrefix}.pdf`);
}

