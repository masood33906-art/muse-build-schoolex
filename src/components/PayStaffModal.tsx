import React, { useState, useMemo } from 'react';
import { 
  X, 
  DollarSign, 
  CheckCircle2, 
  FileText, 
  Download, 
  CreditCard, 
  Calendar, 
  AlertCircle,
  Users,
  Clock,
  Sparkles
} from 'lucide-react';
import { StaffMember, SalaryBreakdown } from '../types';
import { generateSalarySlipPdf } from '../utils/staffPdfGenerator';
import { exportPayrollSummaryToCSV } from '../utils/staffCsvHelper';
import { DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import { getInitials } from '../data/initialStudents';
import { owedMonthsOf } from '../utils/payrollService';
import { localISODate } from '../utils/dates';

interface PayStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  allStaff: StaffMember[];
  onSelectStaff: (staff: StaffMember) => void;
  onConfirmPayment: (staffId: string, breakdown: SalaryBreakdown) => void;
  onBulkPayAllPending: () => void;
}

export const PayStaffModal: React.FC<PayStaffModalProps> = ({
  isOpen,
  onClose,
  staff,
  allStaff,
  onSelectStaff,
  onConfirmPayment,
  onBulkPayAllPending
}) => {
  const currentMonth = 'September 2026';
  const [activeTab, setActiveTab] = useState<'individual' | 'bulk' | 'summary'>('individual');

  // Form State for Individual Payment
  const [allowancePercent, setAllowancePercent] = useState<number>(10);
  const [bonus, setBonus] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Cheque'>('Bank Transfer');
  const [notes, setNotes] = useState<string>('Regular monthly salary disbursement');
  const [justPaidSuccess, setJustPaidSuccess] = useState<boolean>(false);

  // Default target employee if none passed
  const activeStaff = staff || allStaff[0];

  const totalPayroll = useMemo(() => allStaff.reduce((sum, s) => sum + (s.salary || 0), 0), [allStaff]);
  const paidStaff = useMemo(() => allStaff.filter(s => s.status === 'Active' && owedMonthsOf(s).length === 0), [allStaff]);
  const pendingStaff = useMemo(() => allStaff.filter(s => owedMonthsOf(s).length > 0), [allStaff]);
  const paidAmount = useMemo(() => paidStaff.reduce((sum, s) => sum + (s.salary || 0), 0), [paidStaff]);
  const pendingAmount = useMemo(() => pendingStaff.reduce((sum, s) => sum + owedMonthsOf(s).length * (s.salary || 0), 0), [pendingStaff]);

  if (!isOpen || !activeStaff) return null;

  // Fix #7b: the payslip/payment base is the staff member's OWN
  // recorded salary — an unset salary is 0, exactly as this file's
  // payroll aggregates above already treat it (`s.salary || 0`).
  // The old code paid and printed a net computed from an invented
  // 60,000 for anyone whose salary was unset or 0.
  const baseSalary = activeStaff.salary || 0;
  const computedAllowances = Math.round((baseSalary * allowancePercent) / 100);
  const computedNetSalary = baseSalary + computedAllowances + (bonus || 0) - (deductions || 0);
  const targetMonth = owedMonthsOf(activeStaff)[0] || currentMonth;

  const currentBreakdown: SalaryBreakdown = {
    baseSalary,
    allowances: computedAllowances,
    bonus,
    deductions,
    netSalary: computedNetSalary,
    month: targetMonth,
    paymentMethod,
    paidDate: localISODate(),
    referenceNo: `SAL-${activeStaff.id.replace('EMP-', '')}-${Date.now().toString().slice(-4)}`,
    notes
  };

  const handleProcessSinglePay = () => {
    onConfirmPayment(activeStaff.id, currentBreakdown);
    setJustPaidSuccess(true);
    setTimeout(() => setJustPaidSuccess(false), 3000);
  };

  const handleDownloadPayslip = () => {
    generateSalarySlipPdf(activeStaff, currentBreakdown, DEFAULT_SCHOOL);
  };

  const handleExportPayroll = () => {
    exportPayrollSummaryToCSV(allStaff, currentMonth);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface-16 border border-[#232f45] rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
        id="modal-pay-staff"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge-18 flex items-center justify-between bg-surface-32">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Staff Salary & Payroll Management</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {currentMonth}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Disburse salaries, calculate net earnings, generate official slips, and export payroll
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Mini Summary Banner */}
        <div className="bg-[#0e131d] border-b border-[#1c2638] px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Total Budget:</span>
            <span className="text-slate-100 font-bold font-mono text-sm">
              Rs. {totalPayroll.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-emerald-400/90 block text-[11px]">Disbursed (Paid):</span>
            <span className="text-emerald-400 font-bold font-mono text-sm">
              Rs. {paidAmount.toLocaleString()} ({paidStaff.length})
            </span>
          </div>
          <div>
            <span className="text-amber-400/90 block text-[11px]">Pending Payouts:</span>
            <span className="text-amber-300 font-bold font-mono text-sm">
              Rs. {pendingAmount.toLocaleString()} ({pendingStaff.length})
            </span>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleExportPayroll}
              className="px-2.5 py-1.5 rounded-lg bg-[#182336] hover:bg-[#202e46] border border-[#273854] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Payroll</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="px-6 pt-3 border-b border-edge-17 flex items-center gap-2 bg-surface-16">
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-all ${
              activeTab === 'individual'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Process Individual Salary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'bulk'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Bulk Salary Payout</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
              {pendingStaff.length}
            </span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'individual' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form & Calculator */}
              <div className="lg:col-span-7 space-y-4">
                {/* Employee Switcher */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Staff Member:
                  </label>
                  <select
                    value={activeStaff.id}
                    onChange={(e) => {
                      const found = allStaff.find(s => s.id === e.target.value);
                      if (found) onSelectStaff(found);
                    }}
                    className="w-full bg-surface-32 border border-edge-26 rounded-lg px-3 py-2.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {allStaff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} • {s.role} — Rs. {s.salary.toLocaleString()} ({s.payStatus})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Salary breakdown inputs */}
                <div className="bg-[#151e2e] border border-[#223047] rounded-xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Monthly Base Salary</span>
                    <span className="text-sm font-bold font-mono text-white">
                      Rs. {baseSalary.toLocaleString()}
                    </span>
                  </div>

                  {/* Allowances Percentage Slider/Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Medical & Transport Allowance:</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        + Rs. {computedAllowances.toLocaleString()} ({allowancePercent}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="5"
                      value={allowancePercent}
                      onChange={(e) => setAllowancePercent(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Bonus Field */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Bonus / Performance (Rs.):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={bonus || ''}
                        placeholder="0"
                        onChange={(e) => setBonus(Number(e.target.value) || 0)}
                        className="w-full bg-[#111722] border border-[#26354f] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Deductions Field */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Tax / Deductions (Rs.):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={deductions || ''}
                        placeholder="0"
                        onChange={(e) => setDeductions(Number(e.target.value) || 0)}
                        className="w-full bg-[#111722] border border-[#26354f] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                      Disbursement Method:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Bank Transfer', 'Cash', 'Cheque'] as const).map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer border transition-all text-center ${
                            paymentMethod === method
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-[#121926] text-slate-400 border-[#223049] hover:text-slate-200'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Notes / Reference:
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-[#111722] border border-[#26354f] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      placeholder="e.g. Cleared via HBL Account Transfer"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleProcessSinglePay}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-amber-500/20"
                    id="btn-confirm-single-payment"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark {activeStaff.name.split(' ')[0]} as Paid</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPayslip}
                    className="py-2.5 px-4 rounded-xl bg-[#192436] hover:bg-[#213048] border border-[#293c5a] text-slate-200 font-semibold text-xs flex items-center gap-2 cursor-pointer transition-all"
                    id="btn-download-payslip-pdf"
                    title="Generate printable PDF salary slip"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Payslip (PDF)</span>
                  </button>
                </div>

                {justPaidSuccess && (
                  <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Payment recorded successfully! Salary status updated to Paid.</span>
                  </div>
                )}
              </div>

              {/* Right Column: Payslip Preview Receipt */}
              <div className="lg:col-span-5 bg-[#0e141f] border border-[#202c42] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-surface-48 pb-3 mb-3">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Salary Slip Preview
                      </h4>
                      <p className="text-[10px] text-slate-400">{DEFAULT_SCHOOL.name}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {owedMonthsOf(activeStaff).length === 0 ? 'PAID' : 'PENDING'}
                    </span>
                  </div>

                  {/* Employee Snapshot */}
                  <div className="bg-[#141b27] p-3 rounded-lg border border-[#222d42] mb-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Employee:</span>
                      <span className="font-semibold text-slate-100">{activeStaff.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Employee ID:</span>
                      <span className="font-mono text-emerald-400">{activeStaff.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Role:</span>
                      <span className="text-slate-200">{activeStaff.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Department:</span>
                      <span className="text-slate-200">{activeStaff.department}</span>
                    </div>
                  </div>

                  {/* Calculations Table */}
                  <div className="space-y-1.5 text-xs py-2 border-t border-b border-[#1e2a40]">
                    <div className="flex justify-between text-slate-300">
                      <span>Basic Salary:</span>
                      <span className="font-mono">Rs. {baseSalary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>Allowances:</span>
                      <span className="font-mono">+ Rs. {computedAllowances.toLocaleString()}</span>
                    </div>
                    {bonus > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span>Bonus:</span>
                        <span className="font-mono">+ Rs. {bonus.toLocaleString()}</span>
                      </div>
                    )}
                    {deductions > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>Deductions:</span>
                        <span className="font-mono">- Rs. {deductions.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Net Payable Highlight */}
                  <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-300 block">NET PAYABLE</span>
                      <span className="text-[10px] text-slate-400">Via {paymentMethod}</span>
                    </div>
                    <span className="text-lg font-extrabold text-emerald-400 font-mono">
                      Rs. {computedNetSalary.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-4 text-center">
                  <p className="text-[10px] text-slate-500 italic">
                    Click "Payslip (PDF)" above to download formatted slip with official signature spaces.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Bulk Salary Payout Tab */
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="bg-[#151e2e] border border-[#25344e] rounded-xl p-5 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
                  <DollarSign className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Bulk Payout for {currentMonth}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Disburse and mark all remaining unpaid and pending staff members as "Paid" in a single batch operation.
                </p>

                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto my-5 p-3 rounded-lg bg-[#0e141f] border border-[#1e2a3e]">
                  <div>
                    <span className="text-xs text-slate-400 block">Pending Staff:</span>
                    <span className="text-xl font-bold text-amber-400">{pendingStaff.length} Members</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Total Amount:</span>
                    <span className="text-xl font-bold text-white font-mono">
                      Rs. {pendingAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Confirm disbursement of Rs. ${pendingAmount.toLocaleString()} to ${pendingStaff.length} staff members?`)) {
                      onBulkPayAllPending();
                    }
                  }}
                  disabled={pendingStaff.length === 0}
                  className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-amber-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {pendingStaff.length === 0
                      ? 'All Staff Are Already Paid!'
                      : `Disburse & Pay All ${pendingStaff.length} Pending Staff`}
                  </span>
                </button>
              </div>

              {/* Pending List Quick Preview */}
              {pendingStaff.length > 0 && (
                <div className="border border-surface-48 rounded-xl overflow-hidden bg-surface-12">
                  <div className="px-4 py-2.5 bg-surface-34 text-xs font-semibold text-slate-300 border-b border-surface-48">
                    Pending Salary List ({pendingStaff.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#1b2538] text-xs">
                    {pendingStaff.map(s => (
                      <div key={s.id} className="px-4 py-2 flex items-center justify-between hover:bg-[#151e2d]">
                        <div>
                          <span className="font-semibold text-white">{s.name}</span>
                          <span className="text-slate-400 ml-2">({s.role})</span>
                        </div>
                        <span className="font-mono text-amber-300 font-bold">
                          Rs. {s.salary.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
