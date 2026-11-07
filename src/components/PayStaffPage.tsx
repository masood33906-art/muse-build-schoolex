import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  ChevronDown, 
  ArrowLeft, 
  Check, 
  CheckCircle2, 
  FileText, 
  Clock,
  AlertCircle,
  Layers,
  X,
  Banknote
} from 'lucide-react';
import { StaffMember, normalizeMethod } from '../types';
import { PaymentSummaryData } from './PaymentSummaryPage';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { 
  getStaffSalaryAccrualInfo, 
  formatShortMonthYear, 
  StaffSalaryAccrualInfo 
} from '../utils/salaryAccrualHelper';
import { disburseSalary, owedMonthsOf } from '../utils/payrollService';
import { getSchoolSettings } from '../utils/settingsHelper';
import { localISODate } from '../utils/dates';

interface PayStaffPageProps {
  staffList: StaffMember[];
  onUpdateStaff: (updatedStaff: StaffMember[]) => void;
  onBackToStaff: () => void;
  onNavigateOverview?: () => void;
  month: string;
  year: string;
  onOpenSalarySlips?: (mode: 'overall' | 'individual', staff?: StaffMember) => void;
  onNavigateToPaymentSummary?: (data: PaymentSummaryData) => void;
  initialSelectedStaffId?: string | null;
  onClearInitialSelectedStaff?: () => void;
}

const MONTH_NUMBER_MAP: Record<string, string> = {
  'January': '01',
  'February': '02',
  'March': '03',
  'April': '04',
  'May': '05',
  'June': '06',
  'July': '07',
  'August': '08',
  'September': '09',
  'October': '10',
  'November': '11',
  'December': '12'
};

interface StaffPayRowState {
  staffId: string;
  selectedMonths: string[];
  payment: number;
  reason: string;
  loanDeduction: number;
  paidBy: string;
  paidDate: string;
  status: 'Unpaid' | 'Paid' | 'Not Eligible';
}

const ATTENDANCE_MAP: Record<string, { presents: number; leaves: number }> = {
  'T0018': { presents: 2, leaves: 0 },
  'STF-0012': { presents: 0, leaves: 1 },
  'STF-0005': { presents: 1, leaves: 0 },
  'STF-0007': { presents: 1, leaves: 0 },
};

