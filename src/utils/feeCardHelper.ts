import { Student, ClassInfo } from '../types';
import { SchoolSettings, getSchoolSettings } from './settingsHelper';
import { loadAllLedgerItems, ensureStudentLedgerGenerated, StudentFeeItem } from './studentFeeLedgerHelper';
import { feeHeadGroup } from '../components/FeeChallanSheet';
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
    // Identity numbers come from Settings only. The third-party
    // reference-card defaults that used to be baked in here (a school
    // number, affiliation/UDISE numbers, a trust name and a
    // Muzaffarpur address belonging to a different school) are purged:
    // unset identity prints as blank, never as another school's data.
    schoolNo: (settings as any).schoolNo || '',
    affiliationNo: (settings as any).affiliationNo || '',
    udiseNo: (settings as any).udiseNo || '',
    schoolName: settings.schoolName || '',
    trustName: settings.schoolTagline || '',
    schoolAddress: settings.schoolAddress || '',
    schoolPhone: settings.schoolPhone || '',
    academicSession: settings.session || '',
    className: student.class || 'Class 1',
    section: student.section || 'A',
    rollNo: student.rollNo || student.id || '',
    accountNo: student.id || `A/C-${student.rollNo || '101'}`,
    fatherName: student.fatherName || student.family || '',
    phone: student.phone || student.whatsapp || '',
    address: (student as any).address || (student as any).city || '',
    months,
    totalDue,
    totalPaid,
    balance
  };
}

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

  // 'register-card' (the rebuilt default) has its own renderer at the
  // bottom of this file; the legacy templates continue through the
  // original code path below, untouched.
  if (settings.studentFeeCardTemplate === 'register-card') {
    const doc = buildRegisterCardPdfDoc(students, classes, settings);
    if (doc) {
      const filePrefix = students.length === 1
        ? `${students[0].name.replace(/\s+/g, '_')}_FeeCard`
        : `Fee_Cards_${students.length}_Members`;
      doc.save(`${filePrefix}.pdf`);
    }
    return;
  }

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
    doc.text((cardData.schoolName || '').toUpperCase(), pageWidth / 2, headerStartY + 17, { align: 'center' });

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


// ============================================================================
// REGISTER CARD ('register-card') — the rebuilt Student Fee Card
// ============================================================================
// Design: the owner's reference — a black & white tuition-center fee
// register card. Thick double-ruled border, the school name arched in a
// heavy display style with grey swoosh bands at the top-right, the
// principal / address / Mob. lines taken from Settings (blank values
// are omitted, never filled with another school's identity), student
// particulars printed on dotted lines, a display heading flanked by
// pinstripes, and a 12-month table with black header row and rounded
// outer corners.
// The owner's change on top of the reference: the single FEE column is
// split into ADMISSION FEE | TUITION FEE | FINE / EXTRA. The amounts
// are the student's REAL ledger charges for each month, grouped
// through feeHeadGroup — the same classification the fee challan uses
// (FeeChallanSheet) — so a head can never land in a different column
// on the two documents. A cell is blank when that group has no charge
// that month. The two signature columns stay blank: they are for
// handwriting at collection time and the system records no per-month
// signatures, so nothing is ever fabricated into them.

export interface RegisterCardMonthRow {
  month: string;       // 'JANUARY' … 'DECEMBER'
  monthKey: string;    // ledger monthKey the row was filled from ('' when no charges)
  admissionFee: number;
  tuitionFee: number;
  fineExtra: number;
}

export interface RegisterCardData {
  student: Student;
  schoolName: string;
  principalName: string;
  schoolAddress: string;
  schoolPhone: string;
  academicSession: string;
  studentName: string;
  className: string;
  section: string;
  rollNo: string;
  months: RegisterCardMonthRow[];
}

export const REGISTER_CARD_MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

/** [firstYear, secondYear] parsed from a session string like '2026 - 2027'. */
export function registerCardSessionYears(session: string): [number, number] {
  const years = (session.match(/\d{4}/g) || []).map(Number);
  if (years.length >= 2) return [years[0], years[1]];
  if (years.length === 1) return [years[0], years[0]];
  const now = new Date().getFullYear();
  return [now, now];
}

/**
 * Per-month, per-group REAL charge totals for one student, in calendar
 * order JANUARY..DECEMBER for the session in Settings.
 */
