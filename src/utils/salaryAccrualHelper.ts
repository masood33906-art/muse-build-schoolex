import { StaffMember } from '../types';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

export interface StaffSalaryAccrualInfo {
  joiningDateParsed: Date;
  daysOfService: number;
  hasCompletedOneFullMonth: boolean;
  commencementMonth: string; // e.g. 'October 2026'
  commencementDate: Date;
  accruedMonths: string[]; // All months where salary has been generated & credited
  paidMonths: string[]; // Months already paid
  owedMonths: string[]; // Outstanding unpaid accrued months
  totalAccruedAmount: number;
  totalPaidAmount: number;
  totalOwedAmount: number;
  eligibilityMessage: string;
}

/**
 * Safely parses various date formats ('2026-08-15', '23 Apr 2026', '15/08/2026', etc.)
 */
export function parseJoiningDate(dateStr?: string, fallbackDate: Date = new Date()): Date {
  if (!dateStr || !dateStr.trim()) {
    return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate());
  }

  const trimmed = dateStr.trim();

  // Check ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day);
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate());
}

export function formatMonthYear(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShortMonthYear(monthYear: string): string {
  const parts = monthYear.trim().split(/\s+/);
  if (parts.length !== 2) return monthYear;
  const mIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === parts[0].toLowerCase());
  if (mIndex === -1) return monthYear;
  return `${SHORT_MONTH_NAMES[mIndex]} ${parts[1]}`;
}

/**
 * Computes salary accrual and payout eligibility for a staff member according to rules:
 * 1. Salary Cycle Commencement: Newly added staff members become eligible for salary accrual
 *    starting the following month relative to their date of joining.
 * 2. Accrual Condition: A member's monthly salary is only generated and credited to their record
 *    after they have completed at least one full month of service.
 */
export function getStaffSalaryAccrualInfo(
  staff: StaffMember,
  referenceDate: Date = new Date()
): StaffSalaryAccrualInfo {
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const joinDate = parseJoiningDate(staff.joiningDate, ref);

  // Rule 1: Salary Cycle Commencement is the month following the joining month
  const commencementDate = new Date(joinDate.getFullYear(), joinDate.getMonth() + 1, 1);
  const commencementMonth = formatMonthYear(commencementDate);

  // Rule 2: Accrual Condition — must have completed at least one full month of service
  const oneFullMonthServiceDate = new Date(
    joinDate.getFullYear(),
    joinDate.getMonth() + 1,
    joinDate.getDate()
  );
  const diffMs = ref.getTime() - joinDate.getTime();
  const daysOfService = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const hasCompletedOneFullMonth = ref >= oneFullMonthServiceDate || daysOfService >= 30;

  // Build list of accrued months from commencementDate up to current month (ref)
  // Cap historical lookback to 12 months before ref so ancient joining dates remain manageable
  const earliestLookback = new Date(ref.getFullYear(), ref.getMonth() - 11, 1);
  const startMonth = commencementDate > earliestLookback ? commencementDate : earliestLookback;
  const currentMonthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);

  const accruedMonths: string[] = [];

  if (hasCompletedOneFullMonth && startMonth <= currentMonthStart) {
    const cursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
    while (cursor <= currentMonthStart) {
      // Ensure that by the end of `cursor` month (or `ref` if current month), 1 full month of service is met
      const endOfCursorMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const effectiveCheckDate = endOfCursorMonth < ref ? endOfCursorMonth : ref;
      const daysAtMonth = Math.floor((effectiveCheckDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
      if (effectiveCheckDate >= oneFullMonthServiceDate || daysAtMonth >= 30) {
        accruedMonths.push(formatMonthYear(cursor));
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // Determine which months have already been paid
  const paidMonthsSet = new Set<string>(staff.paidMonths || []);

  // Also check transactions for any salary disbursements that recorded month names
  if (staff.transactions && staff.transactions.length > 0) {
    staff.transactions.forEach(tx => {
      if (tx.type === 'Salary' && tx.reason) {
        accruedMonths.forEach(m => {
          if (tx.reason.toLowerCase().includes(m.toLowerCase())) {
            paidMonthsSet.add(m);
          }
        });
      }
    });
  }

  const paidMonths = accruedMonths.filter(m => paidMonthsSet.has(m));
  const owedMonths = staff.status && staff.status !== 'Active'
    ? []
    : accruedMonths.filter(m => !paidMonthsSet.has(m));

  const monthlySalary = Number(staff.salary) || 0;
  const totalAccruedAmount = accruedMonths.length * monthlySalary;
  const totalPaidAmount = paidMonths.length * monthlySalary;
  const totalOwedAmount = owedMonths.length * monthlySalary;

  let eligibilityMessage = '';
  if (!hasCompletedOneFullMonth) {
    const remainingDays = Math.max(1, 30 - daysOfService);
    eligibilityMessage = `Accrual starts ${commencementMonth} (${daysOfService}/30 days completed • ${remainingDays}d left for 1st full month)`;
  } else if (accruedMonths.length === 0) {
    eligibilityMessage = `Eligible starting ${commencementMonth}`;
  } else if (owedMonths.length === 0) {
    eligibilityMessage = `All ${paidMonths.length} accrued month(s) paid`;
  } else {
    eligibilityMessage = `Owed for ${owedMonths.length} month(s): ${owedMonths.map(formatShortMonthYear).join(', ')}`;
  }

  return {
    joiningDateParsed: joinDate,
    daysOfService,
    hasCompletedOneFullMonth,
    commencementMonth,
    commencementDate,
    accruedMonths,
    paidMonths,
    owedMonths,
    totalAccruedAmount,
    totalPaidAmount,
    totalOwedAmount,
    eligibilityMessage
  };
}
