import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StaffMember, CardTemplateType, SalaryBreakdown } from '../types';
import { SchoolInfo, DEFAULT_SCHOOL } from './pdfGenerator';
import { getSchoolSettings, StaffSalarySlipTemplateType } from './settingsHelper';
import { getInitials } from '../data/initialStudents';

// Generates a single vertical Staff ID Card PDF (54mm x 86mm standard ID card CR80 size)
export function generateSingleStaffIdCard(
  staff: StaffMember,
  template?: CardTemplateType,
  school: SchoolInfo = DEFAULT_SCHOOL
) {
  const activeTemplate = template || getSchoolSettings().staffIdCardTemplate || 'modern-tech';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [54, 86]
  });

  renderStaffCardOnPage(doc, staff, activeTemplate, school);
  doc.save(`${staff.id}_${staff.name.replace(/\s+/g, '_')}_StaffIDCard.pdf`);
}

// Generates all staff cards in a single combined PDF (1 page per card)
export function generateAllStaffIdCards(
  staffList: StaffMember[],
  template?: CardTemplateType,
  school: SchoolInfo = DEFAULT_SCHOOL
) {
  if (staffList.length === 0) return;
  const activeTemplate = template || getSchoolSettings().staffIdCardTemplate || 'modern-tech';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [54, 86]
  });

  staffList.forEach((staff, index) => {
    if (index > 0) {
      doc.addPage([54, 86], 'portrait');
    }
    renderStaffCardOnPage(doc, staff, activeTemplate, school);
  });

  doc.save(`All_Staff_ID_Cards_${activeTemplate}_(${staffList.length}).pdf`);
}

