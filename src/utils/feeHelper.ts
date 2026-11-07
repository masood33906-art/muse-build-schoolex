import { Student, PaymentMethod } from '../types';
import { loadAllLedgerItems, type StudentFeeItem } from './studentFeeLedgerHelper';
import { FEE_PAYMENTS_KEY, FeePayment, listPayments, totalsOf, collectionInMonth } from './paymentStore';
import { monthKeyOf, monthLabelFromKey } from './dates';

export interface StudentFeeData {
  studentId: string;
  studentName: string;
  class: string;
  section: string;
  family: string;
  familyId: string;
  phone?: string;
  totalFee: number;
  totalPaid: number;
  remainingDue: number;
  currentMonthCollection: number;
  balance: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  // The source Student record this fee row was derived from, when the caller
  // has it at hand (FeesModule attaches it when building its fee list and when
  // opening the pay flow for a student not yet present in that list). Lets
  // consumers recover the registry record without a second lookup.
  originalStudent?: Student;
}

export interface FamilyFeeSummary {
  familyId: string;
  familyName: string;
  phone: string;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  totalDue: number;
  totalPaid: number;
  currentMonthCollection: number;
  balance: number;
  students: Student[];
}

export interface FeePaymentRecord {
  id: string;
  date: string;
  familyId: string;
  familyName: string;
  studentId?: string;
  studentName?: string;
  amount: number;
  method: PaymentMethod;
  receiptNo: string;
  notes?: string;
}

export const FEES_PAYMENTS_KEY = FEE_PAYMENTS_KEY;
export const FEES_OVERRIDE_KEY = 'schooliee_student_fees_override_clean_v1';

