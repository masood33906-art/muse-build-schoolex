import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wallet,
  Download,
  Trash2,
  ServerOff,
  Loader2,
  History,
  LayoutGrid,
  FileDown,
} from 'lucide-react';
import { StaffMember, PaymentMethod } from '../types';
import { PaymentSummaryData } from './PaymentSummaryPage';
import { PayStaffModal } from './PayStaffModal';
import { getSchoolSettings } from '../utils/settingsHelper';
import { getInitials } from '../data/initialStudents';
import { localISODate, MONTHS, monthLabelFromKey } from '../utils/dates';
import { generateMonthlyIndividualSlipsCombinedPdf } from '../utils/staffPdfGenerator';
import { DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import {
  PayrollPeriodSummary,
  PayrollRecord,
  PayrollPayment,
  PayrollPaymentResult,
  PayrollMigrationReport,
  PayrollUnavailableError,
  applyPayrollSync,
  buildSlipBreakdown,
  createBulkPayrollPayments,
  createPayrollPeriod,
  deletePayrollRecord,
  getStaffPayroll,
  listPayrollPayments,
  listPayrollPeriods,
  listPayrollRecords,
  runPayrollMigration,
} from '../utils/payrollApi';

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

type StatusFilter = 'All' | 'Paid' | 'Unpaid' | 'Partial';

const BULK_METHODS: PaymentMethod[] = ['Bank Transfer', 'Cash', 'Online', 'JazzCash', 'EasyPaisa', 'Cheque'];
const fmt = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

export const PayStaffPage: React.FC<PayStaffPageProps> = ({
  staffList,
  onUpdateStaff,
  onBackToStaff,
  month,
  year,
  onOpenSalarySlips,
  onNavigateToPaymentSummary,
  initialSelectedStaffId,
  onClearInitialSelectedStaff,
}) => {
  const settings = getSchoolSettings();
  const paidBy = settings.principalName || settings.schoolName || 'Accounts Office';

  const initMonth = Math.max(1, MONTHS.indexOf(month) + 1) || new Date().getMonth() + 1;
  const initYear = Number(year) || new Date().getFullYear();
  const [selYear, setSelYear] = useState(initYear);
  const [selMonth, setSelMonth] = useState(initMonth);
  const periodKey = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const periodLabel = monthLabelFromKey(periodKey);

  const [apiState, setApiState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [periods, setPeriods] = useState<PayrollPeriodSummary[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [tab, setTab] = useState<'payroll' | 'history'>('payroll');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMethod, setBulkMethod] = useState<PaymentMethod>('Bank Transfer');
  const [payTarget, setPayTarget] = useState<PayrollRecord | null>(null);

  const [history, setHistory] = useState<PayrollPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histStaff, setHistStaff] = useState('');
  const [histPeriod, setHistPeriod] = useState('');

  const [migrationReport, setMigrationReport] = useState<PayrollMigrationReport | null>(null);

  const periodExists = useMemo(() => periods.some(p => p.periodKey === periodKey), [periods, periodKey]);

  const loadPeriods = async () => {
    const ps = await listPayrollPeriods();
    setPeriods(ps);
    return ps;
  };

  const loadRecords = async () => {
    setRecordsLoading(true);
    try {
      const { records: recs } = await listPayrollRecords(periodKey);
      setRecords(recs);
    } catch (e) {
      if (e instanceof PayrollUnavailableError) setApiState('unavailable');
      else setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadPeriods();
        if (!cancelled) setApiState('ready');
      } catch {
        if (!cancelled) setApiState('unavailable');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (apiState !== 'ready') return;
    setSelected(new Set());
    if (periodExists) void loadRecords();
    else setRecords([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiState, periodKey, periodExists]);

  // Opened from the directory with a specific employee → open their Pay form.
  const initialHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!initialSelectedStaffId || records.length === 0) return;
    if (initialHandled.current === initialSelectedStaffId) return;
    const rec = records.find(r => r.staffId === initialSelectedStaffId);
    if (rec) {
      initialHandled.current = initialSelectedStaffId;
      setPayTarget(rec);
    }
    onClearInitialSelectedStaff?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedStaffId, records]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const payments = await listPayrollPayments({
        staffId: histStaff || undefined,
        periodKey: histPeriod || undefined,
      });
      setHistory(payments);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'history' && apiState === 'ready') void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, histStaff, histPeriod, apiState]);

  const totals = useMemo(() => ({
    staffCount: records.length,
    paidCount: records.filter(r => r.status === 'Paid').length,
    unpaidCount: records.filter(r => r.status === 'Unpaid').length,
    partialCount: records.filter(r => r.status === 'Partial').length,
    totalDue: records.reduce((s, r) => s + r.due, 0),
    totalPaid: records.reduce((s, r) => s + r.paid, 0),
    totalOutstanding: records.reduce((s, r) => s + r.outstanding, 0),
  }), [records]);

  const visibleRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(r => {
      if (filter !== 'All' && r.status !== filter) return false;
      if (q && !r.staffName.toLowerCase().includes(q) && !r.staffId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, search, filter]);

  const selectableVisible = visibleRecords.filter(r => r.outstanding > 0);
  const allSelected = selectableVisible.length > 0 && selectableVisible.every(r => selected.has(r.id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handlePrepare = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await createPayrollPeriod(selYear, selMonth, paidBy);
      await loadPeriods();
      setMessage({ kind: 'ok', text: `Payroll prepared for ${periodLabel} — one record per eligible employee, salaries snapshotted. Nothing was paid.` });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could not prepare payroll' });
    } finally {
      setBusy(false);
    }
  };

  const handlePaymentApplied = async (result: PayrollPaymentResult) => {
    applyPayrollSync(result);
    onUpdateStaff(result.staff);
    await loadPeriods();
    if (periodExists) await loadRecords();
    if (tab === 'history') await loadHistory();
  };

  const handleBulkPay = async () => {
    const chosen = records.filter(r => selected.has(r.id) && r.outstanding > 0);
    if (chosen.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await createBulkPayrollPayments({
        items: chosen.map(r => ({ recordId: r.id })),
        method: bulkMethod,
        paidDate: localISODate(),
        createdBy: paidBy,
      });
      await handlePaymentApplied(result);
      setSelected(new Set());
      const totalPaidNow = result.payments.reduce((s, p) => s + p.amount, 0);
      if (onNavigateToPaymentSummary) {
        const paidIds = new Set(result.payments.map(p => p.staffId));
        onNavigateToPaymentSummary({
          month: MONTHS[selMonth - 1],
          year: String(selYear),
          monthNumber: String(selMonth).padStart(2, '0'),
          paymentDate: localISODate(),
          paymentMethod: bulkMethod,
          paidStaff: staffList.filter(s => paidIds.has(s.id)),
          totalSalaryPaid: totalPaidNow,
          staffPaidCount: paidIds.size,
        });
      } else {
        setMessage({ kind: 'ok', text: `Paid ${fmt(totalPaidNow)} across ${result.payments.length} record(s). Ledger updated in the same transaction.` });
      }
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Bulk payment failed — nothing was recorded' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRecord = async (rec: PayrollRecord) => {
    if (!confirm(`Delete the ${periodLabel} payroll record for ${rec.staffName}? It has no payments, so nothing financial is lost. You can re-prepare the month to recreate it.`)) return;
    setBusy(true);
    try {
      await deletePayrollRecord(rec.id);
      await loadPeriods();
      await loadRecords();
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Could not delete the record' });
    } finally {
      setBusy(false);
    }
  };

  const handleRunMigration = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const report = await runPayrollMigration();
      setMigrationReport(report);
      await loadPeriods();
      if (periodExists) await loadRecords();
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Migration failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleSlip = async (payment: PayrollPayment) => {
    const member = staffList.find(s => s.id === payment.staffId);
    if (!member) {
      setMessage({ kind: 'err', text: 'Employee not found in the staff list' });
      return;
    }
    try {
      const data = await getStaffPayroll(payment.staffId);
      const rec = data.records.find(r => r.periodKey === payment.periodKey);
      if (!rec) return;
      const label = payment.periodLabel || monthLabelFromKey(payment.periodKey);
      const bd = buildSlipBreakdown(rec, label, data.payments);
      generateMonthlyIndividualSlipsCombinedPdf([member], label, member.id, DEFAULT_SCHOOL, new Map([[member.id, bd]]));
    } catch {
      setMessage({ kind: 'err', text: 'Could not generate the salary slip' });
    }
  };

  const payTargetStaff = payTarget ? staffList.find(s => s.id === payTarget.staffId) || null : null;

  const statusChip = (status: PayrollRecord['status']) => {
    if (status === 'Paid') return 'bg-[#0e2c20] text-[#4ade80] border-[#164e3b]';
    if (status === 'Partial') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
  };

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBackToStaff} className="p-2 rounded-lg bg-surface-32 border border-edge-18 text-slate-300 hover:text-white cursor-pointer" title="Back to staff directory">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Pay Staff</h1>
            <p className="text-xs text-slate-400">Monthly payroll, salary payments and payment history — recorded in the app database with the financial ledger.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-edge-18">
            <button type="button" onClick={() => setTab('payroll')} className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${tab === 'payroll' ? 'bg-emerald-600 text-white' : 'bg-surface-32 text-slate-300'}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Monthly Payroll
            </button>
            <button type="button" onClick={() => setTab('history')} className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${tab === 'history' ? 'bg-emerald-600 text-white' : 'bg-surface-32 text-slate-300'}`}>
              <History className="w-3.5 h-3.5" /> Payment History
            </button>
          </div>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="bg-surface-32 border border-edge-18 rounded-lg px-3 py-2 text-xs font-semibold text-slate-100 cursor-pointer" aria-label="Payroll month">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="bg-surface-32 border border-edge-18 rounded-lg px-3 py-2 text-xs font-semibold text-slate-100 cursor-pointer" aria-label="Payroll year">
            {[initYear - 2, initYear - 1, initYear, initYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {onOpenSalarySlips && (
            <button type="button" onClick={() => onOpenSalarySlips('overall')} className="px-3.5 py-2 rounded-lg bg-[#192436] hover:bg-[#202e46] border border-edge-39 text-xs font-semibold text-slate-200 cursor-pointer">
              Salary Slips
            </button>
          )}
          <button type="button" onClick={handleRunMigration} disabled={busy || apiState !== 'ready'} className="px-3.5 py-2 rounded-lg bg-[#192436] hover:bg-[#202e46] border border-edge-39 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50" title="Import pre-payroll salary history (paidMonths / salary transactions) into the payroll tables — safe to re-run">
            <FileDown className="w-3.5 h-3.5" /> Import Legacy History
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 flex items-start gap-2 text-xs rounded-lg px-3.5 py-2.5 border ${message.kind === 'ok' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-300 bg-rose-500/10 border-rose-500/30'}`}>
          {message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {migrationReport && (
        <div className="mb-4 border border-edge-18 bg-surface-32 rounded-xl p-4 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Legacy payroll import — reconciliation report</h3>
            <button type="button" onClick={() => setMigrationReport(null)} className="text-slate-400 hover:text-white cursor-pointer">Dismiss</button>
          </div>
          <p className="mt-1 text-slate-400">
            Imported {fmt(migrationReport.totals.imported)} across {migrationReport.totals.monthsMigrated} staff-month(s)
            ({migrationReport.totals.paymentsCreated} payment(s) created). Salary transactions total {fmt(migrationReport.totals.salaryTransactions)};
            matching ledger entries total {fmt(migrationReport.totals.ledger)}. Migrated payments do not write new ledger
            entries (the expense is already there — no double-counting), and old records were not modified.
          </p>
          {migrationReport.staff.filter(s => s.difference !== 0).length > 0 && (
            <ul className="mt-2 space-y-1">
              {migrationReport.staff.filter(s => s.difference !== 0).map(s => (
                <li key={s.staffId} className="text-amber-300">
                  {s.staffName} ({s.staffId}): difference {fmt(s.difference)} — see skipped items below.
                </li>
              ))}
            </ul>
          )}
          {migrationReport.skipped.length > 0 && (
            <ul className="mt-2 space-y-1 text-slate-400">
              {migrationReport.skipped.slice(0, 12).map((sk, i) => (
                <li key={i}>• {sk.staffName || sk.staffId}: {sk.reason}{sk.amount ? ` (${fmt(sk.amount)})` : ''}</li>
              ))}
              {migrationReport.skipped.length > 12 && <li>• …and {migrationReport.skipped.length - 12} more</li>}
            </ul>
          )}
        </div>
      )}

      {apiState === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-16 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading payroll…
        </div>
      )}

      {apiState === 'unavailable' && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-2xl p-8 text-center max-w-xl mx-auto mt-8">
          <ServerOff className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-amber-200">Payroll requires the SchoolEx app server</h2>
          <p className="text-sm text-amber-100/70 mt-2">
            Salary payments are recorded in the app database in the same transaction as the financial
            ledger, so they can only be made from the desktop app (or the local server) — not from the
            browser-only demo. Nothing here falls back to local storage, and no payment can be lost
            between the two.
          </p>
        </div>
      )}

      {apiState === 'ready' && tab === 'payroll' && (
        <>
          {!periodExists ? (
            <div className="border border-edge-18 bg-surface-32 rounded-2xl p-8 text-center max-w-xl mx-auto mt-4">
              <Wallet className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-base font-bold text-white">Prepare {periodLabel} payroll</h2>
              <p className="text-sm text-slate-400 mt-2">
                Create one payroll record for every eligible employee (Active / On Leave, joined on or
                before the end of {periodLabel}). Each record snapshots the employee's current salary —
                later salary changes never rewrite this month. Preparing never pays anyone automatically.
              </p>
              <button type="button" onClick={handlePrepare} disabled={busy} className="mt-5 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold cursor-pointer">
                {busy ? 'Preparing…' : `Prepare ${periodLabel} payroll`}
              </button>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
                {[
                  { label: 'Total Staff', value: String(totals.staffCount), icon: Users, cls: 'text-white' },
                  { label: 'Paid', value: String(totals.paidCount), icon: CheckCircle2, cls: 'text-emerald-400' },
                  { label: 'Unpaid', value: String(totals.unpaidCount), icon: AlertCircle, cls: 'text-rose-300' },
                  { label: 'Partially Paid', value: String(totals.partialCount), icon: Clock, cls: 'text-amber-300' },
                  { label: 'Total Paid', value: fmt(totals.totalPaid), icon: CheckCircle2, cls: 'text-emerald-400' },
                  { label: 'Outstanding', value: fmt(totals.totalOutstanding), icon: Wallet, cls: 'text-amber-300' },
                ].map(card => (
                  <div key={card.label} className="bg-surface-32 border border-edge-18 rounded-xl p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                      <card.icon className="w-3.5 h-3.5" /> {card.label}
                    </div>
                    <div className={`text-lg font-extrabold mt-1 ${card.cls}`}>{card.value}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500 mb-4 -mt-2">
                Monthly payroll amount (total due for {periodLabel}): <span className="text-slate-300 font-semibold">{fmt(totals.totalDue)}</span>
              </div>

              {/* Search + filters + bulk bar */}
              <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or ID…"
                    className="w-full bg-[#141b27] border border-edge-14 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-1.5">
                  {(['All', 'Paid', 'Unpaid', 'Partial'] as StatusFilter[]).map(f => (
                    <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${filter === f ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-surface-32 text-slate-300 border-edge-18 hover:text-white'}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 xl:ml-auto">
                  <select value={bulkMethod} onChange={e => setBulkMethod(e.target.value as PaymentMethod)} className="bg-[#141b27] border border-edge-14 rounded-lg px-2.5 py-2 text-xs text-slate-200 cursor-pointer" aria-label="Bulk payment method">
                    {BULK_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button
                    type="button" onClick={handleBulkPay}
                    disabled={busy || selected.size === 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                  >
                    {busy ? 'Paying…' : `Pay Selected (${selected.size})`}
                  </button>
                </div>
              </div>

              {/* Records table */}
              <div className="overflow-x-auto border border-edge-18 rounded-xl bg-surface-32">
                <table className="w-full text-left border-collapse min-w-[820px]">
                  <thead className="bg-surface-7 border-b border-edge-18 text-[11px] font-semibold text-slate-400">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox" checked={allSelected}
                          onChange={e => setSelected(e.target.checked ? new Set(selectableVisible.map(r => r.id)) : new Set())}
                          className="accent-emerald-500 cursor-pointer" aria-label="Select all payable"
                        />
                      </th>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Salary (snapshot)</th>
                      <th className="py-3 px-4">Paid</th>
                      <th className="py-3 px-4">Outstanding</th>
                      <th className="py-3 px-4">Prev. Outstanding</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-32 text-xs">
                    {recordsLoading ? (
                      <tr><td colSpan={8} className="py-10 text-center text-slate-500">Loading records…</td></tr>
                    ) : visibleRecords.length === 0 ? (
                      <tr><td colSpan={8} className="py-10 text-center text-slate-500">No employees match this filter.</td></tr>
                    ) : visibleRecords.map(rec => {
                      const member = staffList.find(s => s.id === rec.staffId);
                      return (
                        <tr key={rec.id} className="hover:bg-surface-19">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox" checked={selected.has(rec.id)} disabled={rec.outstanding <= 0}
                              onChange={() => toggleSelect(rec.id)}
                              className="accent-emerald-500 cursor-pointer disabled:opacity-30" aria-label={`Select ${rec.staffName}`}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full ${member?.avatarColor || 'bg-slate-600'} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                                {getInitials(rec.staffName)}
                              </div>
                              <div>
                                <div className="font-bold text-white">{rec.staffName}</div>
                                <div className="text-slate-500 font-mono text-[10px]">{rec.staffId}{rec.origin === 'migrated' ? ' · migrated' : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-200 font-semibold">{fmt(rec.baseSalary)}</td>
                          <td className="py-3 px-4 text-emerald-400 font-semibold">{fmt(rec.paid)}</td>
                          <td className="py-3 px-4 text-amber-300 font-semibold">{fmt(rec.outstanding)}</td>
                          <td className="py-3 px-4 text-slate-400">{rec.previousOutstanding ? fmt(rec.previousOutstanding) : '—'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusChip(rec.status)}`}>{rec.status}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {rec.outstanding > 0 && (
                                <button type="button" onClick={() => setPayTarget(rec)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer">
                                  Pay Salary
                                </button>
                              )}
                              {rec.paymentCount === 0 && (
                                <button type="button" onClick={() => handleDeleteRecord(rec)} disabled={busy} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer" title="Delete record (no payments yet)">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {apiState === 'ready' && tab === 'history' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select value={histStaff} onChange={e => setHistStaff(e.target.value)} className="bg-[#141b27] border border-edge-14 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer" aria-label="Filter by employee">
              <option value="">All employees</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
            <select value={histPeriod} onChange={e => setHistPeriod(e.target.value)} className="bg-[#141b27] border border-edge-14 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer" aria-label="Filter by month">
              <option value="">All months</option>
              {periods.map(p => <option key={p.periodKey} value={p.periodKey}>{p.label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto border border-edge-18 rounded-xl bg-surface-32">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead className="bg-surface-7 border-b border-edge-18 text-[11px] font-semibold text-slate-400">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Adjustments</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-32 text-xs">
                {historyLoading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-500">Loading payments…</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-500">No salary payments recorded yet.</td></tr>
                ) : history.map(p => (
                  <tr key={p.id} className="hover:bg-surface-19">
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{p.paidDate}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{p.staffName || p.staffId}</div>
                      <div className="text-slate-500 font-mono text-[10px]">{p.staffId}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{p.periodLabel || p.periodKey}</td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">{fmt(p.amount)}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.allowances + p.bonus - p.deductions !== 0
                        ? `+${fmt(p.allowances + p.bonus)} / −${fmt(p.deductions)}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{p.method}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">{p.id}{p.source === 'migration' ? ' · migrated' : ''}</td>
                    <td className="py-3 px-4 text-right">
                      <button type="button" onClick={() => handleSlip(p)} className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer inline-flex items-center gap-1">
                        <Download className="w-3 h-3" /> Slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Slips are generated from the month's payroll record and its actual payments — allowances, bonus,
            deductions and amounts paid are the real recorded figures.
          </p>
        </>
      )}

      {/* Pay Salary modal (record-driven) */}
      {payTarget && payTargetStaff && (
        <PayStaffModal
          isOpen={true}
          onClose={() => setPayTarget(null)}
          staff={payTargetStaff}
          allStaff={staffList}
          onSelectStaff={(s) => {
            const rec = records.find(r => r.staffId === s.id);
            if (rec) setPayTarget(rec);
          }}
          record={payTarget}
          paidBy={paidBy}
          onPaid={async (result) => {
            await handlePaymentApplied(result);
            const updated = result.records.find(r => r.id === payTarget.id);
            if (updated) setPayTarget(updated);
          }}
        />
      )}
    </div>
  );
};