// Render staff card content into the current page of doc
function renderStaffCardOnPage(doc: jsPDF, staff: StaffMember, template: CardTemplateType, school: SchoolInfo) {
  const width = 54;
  const height = 86;

  if (template === 'modern-tech') {
    // Background Dark Slate
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, width, height, 'F');

    // Header gradient banner
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, width, 24, 'F');

    // Accent line: emerald for staff
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 23, width, 1.2, 'F');

    // School Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(school.name.toUpperCase(), width / 2, 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`STAFF IDENTITY CARD • ${school.session}`, width / 2, 9.5, { align: 'center' });

    // Photo Box / Avatar Frame
    const photoSize = 18;
    const photoX = (width - photoSize) / 2;
    const photoY = 12;

    // Card Photo Border
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(photoX - 0.5, photoY - 0.5, photoSize + 1, photoSize + 1, 2, 2, 'F');
    doc.setFillColor(5, 150, 105);
    doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'F');

    // Render Staff Photo or Initials
    let renderedPhoto = false;
    if (staff.photo) {
      try {
        doc.addImage(staff.photo, photoX, photoY, photoSize, photoSize);
        renderedPhoto = true;
      } catch (e) {
        console.warn('Could not render photo in PDF, falling back to initials:', e);
      }
    }

    if (!renderedPhoto) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(getInitials(staff.name), width / 2, photoY + 11.5, { align: 'center' });
    }

    // Staff Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    const displayName = staff.name.length > 22 ? staff.name.substring(0, 20) + '...' : staff.name;
    doc.text(displayName, width / 2, 35, { align: 'center' });

    // Designation / Role
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(16, 185, 129); // emerald-400
    const displayRole = staff.role.length > 26 ? staff.role.substring(0, 24) + '...' : staff.role;
    doc.text(displayRole, width / 2, 38.5, { align: 'center' });

    // Category / Department Badge
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(width / 2 - 18, 41, 36, 4.2, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`${staff.category.toUpperCase()} • ${staff.department}`, width / 2, 44, { align: 'center' });

    // Information Grid
    doc.setDrawColor(51, 65, 85); // slate-700
    doc.setLineWidth(0.3);
    doc.line(4, 48, width - 4, 48);

    const startY = 52;
    const rowH = 4.2;

    const drawField = (label: string, value: string, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(label.toUpperCase(), 6, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(241, 245, 249); // slate-100
      const displayVal = value.length > 22 ? value.substring(0, 20) + '...' : value;
      doc.text(displayVal, 22, y);
    };

    drawField('Emp ID:', staff.id, startY);
    drawField('Degree:', staff.qualification || 'Certified', startY + rowH);
    drawField('Joined:', staff.joiningDate || '2023', startY + rowH * 2);
    drawField('Phone:', staff.phone || 'N/A', startY + rowH * 3);
    drawField('Blood Grp:', staff.bloodGroup || 'O+', startY + rowH * 4);

    // Barcode representation
    doc.setFillColor(255, 255, 255);
    doc.rect(8, 74, width - 16, 5, 'F');
    
    // Draw barcode bars
    doc.setFillColor(0, 0, 0);
    const code = staff.id;
    let barX = 10;
    for (let i = 0; i < code.length; i++) {
      const charCode = code.charCodeAt(i);
      const barW = (charCode % 2 === 0) ? 0.6 : 1.1;
      doc.rect(barX, 74.5, barW, 4, 'F');
      barX += barW + 0.5;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(100, 116, 139);
    doc.text(staff.id, width / 2, 81, { align: 'center' });

    // Footer
    doc.setFontSize(4);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Academic Institution • Non-Transferable', width / 2, 84, { align: 'center' });

  } else {
    // Classic Academic Light Template
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, 0, width, height, 'F');

    // Outer border
    doc.setDrawColor(16, 185, 129); // emerald-600
    doc.setLineWidth(1);
    doc.rect(2, 2, width - 4, height - 4);

    // Header Navy
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(2.5, 2.5, width - 5, 20, 'F');

    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(school.name, width / 2, 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(16, 185, 129);
    doc.text('STAFF IDENTIFICATION CARD', width / 2, 11, { align: 'center' });

    doc.setFontSize(5);
    doc.setTextColor(203, 213, 225);
    doc.text(`ACADEMIC YEAR ${school.session}`, width / 2, 14, { align: 'center' });

    // Photo Box
    const photoSize = 18;
    const photoX = (width - photoSize) / 2;
    const photoY = 15;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.rect(photoX - 0.5, photoY - 0.5, photoSize + 1, photoSize + 1, 'FD');

    let renderedPhoto = false;
    if (staff.photo) {
      try {
        doc.addImage(staff.photo, photoX, photoY, photoSize, photoSize);
        renderedPhoto = true;
      } catch (e) {
        console.warn('Classic template photo error:', e);
      }
    }

    if (!renderedPhoto) {
      doc.setFillColor(16, 185, 129);
      doc.rect(photoX, photoY, photoSize, photoSize, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(getInitials(staff.name), width / 2, photoY + 11.5, { align: 'center' });
    }

    // Name
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(staff.name, width / 2, 38, { align: 'center' });

    // Role
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(5, 150, 105);
    doc.text(staff.role, width / 2, 42, { align: 'center' });

    // Details Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(4, 46, width - 8, 25, 1, 1, 'F');

    const startY = 51;
    const rowH = 4.2;

    const drawClassicField = (lbl: string, val: string, y: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105);
      doc.text(lbl, 6, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(15, 23, 42);
      doc.text(val, 24, y);
    };

    drawClassicField('Employee ID:', staff.id, startY);
    drawClassicField('Department:', staff.department, startY + rowH);
    drawClassicField('Designation:', staff.category, startY + rowH * 2);
    drawClassicField('Qualification:', staff.qualification || 'N/A', startY + rowH * 3);
    drawClassicField('Contact Phone:', staff.phone, startY + rowH * 4);

    // Signature Line
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(8, 76, 24, 76);
    doc.line(width - 24, 76, width - 8, 76);

    doc.setFontSize(4.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Principal's Sign", 16, 79, { align: 'center' });
    doc.text('Employee Sign', width - 16, 79, { align: 'center' });

    doc.setFontSize(4);
    doc.text('This card is the property of the institution. If found, please return.', width / 2, 83, { align: 'center' });
  }
}

/* ============================================================================
 * Salary-slip template theme — the SINGLE source of truth for how each
 * `staffSalarySlipTemplate` value looks (Fix P1-2).
 *
 * The values below are taken verbatim from the interpretations that already
 * existed in the bulk payslip renderer (`renderSinglePayslipSheet`) and the
 * on-screen previews, per template:
 *   - 'executive-emerald': slate-900 banner + emerald accent stripe, emerald
 *     table header slate-800, emerald net-pay band, "STAFF SALARY PAYSLIP".
 *   - 'minimal-classic': black-bordered header box, all-black text/table
 *     header, light-grey net-pay box with black border, "MONTHLY SALARY
 *     PAYSLIP".
 *   - 'minimal-professional': same black-bordered header box and all-black
 *     text/table header as minimal-classic, but strictly black & white —
 *     every token is black, white or an equal-channel grey, the net-pay box
 *     has NO fill (white, so nothing shows on paper) with a black border,
 *     and the title is "SALARY SLIP". Its `isMinimalClassic` flag is true
 *     because that legacy flag is what routes a theme through the bordered /
 *     monochrome branches in the renderers below and the on-screen previews;
 *     `template` still distinguishes it from 'minimal-classic'.
 * Every salary-slip surface — the single-slip PDF, the bulk/combined PDF and
 * both on-screen previews — must resolve its design through
 * `getSalarySlipTheme` so the chosen template can never be honored in one
 * place and ignored in another again.
 * ========================================================================== */

export type RgbColor = [number, number, number];

export interface SalarySlipTheme {
  template: StaffSalarySlipTemplateType;
  isMinimalClassic: boolean;
  /** 'banner' = filled dark header band; 'bordered' = black-outlined header box */
  headerStyle: 'banner' | 'bordered';
  /** Banner fill (banner style only; null for the bordered header) */
  headerBannerFill: RgbColor | null;
  /** Accent stripe along the banner's bottom edge (banner style only) */
  headerAccentStripe: RgbColor | null;
  headerSchoolColor: RgbColor;
  headerSubColor: RgbColor;
  headerTitleColor: RgbColor;
  /** Document title printed in the header, before the month */
  headerTitle: string;
  infoBoxBorder: RgbColor;
  statusPaidColor: RgbColor;
  tableHeadFill: RgbColor;
  netBoxFill: RgbColor;
  /** Net-pay box outline (bordered variant only; null = solid band) */
  netBoxBorder: RgbColor | null;
  netTextColor: RgbColor;
}

const SALARY_SLIP_THEMES: Record<StaffSalarySlipTemplateType, SalarySlipTheme> = {
  'executive-emerald': {
    template: 'executive-emerald',
    isMinimalClassic: false,
    headerStyle: 'banner',
    headerBannerFill: [15, 23, 42], // slate-900
    headerAccentStripe: [16, 185, 129], // emerald-500
    headerSchoolColor: [255, 255, 255],
    headerSubColor: [148, 163, 184], // slate-400
    headerTitleColor: [52, 211, 153], // emerald-400
    headerTitle: 'STAFF SALARY PAYSLIP',
    infoBoxBorder: [226, 232, 240], // slate-200
    statusPaidColor: [5, 150, 105], // emerald-600
    tableHeadFill: [30, 41, 59], // slate-800
    netBoxFill: [16, 185, 129], // emerald-500
    netBoxBorder: null,
    netTextColor: [255, 255, 255]
  },
  'minimal-classic': {
    template: 'minimal-classic',
    isMinimalClassic: true,
    headerStyle: 'bordered',
    headerBannerFill: null,
    headerAccentStripe: null,
    headerSchoolColor: [0, 0, 0],
    headerSubColor: [0, 0, 0],
    headerTitleColor: [0, 0, 0],
    headerTitle: 'MONTHLY SALARY PAYSLIP',
    infoBoxBorder: [0, 0, 0],
    statusPaidColor: [0, 0, 0],
    tableHeadFill: [0, 0, 0],
    netBoxFill: [241, 245, 249], // slate-100
    netBoxBorder: [0, 0, 0],
    netTextColor: [0, 0, 0]
  },
  'minimal-professional': {
    template: 'minimal-professional',
    // True so every existing `isMinimalClassic` / bordered branch in the
    // renderers and previews routes this theme through the monochrome path.
    isMinimalClassic: true,
    headerStyle: 'bordered',
    // Bordered header: the banner fill is never consumed on that path (the
    // banner branch is the `else`), exactly as for minimal-classic.
    headerBannerFill: null,
    // Consumers guard the stripe with `if (theme.headerAccentStripe)`.
    headerAccentStripe: null,
    headerSchoolColor: [0, 0, 0],
    headerSubColor: [0, 0, 0],
    headerTitleColor: [0, 0, 0],
    headerTitle: 'SALARY SLIP',
    infoBoxBorder: [0, 0, 0],
    statusPaidColor: [0, 0, 0],
    tableHeadFill: [0, 0, 0],
    // Strictly no fill for the net-pay box. Null is NOT usable here: every
    // consumer calls `setFillColor(...theme.netBoxFill)` with no null check
    // (and the field is typed RgbColor, not RgbColor | null), so white is
    // used — it renders as no fill on white paper — with the black border
    // below carrying the box outline.
    netBoxFill: [255, 255, 255],
    netBoxBorder: [0, 0, 0],
    netTextColor: [0, 0, 0]
  }
};

/**
 * Resolves the salary-slip theme for a template value. When no template is
 * passed, the currently saved setting is read — the same pattern the ID-card
 * generators use (`getSchoolSettings().staffIdCardTemplate` above). Unknown
 * or missing values fall back to the default 'executive-emerald' theme, which
 * is also what `getSchoolSettings()` defaults the setting itself to.
 */
export function getSalarySlipTheme(
  template?: StaffSalarySlipTemplateType | string | null
): SalarySlipTheme {
  const active = template ?? getSchoolSettings().staffSalarySlipTemplate;
  if (active === 'minimal-professional') {
    return SALARY_SLIP_THEMES['minimal-professional'];
  }
  return active === 'minimal-classic'
    ? SALARY_SLIP_THEMES['minimal-classic']
    : SALARY_SLIP_THEMES['executive-emerald'];
}

/**
 * Real salary-slip figures for one employee + month, built from the actual
 * payroll record and its payments (see payrollApi.buildSlipBreakdown).
 * When a month has no payroll record (pre-payroll legacy months), slips
 * fall back to base salary with ZERO adjustments — honest figures instead
 * of the previously invented 10% allowances / 5% deductions.
 */
export interface SalarySlipBreakdown {
  staffId: string;
  monthLabel: string;
  baseSalary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  gross: number;
  netPayable: number;
  totalPaid: number;
  outstanding: number;
  isPaid: boolean;
  lastPaidDate?: string;
  paymentMethod?: string;
  referenceNo?: string;
}

/** Honest legacy fallback: the staff member's own base salary, no invented adjustments. */
export function legacySlipBreakdown(staff: StaffMember, monthLabel: string): SalarySlipBreakdown {
  const base = staff.salary || 0;
  const isPaid = staff.payStatus === 'Paid';
  return {
    staffId: staff.id,
    monthLabel,
    baseSalary: base,
    allowances: 0,
    bonus: 0,
    deductions: 0,
    gross: base,
    netPayable: base,
    totalPaid: isPaid ? base : 0,
    outstanding: isPaid ? 0 : base,
    isPaid,
    lastPaidDate: staff.lastPaidDate,
    paymentMethod: staff.paymentMethod,
  };
}

// Generates an Official Printable / Downloadable Salary Pay Slip PDF
export function generateSalarySlipPdf(
  staff: StaffMember,
  breakdown: SalaryBreakdown,
  school: SchoolInfo = DEFAULT_SCHOOL
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5' // A5 is standard professional payslip size (148mm x 210mm)
  });

  const pageWidth = 148;
  const margin = 12;

  // The chosen Settings -> Templates salary-slip template, resolved through
  // the shared theme (Fix P1-2). Previously this generator ignored the
  // setting and always printed the emerald design.
  const theme = getSalarySlipTheme();

  // Minimal Professional: strict-grayscale stand-ins for the hardcoded slate
  // palette used in the body below (the slate values are blue-tinted, so the
  // theme alone cannot keep this template black & white). For the other two
  // templates these constants hold the exact original values — output for
  // executive-emerald and minimal-classic is unchanged.
  const isMP = theme.template === 'minimal-professional';
  const labelColor: RgbColor = isMP ? [85, 85, 85] : [71, 85, 105];
  const valueColor: RgbColor = isMP ? [0, 0, 0] : [15, 23, 42];
  const mutedColor: RgbColor = isMP ? [110, 110, 110] : [100, 116, 139];
  const faintColor: RgbColor = isMP ? [160, 160, 160] : [148, 163, 184];

  // Header — banner (executive-emerald) or bordered box (the minimal themes),
  // matching the bulk payslip renderer's interpretation of the template.
  if (theme.headerStyle === 'bordered') {
    doc.setDrawColor(...theme.headerTitleColor);
    doc.setLineWidth(0.5);
    doc.rect(margin, 6, pageWidth - margin * 2, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...theme.headerSchoolColor);
    doc.text(school.name.toUpperCase(), pageWidth / 2, 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...theme.headerSubColor);
    doc.text(`${school.campus} • ${school.address} • Ph: ${school.phone}`, pageWidth / 2, 18, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...theme.headerTitleColor);
    doc.text(`${theme.headerTitle} — ${breakdown.month.toUpperCase()}`, pageWidth / 2, 24.5, { align: 'center' });
  } else {
    doc.setFillColor(...(theme.headerBannerFill as RgbColor));
    doc.rect(0, 0, pageWidth, 28, 'F');

    if (theme.headerAccentStripe) {
      doc.setFillColor(...theme.headerAccentStripe);
      doc.rect(0, 26.8, pageWidth, 1.2, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...theme.headerSchoolColor);
    doc.text(school.name.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...theme.headerSubColor);
    doc.text(`${school.campus} • ${school.address} • Ph: ${school.phone}`, pageWidth / 2, 15, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...theme.headerTitleColor);
    doc.text(`${theme.headerTitle} — ${breakdown.month.toUpperCase()}`, pageWidth / 2, 22, { align: 'center' });
  }

  // Employee Information Box (Minimal Professional: no fill at all — the
  // stroked outline drawn right after carries the box)
  if (!isMP) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, 33, pageWidth - margin * 2, 28, 2, 2, 'F');
  }
  doc.setDrawColor(...theme.infoBoxBorder);
  doc.roundedRect(margin, 33, pageWidth - margin * 2, 28, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...labelColor);
  
  // Column 1
  doc.text('Employee ID:', margin + 4, 39);
  doc.text('Employee Name:', margin + 4, 45);
  doc.text('Designation / Role:', margin + 4, 51);
  doc.text('Department:', margin + 4, 57);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...valueColor);
  doc.text(staff.id, margin + 35, 39);
  doc.text(staff.name, margin + 35, 45);
  doc.text(staff.role, margin + 35, 51);
  doc.text(staff.department, margin + 35, 57);

  // Column 2
  const col2X = margin + 74;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...labelColor);
  doc.text('Slip Ref No:', col2X, 39);
  doc.text('Payment Date:', col2X, 45);
  doc.text('Payment Mode:', col2X, 51);
  doc.text('Status:', col2X, 57);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...valueColor);
  doc.text(breakdown.referenceNo, col2X + 26, 39);
  doc.text(breakdown.paidDate, col2X + 26, 45);
  doc.text(breakdown.paymentMethod, col2X + 26, 51);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...theme.statusPaidColor);
  doc.text('PAID', col2X + 26, 57);

  // AutoTable for Earnings & Deductions
  const tableData = [
    ['Basic Monthly Salary', `Rs. ${breakdown.baseSalary.toLocaleString()}`, 'Income Tax / Deductions', `Rs. ${breakdown.deductions.toLocaleString()}`],
    ['Allowances (Medical & Transport)', `Rs. ${breakdown.allowances.toLocaleString()}`, 'Absence / Leave Deductions', 'Rs. 0'],
    ['Special Academic Bonus', `Rs. ${(breakdown.bonus || 0).toLocaleString()}`, 'Provident Fund (PF)', 'Rs. 0'],
    [
      { content: 'Gross Earnings', styles: { fontStyle: 'bold' } },
      { content: `Rs. ${(breakdown.baseSalary + breakdown.allowances + (breakdown.bonus || 0)).toLocaleString()}`, styles: { fontStyle: 'bold' } },
      { content: 'Total Deductions', styles: { fontStyle: 'bold' } },
      { content: `Rs. ${breakdown.deductions.toLocaleString()}`, styles: { fontStyle: 'bold' } }
    ]
  ];

  autoTable(doc, {
    startY: 66,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Earnings & Allowances', 'Amount', 'Deductions', 'Amount']],
    headStyles: {
      fillColor: theme.tableHeadFill,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    body: tableData as any,
    styles: {
      fontSize: 8,
      cellPadding: 2.5
    }
  });

  // Net Payable Highlight Box — solid emerald band (executive-emerald) or
  // bordered box with black outline (minimal-classic: light-grey fill;
  // minimal-professional: white/no fill), per the shared theme.
  const finalY = (doc as any).lastAutoTable?.finalY || 105;

  if (theme.netBoxBorder) {
    doc.setFillColor(...theme.netBoxFill);
    doc.setDrawColor(...theme.netBoxBorder);
    doc.setLineWidth(0.5);
    doc.rect(margin, finalY + 4, pageWidth - margin * 2, 14, 'FD');
  } else {
    doc.setFillColor(...theme.netBoxFill);
    doc.roundedRect(margin, finalY + 4, pageWidth - margin * 2, 14, 2, 2, 'F');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...theme.netTextColor);
  doc.text('NET SALARY PAYABLE:', margin + 6, finalY + 12.5);

  doc.setFontSize(13);
  doc.text(`Rs. ${breakdown.netSalary.toLocaleString()}`, pageWidth - margin - 6, finalY + 13, { align: 'right' });

  // Bank Account & Notes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedColor);
  doc.text(`Disbursed to Employee Bank/Payment Account via ${breakdown.paymentMethod}.`, margin, finalY + 24);
  if (breakdown.notes) {
    doc.text(`Remarks: ${breakdown.notes}`, margin, finalY + 29);
  }

  // Signatures
  const signY = finalY + 46;
  doc.setDrawColor(...faintColor);
  doc.setLineWidth(0.4);
  doc.line(margin + 5, signY, margin + 45, signY);
  doc.line(pageWidth - margin - 45, signY, pageWidth - margin - 5, signY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...labelColor);
  doc.text('Accounts Incharge / Bursar', margin + 25, signY + 5, { align: 'center' });
  doc.text('Employee Signature', pageWidth - margin - 25, signY + 5, { align: 'center' });

  // Footer Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...faintColor);
  doc.text('This is a computer-generated salary slip verified by Schoollee Academic Management System.', pageWidth / 2, signY + 14, { align: 'center' });

  doc.save(`${staff.id}_${staff.name.replace(/\s+/g, '_')}_Payslip_${breakdown.month.replace(/\s+/g, '_')}.pdf`);
}