export function buildRegisterCardData(
  student: Student,
  classes: ClassInfo[],
  schoolSettings?: SchoolSettings
): RegisterCardData {
  const settings = schoolSettings || getSchoolSettings();
  const allLedgers = loadAllLedgerItems();
  const items = ensureStudentLedgerGenerated(student, classes, allLedgers);

  const byKey = new Map<string, StudentFeeItem[]>();
  items.forEach(it => {
    const arr = byKey.get(it.monthKey);
    if (arr) arr.push(it);
    else byKey.set(it.monthKey, [it]);
  });

  const [firstYear, secondYear] = registerCardSessionYears(settings.session || '');

  const months: RegisterCardMonthRow[] = REGISTER_CARD_MONTHS.map((name, idx) => {
    const mm = String(idx + 1).padStart(2, '0');
    // The session convention in this codebase is Apr–Mar (see
    // ACADEMIC_MONTH_ROWS): Jan–Mar belong to the session's second
    // year, Apr–Dec to its first. If the primary year holds no charges
    // for this calendar month, fall back to the other session year so
    // a Jan–Dec session reads correctly too. A row is only ever filled
    // from ONE year's real charges — never merged, never invented.
    const primaryYear = idx < 3 ? secondYear : firstYear;
    const otherYear = idx < 3 ? firstYear : secondYear;
    let monthKey = `${primaryYear}-${mm}`;
    let monthItems = byKey.get(monthKey) || [];
    if (monthItems.length === 0 && otherYear !== primaryYear) {
      const altKey = `${otherYear}-${mm}`;
      const altItems = byKey.get(altKey) || [];
      if (altItems.length > 0) {
        monthKey = altKey;
        monthItems = altItems;
      }
    }
    let admissionFee = 0;
    let tuitionFee = 0;
    let fineExtra = 0;
    monthItems.forEach(it => {
      const group = feeHeadGroup(it);
      if (group === 'admission') admissionFee += it.total;
      else if (group === 'tuition') tuitionFee += it.total;
      else fineExtra += it.total;
    });
    return {
      month: name,
      monthKey: monthItems.length > 0 ? monthKey : '',
      admissionFee,
      tuitionFee,
      fineExtra
    };
  });

  return {
    student,
    schoolName: settings.schoolName || '',
    principalName: settings.principalName || '',
    schoolAddress: settings.schoolAddress || '',
    schoolPhone: settings.schoolPhone || '',
    academicSession: settings.session || '',
    studentName: student.name || '',
    className: student.class || '',
    section: student.section || '',
    rollNo: student.rollNo || '',
    months
  };
}

/**
 * Draws the school name along an upward-bulging circular arc, one
 * character at a time, each rotated to the arc tangent (the reference
 * card's arched masthead). Returns the lowest character baseline so
 * the caller can flow the next line underneath.
 */
function drawArchedSchoolName(
  doc: jsPDF,
  name: string,
  cx: number,
  topY: number,
  maxWidth: number
): number {
  const text = name.toUpperCase();
  let fontSize = 27;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const fullWidth = doc.getTextWidth(text);
  if (fullWidth > maxWidth) {
    fontSize = Math.max(11, fontSize * (maxWidth / fullWidth));
    doc.setFontSize(fontSize);
  }
  const chars = [...text];
  const widths = chars.map(ch => doc.getTextWidth(ch));
  const total = widths.reduce((a, b) => a + b, 0);
  const radius = 250;
  const centreBaselineY = topY + fontSize * 0.36;
  const cy = centreBaselineY + radius;
  let s = -total / 2;
  let lowest = centreBaselineY;
  chars.forEach((ch, i) => {
    const centre = s + widths[i] / 2;
    s += widths[i];
    if (ch === ' ') return;
    const theta = centre / radius; // radians; positive = right of centre
    const x = cx + radius * Math.sin(theta);
    const y = cy - radius * Math.cos(theta);
    if (y > lowest) lowest = y;
    doc.text(ch, x, y, { align: 'center', angle: (-theta * 180) / Math.PI });
  });
  return lowest;
}

/** A dotted fill line, drawn as individual dots like the reference. */
function drawDotRow(doc: jsPDF, xFrom: number, xTo: number, y: number): void {
  doc.setFillColor(0, 0, 0);
  for (let x = xFrom; x <= xTo; x += 2.3) {
    doc.circle(x, y, 0.32, 'F');
  }
}

