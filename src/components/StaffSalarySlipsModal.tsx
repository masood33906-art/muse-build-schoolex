import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Download,
  ChevronDown
} from 'lucide-react';
import { StaffMember } from '../types';
import { generateMonthlyIndividualSlipsCombinedPdf, getSalarySlipTheme, SalarySlipBreakdown } from '../utils/staffPdfGenerator';
import { DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import { getSchoolSettings } from '../utils/settingsHelper';
import {
  listPayrollPeriods,
  listPayrollRecords,
  listPayrollPayments,
  buildSlipBreakdown,
  PayrollPeriodSummary,
} from '../utils/payrollApi';
import { monthKeyOf, monthLabelFromKey } from '../utils/dates';

export type SalarySlipModalViewMode = 'overall' | 'individual';

interface StaffSalarySlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  initialMode?: SalarySlipModalViewMode;
  selectedStaffMember?: StaffMember | null;
}

export const StaffSalarySlipsModal: React.FC<StaffSalarySlipsModalProps> = ({
  isOpen,
  onClose,
  staffList,
  selectedStaffMember = null
}) => {
  // The month dropdown is populated from REAL payroll periods (Pay Staff
  // rebuild). Months without a prepared period fall back to the honest
  // legacy figures (base salary, zero adjustments) in preview and print.
  const [periods, setPeriods] = useState<PayrollPeriodSummary[]>([]);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(monthLabelFromKey(monthKeyOf()));
  const [breakdowns, setBreakdowns] = useState<Map<string, SalarySlipBreakdown>>(new Map());

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    listPayrollPeriods()
      .then(ps => {
        if (cancelled) return;
        setPeriods(ps);
        setPeriodsLoaded(true);
        if (ps.length > 0) {
          setSelectedMonth(prev =>
            ps.some(p => p.label === prev) ? prev : ps[ps.length - 1].label
          );
        }
      })
      .catch(() => {
        if (!cancelled) { setPeriods([]); setPeriodsLoaded(true); }
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const selectedPeriod = useMemo(
    () => periods.find(p => p.label === selectedMonth) || null,
    [periods, selectedMonth]
  );

  useEffect(() => {
    if (!isOpen || !selectedPeriod) {
      setBreakdowns(new Map());
      return;
    }
    let cancelled = false;
    Promise.all([
      listPayrollRecords(selectedPeriod.periodKey),
      listPayrollPayments({ periodKey: selectedPeriod.periodKey }),
    ])
      .then(([{ records }, payments]) => {
        if (cancelled) return;
        const map = new Map<string, SalarySlipBreakdown>();
        for (const rec of records) {
          map.set(rec.staffId, buildSlipBreakdown(rec, selectedPeriod.label, payments));
        }
        setBreakdowns(map);
      })
      .catch(() => { if (!cancelled) setBreakdowns(new Map()); });
    return () => { cancelled = true; };
  }, [isOpen, selectedPeriod]);
  // Design comes from the shared salary-slip theme (Fix P1-2) — the same
  // mapping the PDF generators use — so this preview cannot drift from the
  // printed payslip's template interpretation.
  const salarySlipTheme = getSalarySlipTheme(getSchoolSettings().staffSalarySlipTemplate);
  const isMinimalClassic = salarySlipTheme.isMinimalClassic;
  // 'minimal-professional' also resolves isMinimalClassic=true (that flag
  // routes it through every monochrome branch below), so distinguish it via
  // `template` for the places where it is stricter than minimal-classic:
  // no grey fills at all (white instead of neutral-100) and no coloured
  // deduction amounts.
  const isMinimalProfessional = salarySlipTheme.template === 'minimal-professional';

  // List of staff to display in the PDF document preview
  const previewStaffList = useMemo(() => {
    if (selectedStaffMember) {
      return [selectedStaffMember];
    }
    return staffList.length > 0 ? staffList : [];
  }, [selectedStaffMember, staffList]);

  if (!isOpen) return null;

  // "Print and Save pdf" button handler — real payroll figures for
  // payroll-covered months via the breakdown map.
  const handlePrintAndSavePdf = () => {
    const targetId = selectedStaffMember ? selectedStaffMember.id : undefined;
    generateMonthlyIndividualSlipsCombinedPdf(staffList, selectedMonth, targetId, DEFAULT_SCHOOL, breakdowns);
  };

  const monthOptions = useMemo(() => {
    const labels = periods.map(p => p.label).reverse();
    return labels.length > 0 ? labels : [monthLabelFromKey(monthKeyOf())];
  }, [periods]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b1019] border border-edge-14 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= MODAL HEADER: MONTHS DROPDOWN, PRINT & SAVE PDF, CLOSE ================= */}
        <div className="bg-surface-12 border-b border-edge-6 px-5 py-3.5 flex items-center justify-between gap-4">
          {/* Months Dropdown */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-surface-34 border border-edge-31 text-slate-100 text-xs font-semibold rounded-lg px-3.5 py-2 pr-8 appearance-none cursor-pointer hover:border-slate-500 focus:outline-none focus:border-emerald-500 shadow-sm transition-colors"
              id="salary-slip-month-dropdown"
            >
              {monthOptions.map(m => (
                <option key={m} value={m} className="bg-surface-12 text-white">
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Right Action Buttons: Print and Save pdf & Close */}
          <div className="flex items-center gap-3">
            {/* Print and Save pdf button */}
            <button
              type="button"
              onClick={handlePrintAndSavePdf}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer transition-all active:scale-95"
              id="btn-print-save-pdf"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Print and Save pdf</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              title="Close"
              id="btn-close-slip-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= MODAL BODY: PDF PREVIEWS OF THE DOC ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#090d15] space-y-8">
          {periodsLoaded && !selectedPeriod && (
            <div className="max-w-4xl mx-auto text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5">
              No payroll has been prepared for {selectedMonth} yet — this preview shows base salary with no
              adjustments. Prepare the month in Pay Staff to see real payment figures.
            </div>
          )}
          {previewStaffList.map(staff => {
            // Real payroll figures for payroll-covered months; honest
            // legacy fallback (base salary, zero adjustments) otherwise.
            const bd = breakdowns.get(staff.id);
            const base = bd ? bd.baseSalary : (staff.salary || 0);
            const allowances = bd ? bd.allowances : 0;
            const bonus = bd ? bd.bonus : 0;
            const deductions = bd ? bd.deductions : 0;
            const gross = base + allowances + bonus;
            const net = gross - deductions;
            // Actual cash paid is the headline figure; without a payroll
            // breakdown, mirror the honest legacy fallback (paid in full
            // only when the staff record itself says Paid).
            const totalPaid = bd ? bd.totalPaid : (staff.payStatus === 'Paid' ? net : 0);
            const outstanding = bd ? bd.outstanding : (staff.payStatus === 'Paid' ? 0 : net);
            const monthShort = selectedMonth.substring(0, 3).toUpperCase();
            const yearPart = selectedMonth.split(' ')[1] || String(new Date().getFullYear());
            const isPaidSlip = bd ? bd.isPaid : staff.payStatus === 'Paid';
            const slipMethod = bd?.paymentMethod || staff.paymentMethod || 'Bank Transfer';
            const slipDate = bd?.lastPaidDate || staff.lastPaidDate || '—';
            const slipRef = bd?.referenceNo || `SLP-${staff.id}-${monthShort}-${yearPart}`;

            return (
              <div 
                key={staff.id}
                className={`bg-white text-slate-900 shadow-2xl p-6 sm:p-8 max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none ${
                  isMinimalClassic ? 'border-2 border-black rounded-sm' : 'rounded-xl border border-slate-300'
                }`}
              >
                {/* Institutional Header */}
                <div className="border-b-2 border-slate-900 pb-4 mb-5 text-center relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-left">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Official Payslip</span>
                      <div className="text-xs font-mono font-semibold text-slate-700">
                        REF: {slipRef}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        isMinimalProfessional
                          ? 'bg-white text-black border-black'
                          : isMinimalClassic
                            ? 'bg-neutral-100 text-black border-black'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {isPaidSlip ? '✓ DISBURSED / PAID' : bd && bd.totalPaid > 0 ? '◐ PARTIALLY PAID' : '⚠ PENDING PAYMENT'}
                      </span>
                    </div>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">
                    {DEFAULT_SCHOOL.name}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {DEFAULT_SCHOOL.campus} • {DEFAULT_SCHOOL.address} • Phone: {DEFAULT_SCHOOL.phone}
                  </p>
                  <div className={`mt-2 inline-block text-white text-xs font-bold px-4 py-1 uppercase tracking-wider ${
                    isMinimalClassic ? 'bg-black rounded-none' : 'bg-slate-900 rounded-full'
                  }`}>
                    Staff Salary Slip — {selectedMonth}
                  </div>
                </div>

                {/* Employee Details Grid */}
                <div className={`bg-slate-50 p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs ${
                  isMinimalClassic ? 'border border-black' : 'border border-slate-200 rounded-xl'
                }`}>
                  <div>
                    <span className="text-slate-500 block font-medium">Employee ID</span>
                    <strong className="text-slate-900 font-mono text-sm">{staff.id}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Employee Name</span>
                    <strong className="text-slate-900 text-sm">{staff.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Designation / Role</span>
                    <strong className="text-slate-900">{staff.role}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Department</span>
                    <strong className="text-slate-900">{staff.department}</strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block font-medium">Father / Guardian</span>
                    <span className="text-slate-800">{staff.fatherName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">CNIC Number</span>
                    <span className="text-slate-800 font-mono">{staff.cnic || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Payment Mode</span>
                    <span className="text-slate-800">{slipMethod}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Disbursement Date</span>
                    <span className="text-slate-800">{slipDate}</span>
                  </div>
                </div>

                {/* Earnings & Deductions Table */}
                <div className={`overflow-hidden mb-5 ${
                  isMinimalClassic ? 'border border-black' : 'border border-slate-300 rounded-xl'
                }`}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className={`${isMinimalClassic ? 'bg-black' : 'bg-slate-900'} text-white font-bold`}>
                      <tr>
                        <th className="py-2.5 px-4 w-1/2">Earnings & Allowances</th>
                        <th className="py-2.5 px-4 text-right w-1/4">Amount</th>
                        <th className="py-2.5 px-4 w-1/2 border-l border-slate-700">Deductions</th>
                        <th className="py-2.5 px-4 text-right w-1/4">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2 px-4 text-slate-700">Basic Monthly Salary</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                          Rs. {base.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-slate-700 border-l border-slate-200">Deductions</td>
                        <td className={`py-2 px-4 text-right font-mono font-medium ${isMinimalProfessional ? 'text-black' : 'text-rose-700'}`}>
                          Rs. {deductions.toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 text-slate-700">Medical & Transport Allowance</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                          Rs. {allowances.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-slate-700 border-l border-slate-200">Absence / Unpaid Leaves</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-500">
                          Rs. 0
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 text-slate-700">Special Performance Bonus</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                          Rs. {bonus.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-slate-700 border-l border-slate-200">Provident Fund (PF)</td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-slate-500">
                          Rs. 0
                        </td>
                      </tr>
                      <tr className="bg-slate-100 font-bold">
                        <td className="py-2.5 px-4 text-slate-900">Gross Monthly Earnings</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-950">
                          Rs. {gross.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-slate-900 border-l border-slate-200">Total Deductions</td>
                        <td className={`py-2.5 px-4 text-right font-mono ${isMinimalProfessional ? 'text-black' : 'text-rose-800'}`}>
                          Rs. {deductions.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Amount Paid Banner — actual cash paid is the headline;
                      net payable and outstanding stay visible as context. */}
                  <div className={`p-3.5 flex items-center justify-between ${
                    isMinimalProfessional
                      ? 'bg-white text-black border-t-2 border-black'
                      : isMinimalClassic
                        ? 'bg-neutral-100 text-black border-t-2 border-black'
                        : 'bg-emerald-600 text-white'
                  }`}>
                    <div className="font-bold uppercase tracking-wider text-xs">
                      AMOUNT PAID:
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono">
                      Rs. {totalPaid.toLocaleString()}
                    </div>
                  </div>
                  <div className={`px-3.5 py-2 flex items-center justify-between text-[11px] font-semibold ${
                    isMinimalProfessional
                      ? 'bg-white text-black border-t border-black'
                      : isMinimalClassic
                        ? 'bg-neutral-50 text-black border-t border-black'
                        : 'bg-emerald-50 text-emerald-900 border-t border-emerald-200'
                  }`}>
                    <span>Net Salary Payable: Rs. {net.toLocaleString()}</span>
                    <span>Outstanding Balance: Rs. {outstanding.toLocaleString()}</span>
                  </div>
                </div>

                {/* Bank & Payment Notes */}
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-8">
                  <p>
                    <strong>Disbursement Information:</strong> Disbursed via {slipMethod}. Account: {staff.bankAccount || 'Verified on Payroll File'}.
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    Remarks: Salary for {selectedMonth}.
                  </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-12 pt-6 border-t border-slate-300 text-center text-xs">
                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-slate-800">
                      Accounts Incharge / Bursar
                    </div>
                    <span className="text-slate-500 text-[11px]">Authorized Institutional Signatory</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1 font-bold text-slate-800">
                      {staff.name}
                    </div>
                    <span className="text-slate-500 text-[11px]">Employee Signature / Acknowledgement</span>
                  </div>
                </div>

                <div className="mt-6 text-center text-[10px] text-slate-400 italic">
                  This is a computer-generated salary slip verified by Schoollee Academic Management System.
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
