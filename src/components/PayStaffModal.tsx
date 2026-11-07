import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  DollarSign,
  CheckCircle2,
  Download,
  AlertCircle,
  ServerOff,
  Loader2,
} from 'lucide-react';
import { StaffMember, PaymentMethod } from '../types';
import { generateMonthlyIndividualSlipsCombinedPdf } from '../utils/staffPdfGenerator';
import { DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import { getInitials } from '../data/initialStudents';
import { localISODate, monthKeyOf, monthLabelFromKey } from '../utils/dates';
import {
  PayrollRecord,
  PayrollPaymentResult,
  PayrollUnavailableError,
  createPayrollPayment,
  createPayrollPeriod,
  getStaffPayroll,
  buildSlipBreakdown,
} from '../utils/payrollApi';

interface PayStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  allStaff: StaffMember[];
  onSelectStaff: (staff: StaffMember) => void;
  /** Pay Staff page passes the exact period record being paid. When absent
   *  (directory "Pay Salary"), the modal loads the employee's payroll and
   *  uses the current month's record, offering to prepare it if missing. */
  record?: PayrollRecord | null;
  paidBy: string;
  onPaid: (result: PayrollPaymentResult) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Bank Transfer', 'Online', 'JazzCash', 'EasyPaisa', 'Cheque'];

const numOr0 = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

export const PayStaffModal: React.FC<PayStaffModalProps> = ({
  isOpen,
  onClose,
  staff,
  allStaff,
  onSelectStaff,
  record: recordProp,
  paidBy,
  onPaid,
}) => {
  const activeStaff = staff || allStaff[0] || null;

  const [phase, setPhase] = useState<'loading' | 'form' | 'prepare' | 'unavailable' | 'success'>('loading');
  const [record, setRecord] = useState<PayrollRecord | null>(null);
  const [previousOutstanding, setPreviousOutstanding] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<PayrollPaymentResult | null>(null);

  // Form state — adjustments start at 0/blank (the old 10% default is gone).
  const [allowances, setAllowances] = useState('');
  const [bonus, setBonus] = useState('');
  const [deductions, setDeductions] = useState('');
  const [arrears, setArrears] = useState('');
  const [amount, setAmount] = useState('');
  const [amountDirty, setAmountDirty] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('Bank Transfer');
  const [paidDate, setPaidDate] = useState(localISODate());
  const [remarks, setRemarks] = useState('');

  const periodLabel = useMemo(() => {
    if (record) return monthLabelFromKey(record.periodKey);
    return monthLabelFromKey(monthKeyOf());
  }, [record]);

  const netAdjustments = numOr0(allowances) + numOr0(bonus) - numOr0(deductions);
  const dueNow = record ? record.outstanding + netAdjustments : 0;

  // Default the amount to the full amount due (incl. adjustments) until the
  // user types their own (partial payments are first-class).
  useEffect(() => {
    if (!amountDirty && record) setAmount(String(Math.max(0, dueNow)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueNow, record?.id]);

  const loadForStaff = async (staffId: string) => {
    setPhase('loading');
    setError('');
    try {
      const data = await getStaffPayroll(staffId);
      const currentKey = monthKeyOf();
      const rec = data.records.find(r => r.periodKey === currentKey) || null;
      if (!rec) {
        setRecord(null);
        setPreviousOutstanding(data.records.reduce((s, r) => s + r.outstanding, 0));
        setPhase('prepare');
        return;
      }
      setRecord(rec);
      setPreviousOutstanding(
        rec.previousOutstanding ??
          data.records.filter(r => r.periodKey < rec.periodKey).reduce((s, r) => s + r.outstanding, 0)
      );
      setPhase('form');
    } catch (e) {
      if (e instanceof PayrollUnavailableError) setPhase('unavailable');
      else {
        setError(e instanceof Error ? e.message : 'Could not load payroll');
        setPhase('form');
      }
    }
  };

  // (Re)initialise whenever the modal opens for a (different) employee.
  useEffect(() => {
    if (!isOpen || !activeStaff) return;
    setAllowances('');
    setBonus('');
    setDeductions('');
    setArrears('');
    setAmount('');
    setAmountDirty(false);
    setRemarks('');
    setPaidDate(localISODate());
    setLastResult(null);
    setError('');
    if (recordProp && recordProp.staffId === activeStaff.id) {
      setRecord(recordProp);
      setPreviousOutstanding(recordProp.previousOutstanding ?? 0);
      setPhase('form');
    } else {
      void loadForStaff(activeStaff.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeStaff?.id, recordProp?.id]);

  if (!isOpen || !activeStaff) return null;

  const handlePrepare = async () => {
    setSubmitting(true);
    setError('');
    try {
      const now = new Date();
      await createPayrollPeriod(now.getFullYear(), now.getMonth() + 1, paidBy);
      await loadForStaff(activeStaff.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare payroll');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await createPayrollPayment({
        recordId: record.id,
        amount: numOr0(amount),
        allowances: numOr0(allowances),
        bonus: numOr0(bonus),
        deductions: numOr0(deductions),
        arrearsAmount: numOr0(arrears),
        method,
        paidDate,
        remarks: remarks.trim() || undefined,
        createdBy: paidBy,
      });
      setLastResult(result);
      onPaid(result);
      const updated = result.records.find(r => r.id === record.id);
      if (updated) {
        setRecord(updated);
        setPreviousOutstanding(prev => Math.max(0, prev - numOr0(arrears)));
      }
      setPhase('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSlip = async () => {
    if (!record) return;
    try {
      const data = await getStaffPayroll(activeStaff.id);
      const rec = data.records.find(r => r.id === record.id);
      if (!rec) return;
      const bd = buildSlipBreakdown(rec, periodLabel, data.payments);
      generateMonthlyIndividualSlipsCombinedPdf(
        [activeStaff], periodLabel, activeStaff.id, DEFAULT_SCHOOL,
        new Map([[activeStaff.id, bd]])
      );
    } catch {
      setError('Could not generate the salary slip');
    }
  };

  const inputCls = 'w-full bg-[#141b27] border border-edge-14 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-16 border border-[#232f45] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl" id="modal-pay-staff">
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge-18 flex items-center justify-between bg-surface-32">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Pay Salary</h2>
              <p className="text-xs text-slate-400">{periodLabel} payroll</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Employee */}
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full ${activeStaff.avatarColor || 'bg-slate-600'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {getInitials(activeStaff.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{activeStaff.name}</div>
              <div className="text-xs text-slate-400 font-mono">{activeStaff.id} · {activeStaff.role}</div>
            </div>
            <select
              value={activeStaff.id}
              onChange={(e) => {
                const next = allStaff.find(s => s.id === e.target.value);
                if (next) onSelectStaff(next);
              }}
              className="bg-[#141b27] border border-edge-14 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 max-w-[180px]"
              aria-label="Select employee"
            >
              {allStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {phase === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading payroll…
            </div>
          )}

          {phase === 'unavailable' && (
            <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-5 text-center">
              <ServerOff className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-amber-200">Payroll requires the SchoolEx app server</h3>
              <p className="text-xs text-amber-100/70 mt-1">
                Salary payments are recorded in the app database together with the financial ledger.
                Open SchoolEx through the desktop app (or the local server) to pay salaries — the
                browser-only demo cannot record payments, and nothing was saved.
              </p>
            </div>
          )}

          {phase === 'prepare' && (
            <div className="border border-edge-14 bg-surface-32 rounded-xl p-5 text-center">
              <h3 className="text-sm font-bold text-white">No payroll prepared for {periodLabel}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Preparing creates one payroll record per eligible employee with their current salary
                saved as a snapshot. Nothing is paid automatically.
              </p>
              {previousOutstanding > 0 && (
                <p className="text-xs text-amber-300 mt-2">
                  This employee also has Rs. {previousOutstanding.toLocaleString()} outstanding from earlier months.
                </p>
              )}
              <button
                type="button"
                onClick={handlePrepare}
                disabled={submitting}
                className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {submitting ? 'Preparing…' : `Prepare ${periodLabel} payroll`}
              </button>
              {error && <p className="text-xs text-rose-400 mt-3">{error}</p>}
            </div>
          )}

          {phase === 'success' && lastResult && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">Payment recorded</h3>
              <p className="text-sm text-slate-300 mt-1">
                Rs. {lastResult.payments.reduce((s, p) => s + p.amount, 0).toLocaleString()} paid to {activeStaff.name}
                {record && record.outstanding > 0
                  ? ` — Rs. ${record.outstanding.toLocaleString()} still outstanding for ${periodLabel}.`
                  : ` — ${periodLabel} is fully paid.`}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Reference: {lastResult.payments.map(p => p.id).join(', ')} · Ledger updated in the same transaction.
              </p>
              <div className="flex items-center justify-center gap-2 mt-5">
                <button type="button" onClick={handleDownloadSlip} className="px-4 py-2 rounded-lg bg-[#192436] hover:bg-[#202e46] border border-edge-39 text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Download Salary Slip
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                  Done
                </button>
              </div>
            </div>
          )}

          {phase === 'form' && record && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Snapshot facts */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-32 border border-edge-14 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Monthly salary</div>
                  <div className="text-sm font-bold text-white mt-0.5">Rs. {record.baseSalary.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500">snapshot for {periodLabel}</div>
                </div>
                <div className="bg-surface-32 border border-edge-14 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Already paid</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">Rs. {record.paid.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500">{record.paymentCount} payment(s)</div>
                </div>
                <div className="bg-surface-32 border border-edge-14 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Outstanding</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">Rs. {record.outstanding.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500">status: {record.status}</div>
                </div>
              </div>

              {previousOutstanding > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Previous outstanding balance: <strong>Rs. {previousOutstanding.toLocaleString()}</strong> from
                    earlier months. Use “Pay arrears” below to settle it (oldest month first) — it never
                    creates a new obligation.
                  </span>
                </div>
              )}

              {/* Adjustments */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Allowances (optional)</label>
                  <input type="number" min="0" value={allowances} onChange={e => setAllowances(e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Bonus (optional)</label>
                  <input type="number" min="0" value={bonus} onChange={e => setBonus(e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Deductions (optional)</label>
                  <input type="number" min="0" value={deductions} onChange={e => setDeductions(e.target.value)} placeholder="0" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Amount to pay — {periodLabel}</label>
                  <input
                    type="number" min="0" value={amount}
                    onChange={e => { setAmount(e.target.value); setAmountDirty(true); }}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Full amount due: Rs. {Math.max(0, dueNow).toLocaleString()} — enter less for a partial payment.</p>
                </div>
                <div>
                  <label className={labelCls}>Pay arrears (optional)</label>
                  <input type="number" min="0" value={arrears} onChange={e => setArrears(e.target.value)} placeholder="0" className={inputCls} disabled={previousOutstanding <= 0} />
                  <p className="text-[10px] text-slate-500 mt-1">Settles earlier months, oldest first.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Payment method</label>
                  <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className={inputCls}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Payment date</label>
                  <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Remarks (optional)</label>
                <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Regular monthly salary" className={inputCls} />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={handleDownloadSlip} className="px-4 py-2 rounded-lg bg-[#192436] hover:bg-[#202e46] border border-edge-39 text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Salary Slip
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer">
                  {submitting ? 'Recording…' : `Pay Rs. ${(numOr0(amount) + numOr0(arrears)).toLocaleString()}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