// Generates an Executive Overall Staff Payroll Report PDF (A4 Landscape)
export function generateOverallStaffPayrollReportPdf(
  staffList: StaffMember[],
  month: string,
  school: SchoolInfo = DEFAULT_SCHOOL,
  breakdowns?: Map<string, SalarySlipBreakdown>
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 14;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Emerald accent stripe
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 27, pageWidth, 1.5, 'F');

  // School Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(school.name.toUpperCase(), pageWidth / 2, 9, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${school.campus} • ${school.address} • Phone: ${school.phone} • Session: ${school.session}`, pageWidth / 2, 14.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text(`ENTIRE STAFF OVERALL PAYROLL & DISBURSEMENT DATA — ${month.toUpperCase()}`, pageWidth / 2, 22, { align: 'center' });

  // Compute Grand Totals
  let sumBase = 0;
  let sumAllowances = 0;
  let sumDeductions = 0;
  let sumNet = 0;
  let sumPaid = 0;
  let sumDue = 0;

  const tableRows = staffList.map((staff, index) => {
    // Real payroll figures when a breakdown is supplied; otherwise the
    // honest legacy fallback (base salary, zero adjustments).
    const b = breakdowns?.get(staff.id) || legacySlipBreakdown(staff, month);
    const base = b.baseSalary;
    const allowances = b.allowances + b.bonus;
    const deductions = b.deductions;
    const net = b.netPayable;
    const paid = b.totalPaid;
    const due = b.outstanding;
    const status = b.isPaid ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

    sumBase += base;
    sumAllowances += allowances;
    sumDeductions += deductions;
    sumNet += net;
    sumPaid += paid;
    sumDue += due;

    return [
      (index + 1).toString(),
      staff.id,
      staff.name,
      staff.role,
      staff.department,
      `Rs. ${base.toLocaleString()}`,
      `Rs. ${allowances.toLocaleString()}`,
      `Rs. ${deductions.toLocaleString()}`,
      `Rs. ${net.toLocaleString()}`,
      status.toUpperCase(),
      `Rs. ${paid.toLocaleString()}`,
      `Rs. ${due.toLocaleString()}`,
      b.paymentMethod || staff.paymentMethod || '—'
    ];
  });

  // KPI Summary Strip on PDF
  const kpiY = 32;
  const kpiWidth = (pageWidth - margin * 2 - 12) / 4;
  const kpiHeight = 13;

  // Box 1: Total Staff
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL EMPLOYEES', margin + 4, kpiY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${staffList.length} Staff Members`, margin + 4, kpiY + 10);

  // Box 2: Total Net Payroll
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(margin + kpiWidth + 4, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(99, 102, 241);
  doc.text('TOTAL MONTHLY PAYROLL (SUM)', margin + kpiWidth + 8, kpiY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 27, 75);
  doc.text(`Rs. ${sumNet.toLocaleString()}`, margin + kpiWidth + 8, kpiY + 10);

  // Box 3: Total Paid
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(margin + (kpiWidth + 4) * 2, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('WHOLE STAFF SUM PAID', margin + (kpiWidth + 4) * 2 + 4, kpiY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(6, 78, 59);
  doc.text(`Rs. ${sumPaid.toLocaleString()}`, margin + (kpiWidth + 4) * 2 + 4, kpiY + 10);

  // Box 4: Total Due / Pending
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(margin + (kpiWidth + 4) * 3, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(220, 38, 38);
  doc.text('WHOLE STAFF SUM DUE / PENDING', margin + (kpiWidth + 4) * 3 + 4, kpiY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(153, 27, 27);
  doc.text(`Rs. ${sumDue.toLocaleString()}`, margin + (kpiWidth + 4) * 3 + 4, kpiY + 10);

  // AutoTable
  autoTable(doc, {
    startY: 48,
    margin: { left: margin, right: margin, bottom: 25 },
    theme: 'grid',
    head: [[
      '#',
      'ID',
      'Employee Name',
      'Role',
      'Department',
      'Base Salary',
      'Allowances',
      'Deductions',
      'Net Pay',
      'Status',
      'Paid',
      'Due',
      'Payment Mode'
    ]],
    body: tableRows,
    foot: [[
      '',
      '',
      'WHOLE STAFF SUM TOTAL',
      '',
      `${staffList.length} Staff`,
      `Rs. ${sumBase.toLocaleString()}`,
      `Rs. ${sumAllowances.toLocaleString()}`,
      `Rs. ${sumDeductions.toLocaleString()}`,
      `Rs. ${sumNet.toLocaleString()}`,
      '',
      `Rs. ${sumPaid.toLocaleString()}`,
      `Rs. ${sumDue.toLocaleString()}`,
      ''
    ]],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    footStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 16, fontStyle: 'bold' },
      2: { cellWidth: 38 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 23, halign: 'right', fontStyle: 'bold' },
      9: { cellWidth: 18, halign: 'center' },
      10: { cellWidth: 22, halign: 'right' },
      11: { cellWidth: 22, halign: 'right' },
      12: { cellWidth: 24 }
    }
  });

  // Signatures on last page
  const finalY = (doc as any).lastAutoTable?.finalY || 160;
  const signY = Math.min(finalY + 12, pageHeight - 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${new Date().toLocaleDateString()} — Verified and reconciled against official institutional payroll accounts.`, margin, signY);

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);

  doc.line(pageWidth - margin - 110, signY + 8, pageWidth - margin - 65, signY + 8);
  doc.line(pageWidth - margin - 50, signY + 8, pageWidth - margin, signY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Accounts Incharge', pageWidth - margin - 87, signY + 12, { align: 'center' });
  doc.text('Principal / Admin', pageWidth - margin - 25, signY + 12, { align: 'center' });

  const fileName = `Entire_Staff_Overall_Payment_${month.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
  return doc;
}

// Generates Individual Overall Monthly Payment Payslips PDF (Single staff or Combined with Monthly Summary)
export function generateMonthlyIndividualSlipsCombinedPdf(
  staffList: StaffMember[],
  month: string,
  selectedStaffId?: string,
  school: SchoolInfo = DEFAULT_SCHOOL,
  breakdowns?: Map<string, SalarySlipBreakdown>
) {
  const targetList = selectedStaffId 
    ? staffList.filter(s => s.id === selectedStaffId)
    : staffList;

  if (targetList.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;

  // The summary page below is shared by all templates and is hardcoded in
  // the emerald/slate palette. Minimal Professional: strict-grayscale
  // stand-ins so the whole combined PDF stays black & white. For the other
  // templates these constants hold the exact original values — unchanged.
  const isMP = getSalarySlipTheme().template === 'minimal-professional';
  const sumSchoolColor: RgbColor = isMP ? [0, 0, 0] : [255, 255, 255];
  const sumSubColor: RgbColor = isMP ? [110, 110, 110] : [148, 163, 184];
  const sumTitleColor: RgbColor = isMP ? [0, 0, 0] : [52, 211, 153];
  const kpiLabel1: RgbColor = isMP ? [110, 110, 110] : [100, 116, 139];
  const kpiValue1: RgbColor = isMP ? [0, 0, 0] : [15, 23, 42];
  const kpiLabel2: RgbColor = isMP ? [110, 110, 110] : [5, 150, 105];
  const kpiValue2: RgbColor = isMP ? [0, 0, 0] : [6, 78, 59];
  const kpiLabel3: RgbColor = isMP ? [110, 110, 110] : [220, 38, 38];
  const kpiValue3: RgbColor = isMP ? [0, 0, 0] : [153, 27, 27];
  const sumHeadFill: RgbColor = isMP ? [0, 0, 0] : [15, 23, 42];
  const sumFootFill: RgbColor = isMP ? [0, 0, 0] : [30, 41, 59];

  // If multiple staff selected, first page is the Monthly Summary & Ledger
  if (!selectedStaffId && staffList.length > 1) {
    // Header Banner (Minimal Professional: bordered black & white header,
    // no filled banner or accent stripe)
    if (isMP) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(margin, 4, pageWidth - margin * 2, 20);
    } else {
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 26, 'F');
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.rect(0, 25, pageWidth, 1.2, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...sumSchoolColor);
    doc.text(school.name.toUpperCase(), pageWidth / 2, 9, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...sumSubColor);
    doc.text(`${school.campus} • ${school.address} • Session: ${school.session}`, pageWidth / 2, 14.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...sumTitleColor);
    doc.text(`MONTHLY INDIVIDUAL PAYROLL LEDGER & SUM OF TOTALS — ${month.toUpperCase()}`, pageWidth / 2, 21.5, { align: 'center' });

    // Summary calculation
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalPaid = 0;
    let totalDue = 0;

    const rows = staffList.map((s, idx) => {
      // Real payroll figures when supplied; honest legacy fallback otherwise
      // (base salary, zero adjustments — no invented 10% / 5% / half-paid).
      const b = breakdowns?.get(s.id) || legacySlipBreakdown(s, month);
      const base = b.baseSalary;
      const allow = b.allowances + b.bonus;
      const ded = b.deductions;
      const net = b.netPayable;
      const paid = b.totalPaid;
      const due = b.outstanding;
      const status = b.isPaid ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

      totalGross += (base + allow);
      totalDeductions += ded;
      totalNet += net;
      totalPaid += paid;
      totalDue += due;

      return [
        (idx + 1).toString(),
        s.id,
        s.name,
        s.role,
        `Rs. ${base.toLocaleString()}`,
        `Rs. ${ded.toLocaleString()}`,
        `Rs. ${net.toLocaleString()}`,
        status.toUpperCase(),
        `Rs. ${paid.toLocaleString()}`,
        `Rs. ${due.toLocaleString()}`
      ];
    });

    // KPI Summary Cards
    const kWidth = (pageWidth - margin * 2 - 8) / 3;
    if (isMP) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, 30, kWidth, 14, 1.5, 1.5, 'S');
    } else {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, 30, kWidth, 14, 1.5, 1.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...kpiLabel1);
    doc.text('TOTAL NET SALARY (SUM)', margin + 4, 34.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...kpiValue1);
    doc.text(`Rs. ${totalNet.toLocaleString()}`, margin + 4, 40.5);

    if (isMP) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + kWidth + 4, 30, kWidth, 14, 1.5, 1.5, 'S');
    } else {
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(margin + kWidth + 4, 30, kWidth, 14, 1.5, 1.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...kpiLabel2);
    doc.text('TOTAL PAID (SUM)', margin + kWidth + 8, 34.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...kpiValue2);
    doc.text(`Rs. ${totalPaid.toLocaleString()}`, margin + kWidth + 8, 40.5);

    if (isMP) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + (kWidth + 4) * 2, 30, kWidth, 14, 1.5, 1.5, 'S');
    } else {
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(margin + (kWidth + 4) * 2, 30, kWidth, 14, 1.5, 1.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...kpiLabel3);
    doc.text('TOTAL BALANCE DUE (SUM)', margin + (kWidth + 4) * 2 + 4, 34.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...kpiValue3);
    doc.text(`Rs. ${totalDue.toLocaleString()}`, margin + (kWidth + 4) * 2 + 4, 40.5);

    autoTable(doc, {
      startY: 48,
      margin: { left: margin, right: margin, bottom: 20 },
      theme: 'grid',
      head: [['#', 'Emp ID', 'Staff Name', 'Role', 'Base Pay', 'Deduct.', 'Net Pay', 'Status', 'Paid', 'Due']],
      body: rows,
      foot: [[
        '',
        '',
        'SUM OF TOTALS',
        `${staffList.length} Staff`,
        '',
        `Rs. ${totalDeductions.toLocaleString()}`,
        `Rs. ${totalNet.toLocaleString()}`,
        '',
        `Rs. ${totalPaid.toLocaleString()}`,
        `Rs. ${totalDue.toLocaleString()}`
      ]],
      headStyles: {
        fillColor: sumHeadFill,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },
      footStyles: {
        fillColor: sumFootFill,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },
      styles: {
        fontSize: 7,
        cellPadding: 2
      }
    });

    // Add subsequent pages for individual slips
    targetList.forEach((staff) => {
      doc.addPage('a4', 'portrait');
      renderSinglePayslipSheet(doc, staff, month, school, pageWidth, margin, breakdowns?.get(staff.id));
    });
  } else {
    // Single or individual selected
    targetList.forEach((staff, index) => {
      if (index > 0) {
        doc.addPage('a4', 'portrait');
      }
      renderSinglePayslipSheet(doc, staff, month, school, pageWidth, margin, breakdowns?.get(staff.id));
    });
  }

  const fileName = selectedStaffId 
    ? `${targetList[0].id}_${targetList[0].name.replace(/\s+/g, '_')}_Payslip_${month.replace(/\s+/g, '_')}.pdf`
    : `Individual_Monthly_Payslips_${month.replace(/\s+/g, '_')}_(${targetList.length}).pdf`;

  doc.save(fileName);
  return doc;
}