/**
 * Builds the register-card PDF (one page per student). Returns the
 * document instead of saving it so callers/tests can render it.
 */
export function buildRegisterCardPdfDoc(
  students: Student[],
  classes: ClassInfo[],
  schoolSettings?: SchoolSettings
): jsPDF | null {
  if (!students || students.length === 0) return null;
  const settings = schoolSettings || getSchoolSettings();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const x0 = 12;            // content left edge
  const x1 = 198;           // content right edge
  const cx = pageWidth / 2; // 105

  students.forEach((student, sIdx) => {
    if (sIdx > 0) doc.addPage('a4', 'portrait');
    const data = buildRegisterCardData(student, classes, settings);

    // --- Grey swoosh bands, top-right corner (drawn first, behind all,
    // clipped to the border interior so they never cross the frame) ---
    doc.saveGraphicsState();
    doc.rect(7.6, 7.6, 194.8, 281.8, null);
    doc.clip();
    doc.discardPath();
    doc.setLineWidth(2.6);
    const swoosh: Array<[number, number]> = [[46, 182], [38, 208], [30, 232]];
    swoosh.forEach(([r, g]) => {
      doc.setDrawColor(g, g, g);
      doc.circle(199, 9, r, 'S');
    });
    doc.restoreGraphicsState();

    // --- Thick double-ruled page border ---
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.3);
    doc.rect(5, 5, 200, 287);
    doc.setLineWidth(0.45);
    doc.rect(7.6, 7.6, 194.8, 281.8);

    doc.setTextColor(0, 0, 0);
    let y = 14;

    // --- Arched school name (from Settings; omitted entirely when blank) ---
    if (data.schoolName) {
      const lowest = drawArchedSchoolName(doc, data.schoolName, cx, y, x1 - x0 - 4);
      y = lowest + 8.5;
    } else {
      y = 24;
    }

    // --- Principal line (the reference's "Tutor-" line = the school head) ---
    if (data.principalName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      const label = `Principal- ${data.principalName}`;
      doc.text(label, cx, y, { align: 'center' });
      const w = doc.getTextWidth(label);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(cx - w / 2, y + 1.7, cx + w / 2, y + 1.7);
      y += 7;
    }

    // --- Address line ---
    if (data.schoolAddress) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.text(data.schoolAddress, cx, y, { align: 'center' });
      y += 6.5;
    }

    // --- Rule, then the Mob. line between rules (only when a phone is set) ---
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.55);
    doc.line(x0, y, x1, y);
    y += 7;
    if (data.schoolPhone) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.text(`Mob.- ${data.schoolPhone}`, cx, y, { align: 'center' });
      y += 2.8;
      doc.setLineWidth(0.55);
      doc.line(x0, y, x1, y);
      y += 9;
    } else {
      y += 2;
    }

    // --- Student particulars on dotted lines (real values printed) ---
    const classValue = data.className + (data.section ? ` (${data.section})` : '');
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    // Line 1 — Name of the Student : ..........
    doc.text('Name of the Student :', x0, y);
    const nameLabelW = doc.getTextWidth('Name of the Student :');
    drawDotRow(doc, x0 + nameLabelW + 2.5, x1, y + 0.7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(data.studentName, x0 + nameLabelW + 5, y - 0.5);
    y += 8.5;
    // Line 2 — Class .........., Roll .........., Session ..........
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    const seg = (label: string, value: string, segX: number, dotsTo: number) => {
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.text(label, segX, y);
      const lw = doc.getTextWidth(label);
      drawDotRow(doc, segX + lw + 2, dotsTo, y + 0.7);
      if (value) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11.5);
        doc.text(value, segX + lw + 4.5, y - 0.5);
      }
    };
    seg('Class', classValue, x0, 68);
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.text(',', 69.5, y);
    seg('Roll', data.rollNo, 73, 120);
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.text(',', 121.5, y);
    seg('Session', data.academicSession, 125, x1);
    y += 4.5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.55);
    doc.line(x0, y, x1, y);
    y += 5;

    // --- Display heading on pinstripes ---
    // The heading is "FEE REGISTER", not the reference's "ADMISSION
    // FEE": with the owner's 3-way split, admission is only one of
    // three fee columns, so an "ADMISSION FEE" masthead would
    // misdescribe the card. "FEE REGISTER" is what this card is.
    const heading = 'FEE REGISTER';
    const stripeTop = y;
    const stripeShades = [150, 178, 205, 178, 150];
    doc.setLineWidth(0.55);
    stripeShades.forEach((g, i) => {
      doc.setDrawColor(g, g, g);
      doc.line(x0, stripeTop + i * 1.7, x1, stripeTop + i * 1.7);
    });
    const bandH = (stripeShades.length - 1) * 1.7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    const hw = doc.getTextWidth(heading);
    doc.setFillColor(255, 255, 255);
    doc.rect(cx - hw / 2 - 7, stripeTop - 2.8, hw + 14, bandH + 5.6, 'F');
    doc.setTextColor(120, 120, 120);
    doc.text(heading, cx + 0.55, stripeTop + bandH / 2 + 3.15, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.text(heading, cx, stripeTop + bandH / 2 + 2.6, { align: 'center' });
    y = stripeTop + bandH + 8.5;

    // --- 12-month register table ---
    const cols = [33, 25, 25, 25, 39, 39]; // MONTH | ADMISSION | TUITION | FINE/EXTRA | TEACHER SIGN | FATHER SIGN
    const colX: number[] = [x0];
    cols.forEach(w => colX.push(colX[colX.length - 1] + w));
    const tableTop = y;
    const headH = 11;
    // Rows stretch to fill the card down to a fixed bottom limit (the
    // reference's table fills the page), clamped to sane heights.
    const rowH = Math.min(14.5, Math.max(11.5, (283 - tableTop - headH) / 12));
    const tableH = headH + rowH * 12;
    const tableBottom = tableTop + tableH;

    // Body (white, rounded outer corners)
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x0, tableTop, x1 - x0, tableH, 2.6, 2.6, 'F');
    // Grid
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.55);
    for (let i = 0; i <= 12; i++) {
      const gy = tableTop + headH + i * rowH;
      doc.line(x0, gy, x1, gy);
    }
    for (let c = 1; c < cols.length; c++) {
      doc.line(colX[c], tableTop + headH, colX[c], tableBottom);
    }
    // Header row (black, rounded top corners, white separators)
    doc.setFillColor(0, 0, 0);
    doc.roundedRect(x0, tableTop, x1 - x0, headH, 2.6, 2.6, 'F');
    doc.rect(x0, tableTop + headH - 2.6, x1 - x0, 2.6, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.7);
    for (let c = 1; c < cols.length; c++) {
      doc.line(colX[c], tableTop + 0.8, colX[c], tableTop + headH - 0.4);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const headOne = (t: string, col: number) => {
      doc.setFontSize(9.5);
      doc.text(t, colX[col] + cols[col] / 2, tableTop + 7.1, { align: 'center' });
    };
    const headTwo = (l1: string, l2: string, col: number) => {
      doc.setFontSize(8.8);
      doc.text(l1, colX[col] + cols[col] / 2, tableTop + 4.7, { align: 'center' });
      doc.text(l2, colX[col] + cols[col] / 2, tableTop + 8.7, { align: 'center' });
    };
    headOne('MONTH', 0);
    headTwo('ADMISSION', 'FEE', 1);
    headTwo('TUITION', 'FEE', 2);
    headTwo('FINE /', 'EXTRA', 3);
    headTwo("TEACHER'S", 'SIGNATURE', 4);
    headTwo("FATHER'S", 'SIGNATURE', 5);

    // Body rows — real charged amounts, blank when no charge
    doc.setTextColor(0, 0, 0);
    data.months.forEach((row, i) => {
      const base = tableTop + headH + i * rowH + rowH / 2 + 1.9;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(row.month, colX[0] + 3, base);
      doc.setFont('helvetica', 'normal');
      const cells = [row.admissionFee, row.tuitionFee, row.fineExtra];
      cells.forEach((v, c) => {
        const t = formatOrBlank(v);
        if (t) doc.text(t, colX[c + 1] + cols[c + 1] - 2.5, base, { align: 'right' });
      });
      // Signature columns intentionally left blank for handwriting.
    });

    // Outer table stroke last, so the rounded corners mask the grid ends
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.85);
    doc.roundedRect(x0, tableTop, x1 - x0, tableH, 2.6, 2.6, 'S');
  });

  return doc;
}