export const PayStaffPage: React.FC<PayStaffPageProps> = ({
  staffList,
  onUpdateStaff,
  onBackToStaff,
  onNavigateOverview,
  month,
  year,
  onOpenSalarySlips,
  onNavigateToPaymentSummary,
  initialSelectedStaffId,
  onClearInitialSelectedStaff
}) => {
  const fullMonthYear = `${month} ${year}`;

  // Compute live salary accrual info for every staff member
  const accrualMap = useMemo(() => {
    const map: Record<string, StaffSalaryAccrualInfo> = {};
    staffList.forEach(s => {
      map[s.id] = getStaffSalaryAccrualInfo(s);
    });
    return map;
  }, [staffList]);

  // Local state for each staff row's editable values & selected owed months
  const [rowStates, setRowStates] = useState<Record<string, StaffPayRowState>>({});

  // Selected staff checkboxes
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());

  // Modal state for per-employee multi-month salary disbursal popup
  const [activeMonthModalStaffId, setActiveMonthModalStaffId] = useState<string | null>(null);

  // Sync rowStates whenever staffList or accrualMap updates
  useEffect(() => {
    setRowStates(prev => {
      const next: Record<string, StaffPayRowState> = {};
      staffList.forEach(s => {
        const accrual = accrualMap[s.id];
        const existing = prev[s.id];
        const owedMonths = accrual?.owedMonths || [];
        const hasCompletedMonth = accrual?.hasCompletedOneFullMonth ?? false;
        const isAllPaid = hasCompletedMonth && accrual.accruedMonths.length > 0 && owedMonths.length === 0;

        // Keep existing selectedMonths if valid subset of current owedMonths, otherwise default to all owedMonths
        let selectedMonths = owedMonths;
        if (existing && existing.selectedMonths.length > 0) {
          const validExisting = existing.selectedMonths.filter(m => owedMonths.includes(m));
          if (validExisting.length > 0) {
            selectedMonths = validExisting;
          }
        }

        const calculatedPayment = selectedMonths.length * (Number(s.salary) || 0);

        const schoolSettings = getSchoolSettings();
        const defaultPaidBy = schoolSettings.principalName || schoolSettings.schoolName || 'Accounts Office';

        next[s.id] = {
          staffId: s.id,
          selectedMonths,
          payment: calculatedPayment,
          reason: existing?.reason || '',
          loanDeduction: existing?.loanDeduction || 0,
          paidBy: isAllPaid ? defaultPaidBy : (existing?.paidBy || '-'),
          paidDate: isAllPaid && s.lastPaidDate ? s.lastPaidDate : (existing?.paidDate || '-'),
          status: !hasCompletedMonth
            ? 'Not Eligible'
            : isAllPaid
            ? 'Paid'
            : 'Unpaid'
        };
      });
      return next;
    });

    // Default select all staff who currently have owedMonths > 0 (or initialSelectedStaffId if provided)
    setSelectedStaffIds(prev => {
      if (initialSelectedStaffId) {
        const targetAccrual = accrualMap[initialSelectedStaffId];
        if (targetAccrual && targetAccrual.owedMonths.length > 0) {
          return new Set([initialSelectedStaffId]);
        }
      }
      const eligibleWithOwed = staffList
        .filter(s => (accrualMap[s.id]?.owedMonths.length || 0) > 0)
        .map(s => s.id);
      if (prev.size === 0 && eligibleWithOwed.length > 0) {
        return new Set(eligibleWithOwed);
      }
      // Remove any staff IDs that no longer owe salary
      const filteredPrev = Array.from(prev).filter(id => (accrualMap[id]?.owedMonths.length || 0) > 0);
      return new Set(filteredPrev);
    });
  }, [staffList, accrualMap, initialSelectedStaffId]);

  useEffect(() => {
    if (initialSelectedStaffId && onClearInitialSelectedStaff) {
      onClearInitialSelectedStaff();
    }
  }, [initialSelectedStaffId, onClearInitialSelectedStaff]);

  // Controls & Filters
  const [showPaid, setShowPaid] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Payment Summary Controls (Right sidebar)
  const [paymentDate, setPaymentDate] = useState<string>(() => localISODate());
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [note, setNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Filter staff according to Show Paid and Search Query
  const filteredStaff = useMemo(() => {
    return staffList.filter(staff => {
      const rowState = rowStates[staff.id];
      const isPaid = rowState ? rowState.status === 'Paid' : owedMonthsOf(staff).length === 0;

      if (!showPaid && isPaid) {
        return false;
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchName = staff.name.toLowerCase().includes(q);
        const matchId = staff.id.toLowerCase().includes(q);
        const matchRole = staff.role.toLowerCase().includes(q);
        return matchName || matchId || matchRole;
      }

      return true;
    }).sort((a, b) => {
      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });
  }, [staffList, rowStates, showPaid, searchQuery, sortAsc]);

  // Payable filtered staff (those who have at least 1 owed month)
  const payableFilteredStaff = useMemo(() => {
    return filteredStaff.filter(s => (accrualMap[s.id]?.owedMonths.length || 0) > 0);
  }, [filteredStaff, accrualMap]);

  const allFilteredSelected = useMemo(() => {
    if (payableFilteredStaff.length === 0) return false;
    return payableFilteredStaff.every(s => selectedStaffIds.has(s.id));
  }, [payableFilteredStaff, selectedStaffIds]);

  const handleToggleSelectAll = () => {
    setSelectedStaffIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        payableFilteredStaff.forEach(s => next.delete(s.id));
      } else {
        payableFilteredStaff.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  const handleToggleStaffSelection = (id: string) => {
    const accrual = accrualMap[id];
    if (!accrual || !accrual.hasCompletedOneFullMonth || accrual.owedMonths.length === 0) {
      return;
    }
    setSelectedStaffIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Ensure at least 1 owed month is selected when checking the staff member
        setRowStates(rPrev => {
          const row = rPrev[id];
          if (row && row.selectedMonths.length === 0 && accrual.owedMonths.length > 0) {
            const staffObj = staffList.find(st => st.id === id);
            return {
              ...rPrev,
              [id]: {
                ...row,
                selectedMonths: [...accrual.owedMonths],
                payment: accrual.owedMonths.length * (Number(staffObj?.salary) || 0)
              }
            };
          }
          return rPrev;
        });
      }
      return next;
    });
  };

  // Toggle a single owed month for a specific staff member
  const handleToggleOwedMonth = (staffId: string, targetMonth: string) => {
    const staffObj = staffList.find(s => s.id === staffId);
    const accrual = accrualMap[staffId];
    if (!staffObj || !accrual) return;

    setRowStates(prev => {
      const current = prev[staffId];
      if (!current) return prev;

      const exists = current.selectedMonths.includes(targetMonth);
      const updatedMonths = exists
        ? current.selectedMonths.filter(m => m !== targetMonth)
        : accrual.owedMonths.filter(m => current.selectedMonths.includes(m) || m === targetMonth);

      const newPayment = updatedMonths.length * (Number(staffObj.salary) || 0);

      // Automatically select/deselect the row checkbox based on whether any month is selected
      setSelectedStaffIds(selPrev => {
        const nextSel = new Set(selPrev);
        if (updatedMonths.length > 0) {
          nextSel.add(staffId);
        } else {
          nextSel.delete(staffId);
        }
        return nextSel;
      });

      return {
        ...prev,
        [staffId]: {
          ...current,
          selectedMonths: updatedMonths,
          payment: newPayment
        }
      };
    });
  };

  // Select All or Clear All owed months for a specific staff member
  const handleSelectAllOwedMonthsForStaff = (staffId: string, selectAll: boolean) => {
    const staffObj = staffList.find(s => s.id === staffId);
    const accrual = accrualMap[staffId];
    if (!staffObj || !accrual) return;

    const updatedMonths = selectAll ? [...accrual.owedMonths] : [];
    const newPayment = updatedMonths.length * (Number(staffObj.salary) || 0);

    setRowStates(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        selectedMonths: updatedMonths,
        payment: newPayment
      }
    }));

    setSelectedStaffIds(selPrev => {
      const nextSel = new Set(selPrev);
      if (selectAll && updatedMonths.length > 0) {
        nextSel.add(staffId);
      } else {
        nextSel.delete(staffId);
      }
      return nextSel;
    });
  };

  // Update a row's payment amount manually if needed
  const handlePaymentChange = (id: string, value: number) => {
    setRowStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        payment: Math.max(0, isNaN(value) ? 0 : value)
      }
    }));
  };

  // Update a row's optional reason
  const handleReasonChange = (id: string, reason: string) => {
    setRowStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        reason
      }
    }));
  };

  // Update loan deduction
  const handleLoanDeductionChange = (id: string, value: number) => {
    setRowStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        loanDeduction: Math.max(0, isNaN(value) ? 0 : value)
      }
    }));
  };

  // Calculations for the right Payment Summary card
  const summary = useMemo(() => {
    let selectedCount = 0;
    let totalSelectedMonthsCount = 0;
    let totalSalarySum = 0;
    let totalLoanDeductions = 0;

    selectedStaffIds.forEach(id => {
      const row = rowStates[id];
      const accrual = accrualMap[id];
      if (row && accrual && row.selectedMonths.length > 0) {
        selectedCount++;
        totalSelectedMonthsCount += row.selectedMonths.length;
        totalSalarySum += row.payment;
        totalLoanDeductions += row.loanDeduction;
      }
    });

    const netPayable = Math.max(0, totalSalarySum - totalLoanDeductions);

    return {
      selectedCount,
      totalSelectedMonthsCount,
      totalSalarySum,
      totalLoanDeductions,
      netPayable
    };
  }, [selectedStaffIds, rowStates, accrualMap]);

  // Execute payment for given staff IDs (either from bulk "Proceed to Pay" or single staff modal "Proceed to Pay")
  const executeSalaryDisbursal = (targetStaffIds: Set<string>) => {
    setValidationWarning(null);

    const validIds = Array.from(targetStaffIds).filter(id => {
      const row = rowStates[id];
      const accrual = accrualMap[id];
      return row && accrual && accrual.hasCompletedOneFullMonth && row.selectedMonths.length > 0 && row.payment > 0;
    });

    if (validIds.length === 0) {
      setValidationWarning('Please select at least one eligible staff member and at least one owed salary month to disburse.');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      const schoolSettings = getSchoolSettings();
      const paidByLabel = schoolSettings.principalName || schoolSettings.schoolName || 'Accounts Office';

      const monthsByStaffId = new Map<string, string[]>();
      const adjustments = new Map<string, { bonus?: number; deduction?: number; loanDeduction?: number; note?: string }>();
      let totalDisbursedAmount = 0;

      validIds.forEach(id => {
        const staff = staffList.find(s => s.id === id);
        const row = rowStates[id];
        if (!staff || !row) return;
        const paidMonthsToRecord = row.selectedMonths || [];
        monthsByStaffId.set(id, paidMonthsToRecord);
        const baseGross = paidMonthsToRecord.length * (Number(staff.salary) || 0);
        const diff = (row.payment || 0) - baseGross;
        const bonus = diff > 0 ? diff : 0;
        const deduction = diff < 0 ? Math.abs(diff) : 0;
        const loanDed = Math.min(staff.loanBalance || 0, row.loanDeduction || 0);
        const netRowAmount = Math.max(0, baseGross + bonus - deduction - loanDed);
        totalDisbursedAmount += netRowAmount;
        adjustments.set(id, {
          bonus,
          deduction,
          loanDeduction: row.loanDeduction || 0,
          note: note || row.reason || undefined
        });
      });

      const updatedStaffList = disburseSalary(staffList, monthsByStaffId, {
        method: normalizeMethod(paymentMethod),
        date: paymentDate,
        paidBy: paidByLabel,
        adjustments
      });

      const newlyPaidStaffMembers: StaffMember[] = updatedStaffList
        .filter(s => validIds.includes(s.id))
        .map(s => {
          const row = rowStates[s.id];
          const netRowAmount = Math.max(0, (row?.payment || 0) - Math.min(s.loanBalance || 0, row?.loanDeduction || 0));
          return {
            ...s,
            salary: netRowAmount
          };
        });

      onUpdateStaff(updatedStaffList);
      setIsProcessing(false);
      setActiveMonthModalStaffId(null);
      setPaymentSuccessMessage(
        `Successfully disbursed salary for ${validIds.length} staff member(s) totaling ${totalDisbursedAmount.toLocaleString()} PKR. System & Overview metrics updated.`
      );

      setSelectedStaffIds(new Set());

      if (onNavigateToPaymentSummary && newlyPaidStaffMembers.length > 0) {
        onNavigateToPaymentSummary({
          month,
          year,
          monthNumber: MONTH_NUMBER_MAP[month] || '09',
          paymentDate,
          paymentMethod,
          note,
          paidStaff: newlyPaidStaffMembers,
          totalSalaryPaid: totalDisbursedAmount,
          staffPaidCount: newlyPaidStaffMembers.length
        });
      }
    }, 350);
  };

  const activeModalStaff = useMemo(() => {
    if (!activeMonthModalStaffId) return null;
    return staffList.find(s => s.id === activeMonthModalStaffId) || null;
  }, [activeMonthModalStaffId, staffList]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 py-5 text-slate-100 animate-in fade-in duration-200">
      {/* ================= PAGE TOP HEADER & BREADCRUMBS ================= */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <span>Pay Staff & Accrual Management</span>
            </h1>

            <BreadcrumbTrail
              items={[
                { label: 'Overview', onClick: onNavigateOverview },
                { label: 'Staff', onClick: onBackToStaff },
                { label: 'Pay Staff' }
              ]}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBackToStaff}
              className="px-3 py-1.5 rounded-lg bg-surface-21 hover:bg-surface-43 border border-edge-24 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Staff Directory</span>
            </button>

            {onOpenSalarySlips && (
              <button
                type="button"
                onClick={() => onOpenSalarySlips('overall')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Salary Slips</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Salary Accrual Policy Information Banner */}
      <div className="mb-5 bg-[#101827] border border-edge-21 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white">Salary Accrual & Payout Policy: </span>
            <span className="text-slate-300">
              Newly added staff members become eligible for salary accrual starting the <strong className="text-emerald-400">following month</strong> relative to their Joining Date, and monthly salary is credited only after completing <strong className="text-emerald-400">at least 1 full month of service</strong>.
            </span>
          </div>
        </div>
      </div>

      {/* Validation Warning Banner */}
      {validationWarning && (
        <div className="mb-5 bg-amber-950/60 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3 text-amber-200 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold">{validationWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationWarning(null)}
            className="text-amber-400 hover:text-white text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Notification Banner */}
      {paymentSuccessMessage && (
        <div className="mb-5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between gap-3 text-emerald-200 text-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">{paymentSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setPaymentSuccessMessage(null)}
            className="text-emerald-400 hover:text-white text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ================= MAIN 2-COLUMN LAYOUT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: PAY STAFF TABLE CARD */}
        <div className="lg:col-span-8 xl:col-span-9 bg-[#0b1019] border border-[#1b2536] rounded-2xl p-5 shadow-2xl">
          {/* Card Header & "Show Paid" switch */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Staff Salary Roll & Owed Months Selection
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select individual or all owed months per staff member to disburse their accrued salary
              </p>
            </div>

            {/* "Show Paid" Toggle Switch */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-300 font-medium">Show Paid / Non-Accrued</span>
              <button
                type="button"
                role="switch"
                aria-checked={showPaid}
                onClick={() => setShowPaid(prev => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showPaid ? 'bg-emerald-600' : 'bg-edge-13'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    showPaid ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-5">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff by name, ID, or role..."
              className="w-full bg-surface-11 border border-edge-17 text-slate-100 placeholder-slate-500 text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-surface-34 rounded-xl">
            <table className="w-full text-left border-collapse min-w-[1040px]">
              <thead className="bg-surface-7 border-b border-[#1b2536] text-[11px] font-semibold text-slate-300">
                <tr>
                  {/* Select All Checkbox */}
                  <th className="py-3 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={handleToggleSelectAll}
                      disabled={payableFilteredStaff.length === 0}
                      className="w-4 h-4 rounded border-[#2c3b52] bg-surface-17 text-emerald-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-600 disabled:opacity-40"
                    />
                  </th>

                  {/* Staff Name with Sort Arrow */}
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => setSortAsc(prev => !prev)}
                      className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer font-bold"
                    >
                      <span>Staff Name & Joining</span>
                      <span>{sortAsc ? '↑' : '↓'}</span>
                    </button>
                  </th>

                  {/* Owed Month(s) Attribute (Select Each or All) */}
                  <th className="py-3 px-3 min-w-[250px]">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Owed Month(s) (Each / All)</span>
                    </div>
                  </th>

                  <th className="py-3 px-2.5">Attendance</th>
                  <th className="py-3 px-3">Payment (PKR)</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Loan</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#151d2c] text-xs">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500 text-xs">
                      No staff records found matching the current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const accrual = accrualMap[staff.id] || getStaffSalaryAccrualInfo(staff);
                    const rowState = rowStates[staff.id] || {
                      staffId: staff.id,
                      selectedMonths: accrual.owedMonths,
                      payment: accrual.totalOwedAmount,
                      reason: '',
                      loanDeduction: 0,
                      paidBy: staff.payStatus === 'Paid' ? 'Admin' : '-',
                      paidDate: staff.lastPaidDate || '-',
                      status: !accrual.hasCompletedOneFullMonth
                        ? 'Not Eligible'
                        : accrual.owedMonths.length === 0
                        ? 'Paid'
                        : 'Unpaid'
                    };

                    const isEligibleAndOwed = accrual.hasCompletedOneFullMonth && accrual.owedMonths.length > 0;
                    const isChecked = selectedStaffIds.has(staff.id) && rowState.selectedMonths.length > 0;
                    const isAllMonthsSelected =
                      accrual.owedMonths.length > 0 &&
                      rowState.selectedMonths.length === accrual.owedMonths.length;
                    const hasLoanBalance = (staff.loanBalance || 0) > 0;
                    const attendance = ATTENDANCE_MAP[staff.id];

                    return (
                      <tr 
                        key={staff.id} 
                        className={`transition-colors hover:bg-surface-11 ${
                          isChecked ? 'bg-surface-10/60' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isEligibleAndOwed}
                            onChange={() => handleToggleStaffSelection(staff.id)}
                            title={
                              !accrual.hasCompletedOneFullMonth
                                ? `Salary accrues starting ${accrual.commencementMonth} after 1 full month of service`
                                : accrual.owedMonths.length === 0
                                ? 'All accrued months are already paid'
                                : 'Select staff member for salary payout'
                            }
                            className="w-4 h-4 rounded border-[#2c3b52] bg-surface-17 text-emerald-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Staff Name & Joining Info */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-100">
                            {staff.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span className="font-mono text-sky-400">{staff.id}</span>
                            <span>•</span>
                            <span>Joined: {staff.joiningDate}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Base: {(staff.salary || 0).toLocaleString()} PKR/mo
                          </div>
                        </td>

                        {/* Owed Month(s) Attribute Cell (Select Each or All Months) */}
                        <td className="py-3 px-3">
                          {!accrual.hasCompletedOneFullMonth ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-950/60 text-blue-300 border border-blue-800/50">
                                <Clock className="w-3 h-3" />
                                <span>Starts {accrual.commencementMonth}</span>
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {accrual.daysOfService}/30 days service (&lt; 1 full month)
                              </div>
                            </div>
                          ) : accrual.owedMonths.length === 0 ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0d261b] text-[#4ade80] border border-[#164e3b]">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>All Accrued Paid ({accrual.paidMonths.length} Mo)</span>
                              </span>
                              {accrual.paidMonths.length > 0 && (
                                <div className="text-[10px] text-slate-400">
                                  Paid: {accrual.paidMonths.map(formatShortMonthYear).join(', ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {/* Top control bar: "All (N)" toggle + "Pay Salary / Select Popup" button */}
                              <div className="flex items-center flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllOwedMonthsForStaff(staff.id, !isAllMonthsSelected)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                    isAllMonthsSelected
                                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                                      : 'bg-[#141d2e] text-slate-300 border-[#263650] hover:border-emerald-500/50'
                                  }`}
                                  title="Select or deselect all owed months for this staff member"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  <span>All ({accrual.owedMonths.length})</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setActiveMonthModalStaffId(staff.id)}
                                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Open popup to select one or multiple owed months and disburse salary"
                                >
                                  <Layers className="w-2.5 h-2.5" />
                                  <span>Pay Salary Popup</span>
                                </button>
                              </div>

                              {/* Individual Owed Month Pills (Click each month to toggle) */}
                              <div className="flex items-center flex-wrap gap-1">
                                {accrual.owedMonths.map(m => {
                                  const isMonthSelected = rowState.selectedMonths.includes(m);
                                  return (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => handleToggleOwedMonth(staff.id, m)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-all cursor-pointer ${
                                        isMonthSelected
                                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                          : 'bg-[#111826] text-slate-500 border-[#1e2a3e] hover:text-slate-300'
                                      }`}
                                      title={`Toggle ${m} (${(staff.salary || 0).toLocaleString()} PKR)`}
                                    >
                                      {isMonthSelected ? '✓ ' : ''}{formatShortMonthYear(m)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Attendance */}
                        <td className="py-3 px-2.5">
                          {attendance ? (
                            <div className="inline-flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0c261b] text-[#34d399] border border-[#144f38]">
                                {attendance.presents}P
                              </span>
                              {attendance.leaves > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#291e0e] text-[#fbbf24] border border-[#523c1c]">
                                  {attendance.leaves}L
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 font-medium">-</span>
                          )}
                        </td>

                        {/* Payment Input */}
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            disabled={!isEligibleAndOwed}
                            value={rowState.payment}
                            onChange={(e) => handlePaymentChange(staff.id, parseInt(e.target.value, 10))}
                            className="w-28 bg-surface-11 border border-edge-19 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                          {isEligibleAndOwed && (
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              {rowState.selectedMonths.length} of {accrual.owedMonths.length} mo selected
                            </div>
                          )}
                        </td>

                        {/* Reason (Optional) Input */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            disabled={!isEligibleAndOwed}
                            value={rowState.reason}
                            onChange={(e) => handleReasonChange(staff.id, e.target.value)}
                            placeholder="Reason (Optional)"
                            className="w-28 sm:w-32 bg-surface-11 border border-edge-19 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>

                        {/* Loan */}
                        <td className="py-3 px-3">
                          {hasLoanBalance ? (
                            <div>
                              <input
                                type="number"
                                disabled={!isEligibleAndOwed}
                                value={rowState.loanDeduction || ''}
                                onChange={(e) => handleLoanDeductionChange(staff.id, parseInt(e.target.value, 10))}
                                placeholder="0"
                                className="w-24 bg-surface-11 border border-edge-19 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-slate-400 disabled:opacity-40"
                              />
                              <div className="text-[10px] text-slate-400 mt-1 font-medium whitespace-nowrap">
                                Balance: {staff.loanBalance?.toLocaleString()} PKR
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-xs">
                              0 PKR
                            </span>
                          )}
                        </td>

                        {/* Role */}
                        <td className="py-3 px-3">
                          <span className="text-slate-300 text-xs font-medium">
                            {staff.role === 'OtherStaff' || staff.role === 'otherStaff' ? '-' : staff.role}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center">
                          {!accrual.hasCompletedOneFullMonth ? (
                            <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap bg-blue-950/60 text-blue-300 border border-blue-800/50">
                              Not Accrued
                            </span>
                          ) : accrual.owedMonths.length === 0 ? (
                            <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap bg-[#0d261b] text-[#4ade80] border border-[#164e3b]">
                              Paid
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap bg-[#291e0e] text-[#fbbf24] border border-[#523c1c]">
                              Owed ({accrual.owedMonths.length} Mo)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: PAYMENT SUMMARY CARD */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-[#0b1019] border border-[#1b2536] rounded-2xl p-5 shadow-2xl space-y-4 sticky top-5">
            <h3 className="text-base font-bold text-white tracking-tight">
              Payment Summary
            </h3>

            {/* Selected Staff Count */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400">Selected Staff</span>
              <span className="font-semibold text-white font-mono text-sm">
                {summary.selectedCount}
              </span>
            </div>

            {/* Selected Owed Months Count */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Selected Owed Months</span>
              <span className="font-semibold text-emerald-400 font-mono text-sm">
                {summary.totalSelectedMonthsCount} Month(s)
              </span>
            </div>

            {/* Total Salary */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Accrued Selected</span>
              <span className="font-semibold text-white font-mono text-sm">
                {summary.totalSalarySum.toLocaleString()} PKR
              </span>
            </div>

            {/* Loan Deductions */}
            {summary.totalLoanDeductions > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Loan Deductions</span>
                <span className="font-semibold text-rose-400 font-mono text-sm">
                  -{summary.totalLoanDeductions.toLocaleString()} PKR
                </span>
              </div>
            )}

            <div className="border-t border-[#1a2537]" />

            {/* Net Payable */}
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-white">Net Payable</span>
              <span className="text-emerald-400 font-mono text-base">
                {summary.netPayable.toLocaleString()} PKR
              </span>
            </div>

            {/* Payment Date Input */}
            <div className="pt-2">
              <div className="relative">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Payment Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-surface-11 border border-edge-17 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-slate-400 cursor-pointer"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Payment Method Select Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Payment Method
              </label>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-surface-11 border border-edge-17 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 pr-8 appearance-none focus:outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="Cash" className="bg-surface-11">Cash</option>
                  <option value="Bank Transfer" className="bg-surface-11">Bank Transfer</option>
                  <option value="Cheque" className="bg-surface-11">Cheque</option>
                  <option value="EasyPaisa" className="bg-surface-11">EasyPaisa</option>
                  <option value="JazzCash" className="bg-surface-11">JazzCash</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Note (Optional) */}
            <div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (Optional)"
                className="w-full bg-surface-11 border border-edge-17 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-slate-400"
              />
            </div>

            <div className="text-center text-[11px] text-[#fbbf24] font-medium pt-1">
              Disbursing {summary.totalSelectedMonthsCount} selected month(s) for {summary.selectedCount} staff member(s)
            </div>

            {/* Proceed to Pay Button */}
            <button
              type="button"
              disabled={isProcessing || summary.selectedCount === 0}
              onClick={() => executeSalaryDisbursal(selectedStaffIds)}
              className={`w-full py-3 rounded-xl font-bold text-xs tracking-wide transition-all shadow-md cursor-pointer ${
                summary.selectedCount > 0 && !isProcessing
                  ? 'bg-white hover:bg-slate-100 text-slate-950 active:scale-[0.99]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              id="btn-execute-pay-staff"
            >
              {isProcessing
                ? 'Processing Payroll...'
                : `Proceed to Pay (${summary.netPayable.toLocaleString()} PKR)`}
            </button>
          </div>
        </div>
      </div>

      {/* ================= SINGLE STAFF MULTI-MONTH SALARY DISBURSAL POPUP ================= */}
      {activeModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          {(() => {
            const modalAccrual = accrualMap[activeModalStaff.id] || getStaffSalaryAccrualInfo(activeModalStaff);
            const modalRow = rowStates[activeModalStaff.id];
            const selectedMonths = modalRow?.selectedMonths || [];
            const isAllSelected =
              modalAccrual.owedMonths.length > 0 &&
              selectedMonths.length === modalAccrual.owedMonths.length;
            const netSinglePayable = Math.max(0, (modalRow?.payment || 0) - (modalRow?.loanDeduction || 0));

            return (
              <div className="bg-[#111827] border border-edge-34 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100">
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-[#1f2d42] flex items-center justify-between bg-[#151f32]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Salary Disbursal — {activeModalStaff.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {activeModalStaff.id} • Joined {activeModalStaff.joiningDate} • Base: {(activeModalStaff.salary || 0).toLocaleString()} PKR/mo
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMonthModalStaffId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 space-y-4 text-xs">
                  {/* Accrual Summary Info */}
                  <div className="p-3.5 rounded-xl bg-[#0d1320] border border-[#1d2a40] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Salary Cycle Commencement:</span>
                      <span className="font-bold text-emerald-400">{modalAccrual.commencementMonth}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Service Completed:</span>
                      <span className="font-semibold text-slate-200">
                        {modalAccrual.daysOfService} days ({modalAccrual.hasCompletedOneFullMonth ? '≥ 1 Full Month Eligible' : '< 1 Month Service'})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Outstanding Owed Months:</span>
                      <span className="font-bold text-amber-400">{modalAccrual.owedMonths.length} Month(s)</span>
                    </div>
                  </div>

                  {/* Select One or Multiple Owed Months */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-bold text-slate-200">
                        Select Outstanding Month(s) to Pay:
                      </label>
                      {modalAccrual.owedMonths.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSelectAllOwedMonthsForStaff(activeModalStaff.id, !isAllSelected)}
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer underline"
                        >
                          {isAllSelected ? 'Deselect All' : `Select All (${modalAccrual.owedMonths.length} Months)`}
                        </button>
                      )}
                    </div>

                    {modalAccrual.owedMonths.length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#0d1422] border border-[#1c293d] text-center text-slate-400">
                        {modalAccrual.hasCompletedOneFullMonth
                          ? 'All accrued salary months have already been paid for this employee.'
                          : `Employee has not yet completed 1 full month of service. Salary accrual commences in ${modalAccrual.commencementMonth}.`}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {modalAccrual.owedMonths.map(m => {
                          const checked = selectedMonths.includes(m);
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => handleToggleOwedMonth(activeModalStaff.id, m)}
                              className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                checked
                                  ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-xs'
                                  : 'bg-[#141d2e] border-[#22314a] text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              <div>
                                <div className="font-bold text-xs">{m}</div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {(activeModalStaff.salary || 0).toLocaleString()} PKR
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                                checked ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-600'
                              }`}>
                                {checked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Payout Calculation */}
                  <div className="p-3.5 rounded-xl bg-[#141d2e] border border-[#23334d] flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[11px]">
                        Selected ({selectedMonths.length} Month{selectedMonths.length === 1 ? '' : 's'})
                      </span>
                      <span className="font-bold text-white text-xs">Total Salary to Disburse</span>
                    </div>
                    <span className="text-lg font-extrabold text-emerald-400 font-mono">
                      Rs. {netSinglePayable.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-3.5 border-t border-[#1f2d42] bg-surface-23 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveMonthModalStaffId(null)}
                    className="px-4 py-2 rounded-xl bg-[#1b263b] hover:bg-[#23314b] text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Done Selecting
                  </button>
                  <button
                    type="button"
                    disabled={selectedMonths.length === 0 || isProcessing}
                    onClick={() => executeSalaryDisbursal(new Set([activeModalStaff.id]))}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    Proceed to Pay ({netSinglePayable.toLocaleString()} PKR)
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