// Format PKR Currency
export function formatPKR(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} PKR`;
}

/**
 * Redesigned canonical helper to strictly determine fee status relative to how payment is paid:
 * - 'Paid': Fully paid (totalPaid >= totalFee and totalFee > 0, remainingDue === 0 and totalPaid > 0)
 * - 'Partially Paid': Some portion paid (totalPaid > 0 and remainingDue > 0 and totalPaid < totalFee)
 * - 'Unpaid': Nothing paid (totalPaid <= 0 and remainingDue > 0)
 */
export function calculateFeeStatus(
  totalFee: number,
  totalPaid: number
): 'Unpaid' | 'Partially Paid' | 'Paid' {
  const safeFee = Math.max(0, Number(totalFee) || 0);
  const safePaid = Math.max(0, Number(totalPaid) || 0);
  const remainingDue = Math.max(0, safeFee - safePaid);

  if (safeFee > 0 && remainingDue === 0 && safePaid >= safeFee) {
    return 'Paid';
  }
  if (safePaid > 0 && remainingDue > 0) {
    return 'Partially Paid';
  }
  if (safePaid === 0 && safeFee > 0) {
    return 'Unpaid';
  }
  if (safeFee === 0 && remainingDue === 0) {
    return safePaid > 0 ? 'Paid' : 'Unpaid';
  }
  return 'Unpaid';
}

export function getStudentFeeDefaults(
  student: Student,
  ledgers: Record<string, StudentFeeItem[]> = loadAllLedgerItems(),
  payments: FeePayment[] = listPayments()
): StudentFeeData {
  const { totalFee, totalPaid, remainingDue, status } = totalsOf(student.id, ledgers);
  const currentMonthCollection = collectionInMonth(payments, monthKeyOf(), new Set([student.id]));
  return {
    studentId: student.id,
    studentName: student.name,
    class: student.class,
    section: student.section,
    family: student.family || '',
    familyId: student.familyId || '',
    phone: student.phone || student.whatsapp || '',
    totalFee,
    totalPaid,
    remainingDue,
    currentMonthCollection,
    balance: 0,
    status,
  };
}

// Group students into family fee summaries
export function buildFamilyFeeSummaries(
  students: Student[],
  payments: FeePayment[] = listPayments()
): {
  families: FamilyFeeSummary[];
  kpi: {
    currentMonth: number;
    totalCollected: number;
    totalDue: number;
    collectionRate: number;
  };
  counts: {
    all: number;
    unpaid: number;
    partiallyPaid: number;
    paid: number;
  };
} {
  const ledgers = loadAllLedgerItems();
  const safePayments = Array.isArray(payments) ? payments : listPayments();
  const currentMonthKey = monthKeyOf();
  const familyMap = new Map<string, {
    familyId: string;
    familyName: string;
    phone: string;
    students: Student[];
    studentFees: StudentFeeData[];
  }>();

  // Helper to normalize id for comparison
  const isMatching = (id1: string, id2: string) => {
    return (id1 || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === (id2 || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  };

  students.forEach(student => {
    const rawFid = student.familyId?.trim() || student.family?.trim() || 'F0000';
    const normKey = student.familyId?.trim() ? student.familyId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : `unassigned:${student.id}`;

    if (!familyMap.has(normKey)) {
      familyMap.set(normKey, {
        familyId: student.familyId || rawFid,
        familyName: student.family || 'Family',
        phone: student.phone || student.whatsapp || '',
        students: [],
        studentFees: []
      });
    }

    const fam = familyMap.get(normKey)!;

    // Check if student already exists in this family by ID only
    if (fam.students.some(s => isMatching(s.id, student.id))) return;

    fam.students.push(student);

    // Compute fee data from single source of truth (ledger + payments)
    const finalData = getStudentFeeDefaults(student, ledgers, safePayments);
    fam.studentFees.push(finalData);
  });

  const families: FamilyFeeSummary[] = [];

  let sumTotalPaid = 0;
  let sumTotalDue = 0;

  familyMap.forEach((entry) => {
    let famTotalFee = 0;
    let famTotalDue = 0;
    let famTotalPaid = 0;
    let famCurrentMonth = 0;

    entry.studentFees.forEach(sf => {
      famTotalFee += sf.totalFee;
      famTotalDue += sf.remainingDue;
      famTotalPaid += sf.totalPaid;
      famCurrentMonth += sf.currentMonthCollection;
    });

    sumTotalPaid += famTotalPaid;
    sumTotalDue += famTotalDue;

    const famStatus = calculateFeeStatus(famTotalFee, famTotalPaid);

    families.push({
      familyId: entry.familyId,
      familyName: entry.familyName,
      phone: entry.phone,
      status: famStatus,
      totalDue: famTotalDue,
      totalPaid: famTotalPaid,
      currentMonthCollection: famCurrentMonth,
      balance: 0,
      students: entry.students
    });
  });

  families.sort((a, b) => a.familyName.localeCompare(b.familyName));

  // Counts for filter tabs
  const unpaidCount = families.filter(f => f.status === 'Unpaid').length;
  const partiallyPaidCount = families.filter(f => f.status === 'Partially Paid').length;
  const paidCount = families.filter(f => f.status === 'Paid').length;

  const totalFeeOverall = sumTotalPaid + sumTotalDue;
  const currentMonthTotal = collectionInMonth(safePayments, currentMonthKey);
  return {
    families,
    kpi: {
      currentMonth: currentMonthTotal,
      totalCollected: sumTotalPaid,
      totalDue: sumTotalDue,
      collectionRate: totalFeeOverall > 0 ? Math.round((sumTotalPaid / totalFeeOverall) * 100) : 0,
    },
    counts: { all: families.length, unpaid: unpaidCount, partiallyPaid: partiallyPaidCount, paid: paidCount },
  };
}

export interface StudentFeeBreakdownLine {
  description: string;
  month: string;
  pendingAmount: number;
  totalAmount?: number;
  paidAmount?: number;
}

export interface StudentFeeBreakdownItem {
  id: string;
  name: string;
  class?: string;
  studentRemainingDue: number;
  lines: StudentFeeBreakdownLine[];
}

/**
 * Builds itemized student fee breakdowns for each student in a family.
 * Evaluates both granular student ledger items (Tuition, Fund, Annual Fund, etc.) and fee overrides.
 */
export function buildStudentBreakdownsForFamily(
  family: FamilyFeeSummary,
  allStudents: Student[]
): StudentFeeBreakdownItem[] {
  const allLedgers = loadAllLedgerItems();
  const famStudents = (family.students && family.students.length > 0)
    ? family.students
    : allStudents.filter(s => (s.familyId || '').trim() === family.familyId.trim() || s.family === family.familyName);

  return famStudents.map(student => {
    const studentLedger = allLedgers[student.id] || [];
    const { remainingDue } = totalsOf(student.id, allLedgers);

    const lines: StudentFeeBreakdownLine[] = studentLedger
      .filter(item => (item.total - item.paidAmount) > 0)
      .map(item => ({
        description: item.reason || item.type || 'Monthly Fee',
        month: item.month || monthLabelFromKey(monthKeyOf()),
        pendingAmount: item.total - item.paidAmount,
        totalAmount: item.total,
        paidAmount: item.paidAmount
      }));

    const calculatedDue = lines.length > 0
      ? lines.reduce((sum, l) => sum + l.pendingAmount, 0)
      : remainingDue;

    return {
      id: student.id,
      name: student.name,
      class: student.class,
      studentRemainingDue: calculatedDue,
      lines
    };
  });
}

/**
 * Generates an individualized personalized fee reminder message for a family or student.
 * Dynamically tailored to the exact entry clicked.
 */
export function generatePersonalizedFeeMessage(options: {
  entryType?: 'family' | 'student';
  studentName?: string;
  studentId?: string;
  studentClass?: string;
  familyName?: string;
  familyId?: string;
  family?: FamilyFeeSummary;
  students?: (Student | { id: string; name: string; class?: string } | string)[];
  totalDue: number;
  breakdowns?: StudentFeeBreakdownItem[];
  dueDate?: string;
}): string {
  const isStudent = options.entryType === 'student';
  const familyName = options.familyName || options.family?.familyName || 'Family';
  const familyId = options.familyId || options.family?.familyId || '';

  // 1. Single Student Entry Mode
  if (isStudent && options.studentName) {
    const sName = options.studentName;
    const sId = options.studentId || '';
    const sClass = options.studentClass ? `Class: ${options.studentClass}` : '';
    const famInfo = familyName ? `Family: ${familyName}${familyId ? ` (${familyId})` : ''}` : '';

    let breakdownLines = `  ▸ Monthly Fee (${monthLabelFromKey(monthKeyOf())}): ${formatPKR(options.totalDue)}`;
    if (options.breakdowns && options.breakdowns.length > 0 && options.breakdowns[0].lines.length > 0) {
      breakdownLines = options.breakdowns[0].lines.map(line => {
        if (line.paidAmount && line.paidAmount > 0 && line.totalAmount) {
          return `  ▸ ${line.description} (${line.month}): ${formatPKR(line.pendingAmount)} _(Fee ${formatPKR(line.totalAmount)}, Paid ${formatPKR(line.paidAmount)})_`;
        }
        return `  ▸ ${line.description} (${line.month}): ${formatPKR(line.pendingAmount)}`;
      }).join('\n');
    }

    const metaParts = [sClass, famInfo].filter(Boolean).join(' | ');

    return `👋 Assalam o Alaikum, Dear Parent of ${sName}${sId ? ` (${sId})` : ''},