// Helper to render an individual payslip on the current page of doc.
// `breakdown` carries the REAL figures from the payroll record + payments
// for payroll-covered months; without it the honest legacy fallback applies
// (base salary, zero adjustments).
function renderSinglePayslipSheet(
  doc: jsPDF,
  staff: StaffMember,
  month: string,
  school: SchoolInfo,
  pageWidth: number,
  margin: number,
  breakdown?: SalarySlipBreakdown
) {
  const settings = getSchoolSettings();
  // Shared salary-slip theme (Fix P1-2) — this renderer is where the
  // per-template values originally came from; it now reads them from the
  // same theme object the single-slip generator and previews consume.
  const theme = getSalarySlipTheme(settings.staffSalarySlipTemplate);
  const isMinimalClassic = theme.isMinimalClassic;

  // Minimal Professional: strict-grayscale stand-ins for the hardcoded slate
  // palette used in the body below. For the other two templates these
  // constants hold the exact original values — their output is unchanged.
  const isMP = theme.template === 'minimal-professional';
  const labelColor: RgbColor = isMP ? [85, 85, 85] : [71, 85, 105];
  const valueColor: RgbColor = isMP ? [0, 0, 0] : [15, 23, 42];
  const mutedColor: RgbColor = isMP ? [110, 110, 110] : [100, 116, 139];
  const faintColor: RgbColor = isMP ? [160, 160, 160] : [148, 163, 184];
  const b = breakdown || legacySlipBreakdown(staff, month);
  const base = b.baseSalary;
  const allowances = b.allowances;
  const bonus = b.bonus;
  const deductions = b.deductions;
  const net = b.netPayable;
  const isPaid = b.isPaid;
  const monthYear = (month.split(' ')[1] || String(new Date().getFullYear()));
  const refNo = b.referenceNo || `SLP-${staff.id}-${month.substring(0, 3).toUpperCase()}-${monthYear}`;

  if (isMinimalClassic) {
    doc.setDrawColor(...theme.headerTitleColor);
    doc.setLineWidth(0.5);
    doc.rect(margin, 10, pageWidth - margin * 2, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...theme.headerSchoolColor);
    doc.text(school.name.toUpperCase(), pageWidth / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...theme.headerSubColor);
    doc.text(`${school.campus} • ${school.address} • Ph: ${school.phone}`, pageWidth / 2, 23, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...theme.headerTitleColor);
    doc.text(`${theme.headerTitle} — ${month.toUpperCase()}`, pageWidth / 2, 29, { align: 'center' });
  } else {
    // Header Banner
    doc.setFillColor(...(theme.headerBannerFill as RgbColor));
    doc.rect(0, 0, pageWidth, 30, 'F');

    // Emerald accent stripe
    if (theme.headerAccentStripe) {
      doc.setFillColor(...theme.headerAccentStripe);
      doc.rect(0, 29, pageWidth, 1.5, 'F');
    }

    // School Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...theme.headerSchoolColor);
    doc.text(school.name.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...theme.headerSubColor);
    doc.text(`${school.campus} • ${school.address} • Ph: ${school.phone}`, pageWidth / 2, 16, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...theme.headerTitleColor);
    doc.text(`${theme.headerTitle} — ${month.toUpperCase()}`, pageWidth / 2, 23.5, { align: 'center' });
  }

  // Employee Information Box (Minimal Professional: no fill at all — the
  // stroked outline drawn right after carries the box)
  if (!isMP) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, 36, pageWidth - margin * 2, 32, 2, 2, 'F');
  }
  doc.setDrawColor(...theme.infoBoxBorder);
  doc.roundedRect(margin, 36, pageWidth - margin * 2, 32, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...labelColor);

  // Column 1
  doc.text('Employee ID:', margin + 5, 43);
  doc.text('Employee Name:', margin + 5, 49);
  doc.text('Father / Guardian:', margin + 5, 55);
  doc.text('Designation / Role:', margin + 5, 61);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...valueColor);
  doc.text(staff.id, margin + 42, 43);
  doc.text(staff.name, margin + 42, 49);
  doc.text(staff.fatherName || '-', margin + 42, 55);
  doc.text(staff.role, margin + 42, 61);

  // Column 2
  const col2X = margin + 95;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...labelColor);
  doc.text('Department:', col2X, 43);
  doc.text('Slip Reference No:', col2X, 49);
  doc.text('Disbursement Date:', col2X, 55);
  doc.text('Payment Status:', col2X, 61);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...valueColor);
  doc.text(staff.department, col2X + 36, 43);
  doc.text(refNo, col2X + 36, 49);
  doc.text(b.lastPaidDate || '—', col2X + 36, 55);

  const statusText = isPaid ? 'PAID (CONFIRMED)' : b.totalPaid > 0 ? 'PARTIALLY PAID' : 'PENDING / DUE';
  doc.setFont('helvetica', 'bold');
  if (isPaid) {
    doc.setTextColor(...theme.statusPaidColor);
    doc.text(statusText, col2X + 36, 61);
  } else if (theme.template === 'minimal-professional') {
    // Strict black & white: no red pending status for this template. The
    // other two templates keep the red below, unchanged.
    doc.setTextColor(0, 0, 0);
    doc.text(statusText, col2X + 36, 61);
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text(statusText, col2X + 36, 61);
  }

  // Earnings & Deductions Table
  const tableData = [
    ['Basic Monthly Salary', `Rs. ${base.toLocaleString()}`, 'Deductions', `Rs. ${deductions.toLocaleString()}`],
    ['Allowances (Medical & Transport)', `Rs. ${allowances.toLocaleString()}`, '', ''],
    ['Special Performance Bonus', `Rs. ${bonus.toLocaleString()}`, '', ''],
    [
      { content: 'Gross Monthly Earnings', styles: { fontStyle: 'bold' } },
      { content: `Rs. ${(base + allowances + bonus).toLocaleString()}`, styles: { fontStyle: 'bold' } },
      { content: 'Total Deductions', styles: { fontStyle: 'bold' } },
      { content: `Rs. ${deductions.toLocaleString()}`, styles: { fontStyle: 'bold' } }
    ]
  ];

  autoTable(doc, {
    startY: 74,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Earnings & Allowances', 'Amount', 'Deductions', 'Amount']],
    headStyles: {
      fillColor: theme.tableHeadFill,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    body: tableData as any,
    styles: {
      fontSize: 8,
      cellPadding: 3
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;

  // Amount Paid Highlight Box (net payable / outstanding are context below)
  if (isMinimalClassic) {
    doc.setFillColor(...theme.netBoxFill);
    doc.setDrawColor(...(theme.netBoxBorder as RgbColor));
    doc.setLineWidth(0.5);
    doc.rect(margin, finalY + 5, pageWidth - margin * 2, 14, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...theme.netTextColor);
    doc.text('AMOUNT PAID:', margin + 6, finalY + 14);
    doc.setFontSize(13);
    doc.text(`Rs. ${b.totalPaid.toLocaleString()}`, pageWidth - margin - 6, finalY + 14, { align: 'right' });
  } else {
    doc.setFillColor(...theme.netBoxFill);
    doc.roundedRect(margin, finalY + 5, pageWidth - margin * 2, 14, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...theme.netTextColor);
    doc.text('AMOUNT PAID:', margin + 6, finalY + 14);

    doc.setFontSize(13);
    doc.text(`Rs. ${b.totalPaid.toLocaleString()}`, pageWidth - margin - 6, finalY + 14, { align: 'right' });
  }

  // Bank Account & Notes — the highlight box above foregrounds the AMOUNT
  // PAID; net payable and the outstanding balance stay visible here as
  // clearly labeled context figures.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text(`Net Salary Payable: Rs. ${net.toLocaleString()} · Outstanding Balance: Rs. ${b.outstanding.toLocaleString()} (salary for ${month}).`, margin, finalY + 27);
  doc.text(`Disbursed to Employee via ${b.paymentMethod || staff.paymentMethod || '—'}. Account: ${staff.bankAccount || 'Verified On File'}`, margin, finalY + 32);

  // Signatures
  const signY = finalY + 52;
  doc.setDrawColor(...faintColor);
  doc.setLineWidth(0.4);
  doc.line(margin + 5, signY, margin + 50, signY);
  doc.line(pageWidth - margin - 50, signY, pageWidth - margin - 5, signY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...labelColor);
  doc.text('Accounts Incharge / Bursar', margin + 27, signY + 5, { align: 'center' });
  doc.text('Employee Signature', pageWidth - margin - 27, signY + 5, { align: 'center' });

  // Footer Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...faintColor);
  doc.text('This is an official computer-generated salary slip verified by Schoollee Academic Management System.', pageWidth / 2, signY + 14, { align: 'center' });
}

// Generates the official Payment Summary Receipt PDF matching the reference design
export function generatePaymentSummaryReceiptPdf(
  paidStaffList: StaffMember[],
  month: string,
  year: string,
  monthNumber: string,
  paymentDate: string,
  paymentMethod: string,
  totalSalaryPaid: number,
  school: SchoolInfo = DEFAULT_SCHOOL
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;

  // Header background matching reference design
  doc.setFillColor(16, 22, 34); // #101622
  doc.roundedRect(margin, margin, pageWidth - (margin * 2), 32, 3, 3, 'F');

  // School title & subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(school.name || 'Demo School Schooliee Pakistan', margin + 8, margin + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Salary Slip — ${monthNumber} ${year}`, margin + 8, margin + 18);
  doc.text(`${school.campus} • Tel: ${school.phone}`, margin + 8, margin + 24);

  // Right side badge in header: PAID & Date
  doc.setFillColor(14, 46, 33);
  doc.roundedRect(pageWidth - margin - 35, margin + 8, 27, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(34, 197, 94);
  doc.text('Paid', pageWidth - margin - 21.5, margin + 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(paymentDate, pageWidth - margin - 8, margin + 23, { align: 'right' });

  // 3 Summary Metric Cards
  const cardY = margin + 37;
  const cardWidth = (pageWidth - (margin * 2) - 8) / 3;
  const cardHeight = 18;

  // Box 1: Total Salary Paid
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Salary Paid', margin + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(16, 185, 129);
  doc.text(`${totalSalaryPaid.toLocaleString()} PKR`, margin + 4, cardY + 13);

  // Box 2: Staff Paid
  const card2X = margin + cardWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Staff Paid', card2X + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`${paidStaffList.length}`, card2X + 4, cardY + 13);

  // Box 3: Payment Date
  const card3X = margin + (cardWidth * 2) + 8;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Payment Date', card3X + 4, cardY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(paymentDate, card3X + 4, cardY + 13);

  // Table Data
  const tableData = paidStaffList.map(s => {
    const sal = s.salary || 0;
    return [
      s.id,
      s.name,
      s.role,
      `${sal.toLocaleString()} PKR`,
      `${sal.toLocaleString()} PKR`,
      s.paymentMethod || paymentMethod || 'Cash',
      '—',
      '—'
    ];
  });

  autoTable(doc, {
    startY: cardY + 23,
    head: [['ID', 'Name', 'Role', 'Salary', 'Paid', 'Payment', 'Receipt', 'Note']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [21, 28, 42],
      textColor: [241, 245, 249],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.5
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24, textColor: [22, 101, 52], fontStyle: 'bold' },
      5: { cellWidth: 22 },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 12, halign: 'center' }
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const currentY = (data.cursor ? data.cursor.y : cardY + 30) + 15;
      if (currentY < pageHeight - 30) {
        doc.setDrawColor(203, 213, 225);
        doc.line(margin + 5, currentY + 12, margin + 50, currentY + 12);
        doc.line(pageWidth - margin - 50, currentY + 12, pageWidth - margin - 5, currentY + 12);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Authorized Bursar / Accounts', margin + 27, currentY + 16, { align: 'center' });
        doc.text('Principal / School Incharge', pageWidth - margin - 27, currentY + 16, { align: 'center' });

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('Official Disbursement Record • Schoollee Academic Management System', pageWidth / 2, currentY + 23, { align: 'center' });
      }
    }
  });

  doc.save(`Payment_Summary_Receipt_${monthNumber}_${year}.pdf`);
}