📢 This is a friendly reminder regarding the pending fee dues for ${sName}${sId ? ` (${sId})` : ''}.
${metaParts ? `(${metaParts})\n` : ''}
💰 *Total Outstanding: ${formatPKR(options.totalDue)}*

📋 *Breakdown:*
${breakdownLines}

Kindly clear the outstanding dues at your earliest convenience. JazakAllah!`;
  }

  // 2. Family Entry Mode (with all children in this family)
  let studentSalutation = '';
  if (options.students && options.students.length > 0) {
    studentSalutation = options.students.map(s => {
      if (typeof s === 'string') return s;
      return `${s.name} (${s.id}${s.class ? ` - ${s.class}` : ''})`;
    }).join(', ');
  } else {
    studentSalutation = `${familyName} (${familyId})`;
  }

  // Breakdown lines for students in this family who have dues remaining
  let breakdownContent = '';
  if (options.breakdowns && options.breakdowns.length > 0) {
    const studentsWithDues = options.breakdowns.filter(b => b.studentRemainingDue > 0 && b.lines.length > 0);
    if (studentsWithDues.length > 0) {
      breakdownContent = studentsWithDues.map(s => {
        const itemLines = s.lines.map(line => {
          if (line.paidAmount && line.paidAmount > 0 && line.totalAmount) {
            return `  ▸ ${line.description} (${line.month}): ${formatPKR(line.pendingAmount)} _(Fee ${formatPKR(line.totalAmount)}, Paid ${formatPKR(line.paidAmount)})_`;
          }
          return `  ▸ ${line.description} (${line.month}): ${formatPKR(line.pendingAmount)}`;
        }).join('\n');

        return `👤 *${s.name} (${s.id}${s.class ? ` - ${s.class}` : ''}):*\n${itemLines}`;
      }).join('\n\n');
    }
  }

  if (!breakdownContent.trim()) {
    breakdownContent = `👤 *Family: ${familyName} (${familyId}):*\n  ▸ Total Outstanding Fee Due: ${formatPKR(options.totalDue)}`;
  }

  return `👋 Assalam o Alaikum, Dear Family of ${studentSalutation},

📢 This is a friendly reminder regarding your pending fee dues for Family: ${familyName} (${familyId}).

💰 *Total Outstanding: ${formatPKR(options.totalDue)}*

📋 *Breakdown by Student:*

${breakdownContent}

Kindly clear the outstanding dues at your earliest convenience. JazakAllah!`;
}

// Generate pre-filled WhatsApp link
export function createWhatsAppFeeAlertUrl(
  phone: string,
  parentName: string,
  studentNames: string[],
  amountDue: number,
  familyId: string,
  customMessage?: string
): string {
  // Sanitize phone number to international format without spaces/dashes
  let cleanPhone = phone.replace(/[^0-9+]/g, '');
  if (cleanPhone.startsWith('03')) {
    cleanPhone = '92' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('+')) {
    cleanPhone = cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('3')) {
    cleanPhone = '92' + cleanPhone;
  }

  const message = customMessage || `👋 Assalam o Alaikum, Dear Family of ${studentNames.join(', ') || parentName},

📢 This is a friendly reminder regarding your pending fee dues.

💰 *Total Outstanding: ${formatPKR(amountDue)}*

📋 *Breakdown:*

👤 *${studentNames.join(', ') || parentName}:*
  ▸ Remaining Due: ${formatPKR(amountDue)}

Kindly clear the outstanding dues at your earliest convenience. JazakAllah!`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Converts a numeric PKR amount into standard formal written words.
 * E.g. 26500 -> "Twenty Six Thousand Five Hundred Rupees Only"
 */
export function numberToWordsPKR(num: number): string {
  if (!num || num <= 0) return 'Zero Rupees Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
  }

  const result = inWords(Math.round(num)).trim().replace(/\s+/g, ' ');
  return result ? `${result} Rupees Only` : 'Zero Rupees Only';
}

