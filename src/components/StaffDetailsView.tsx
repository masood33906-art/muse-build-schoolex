import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Mail, 
  IdCard, 
  Edit3, 
  UserX, 
  User, 
  Users, 
  MessageCircle, 
  Phone, 
  CreditCard, 
  Briefcase, 
  Calendar, 
  MapPin, 
  StickyNote, 
  ChevronDown, 
  Plus, 
  Minus, 
  Search, 
  UploadCloud, 
  Trash2, 
  Eye, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  X,
  FileCheck
} from 'lucide-react';
import { 
  StaffMember, 
  StaffDocument, 
  StaffActivity, 
  StaffTransaction,
  AttendanceRecord,
  AttendanceStatus,
  HolidayRecord
} from '../types';
import { getAvatarColor, getInitials } from '../data/initialStudents';
import { MemberAttendanceSection } from './MemberAttendanceSection';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { addLedgerTransaction } from '../utils/ledgerStore';
import { getSchoolSettings } from '../utils/settingsHelper';
import {
  PayrollRecord,
  PayrollPayment,
  applyPayrollSync,
  buildSlipBreakdown,
  createBulkPayrollPayments,
  getStaffPayroll,
} from '../utils/payrollApi';
import { monthLabelFromKey, localISODate } from '../utils/dates';
import { DEFAULT_SCHOOL } from '../utils/pdfGenerator';
import { generateMonthlyIndividualSlipsCombinedPdf } from '../utils/staffPdfGenerator';
import { putFile, getFile, deleteFile } from '../utils/blobStore';
import { nextSequential } from '../utils/ids';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StaffDetailsViewProps {
  staff: StaffMember;
  onBack: () => void;
  onNavigateOverview?: () => void;
  onUpdateStaff: (updated: StaffMember) => void;
  onOpenEditModal: (staff: StaffMember) => void;
  onOpenIdCardModal: (staff: StaffMember) => void;
  onOpenPayModal: (staff: StaffMember) => void;
  onOpenSalarySlipModal?: (staff: StaffMember) => void;
  onTerminateStaff: (staffId: string) => void;
  allAttendance?: Record<string, AttendanceRecord[]>;
  onUpdateAttendance?: (
    date: string,
    status: AttendanceStatus,
    checkInTime?: string,
    remarks?: string
  ) => void;
  holidays?: HolidayRecord[];
}

export const StaffDetailsView: React.FC<StaffDetailsViewProps> = ({
  staff,
  onBack,
  onNavigateOverview,
  onUpdateStaff,
  onOpenEditModal,
  onOpenIdCardModal,
  onOpenPayModal,
  onOpenSalarySlipModal,
  onTerminateStaff,
  allAttendance = {},
  onUpdateAttendance,
  holidays = []
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'salary' | 'attendance' | 'documents' | 'activities'>('transactions');
  
  // Modals inside details view
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState<'issue' | 'repay' | null>(null);
  const [previewDoc, setPreviewDoc] = useState<StaffDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [docUploadError, setDocUploadError] = useState<string>('');

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    setPreviewBlobUrl(null);
    if (previewDoc?.fileId) {
      getFile(previewDoc.fileId)
        .then(b => {
          if (active && b) {
            url = URL.createObjectURL(b);
            setPreviewBlobUrl(url);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [previewDoc]);

  // Search in tabs
  const [transactionSearch, setTransactionSearch] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');

  // Form states
  const [newDoc, setNewDoc] = useState<{ title: string; type: string; fileName: string; fileSize?: string; file?: File }>({
    title: '',
    type: 'CNIC Copy',
    fileName: ''
  });

  const [newActivity, setNewActivity] = useState<{ note: string; type: string; author: string }>({
    note: '',
    type: 'General Note',
    author: 'Admin'
  });

  const [loanAmount, setLoanAmount] = useState<number>(10000);
  const [loanReason, setLoanReason] = useState<string>('');

  const [newTransaction, setNewTransaction] = useState<{
    amount: number;
    reason: string;
    payment: string;
    type: string;
  }>({
    amount: 5000,
    reason: 'Advance payment',
    payment: 'Bank Transfer',
    type: 'Debit'
  });

  // Safe access to collections
  const documents: StaffDocument[] = staff.documents || [];
  const activities: StaffActivity[] = staff.activities || [];
  const transactions: StaffTransaction[] = staff.transactions || [];
  const loanBalance = staff.loanBalance || 0;

  // Payroll (PAYROLL_PLAN §3.5): salary history and disbursal now come from
  // the server payroll tables — records carry their own snapshot salary and
  // derived status; payments are written in one transaction with the ledger.
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [payrollPayments, setPayrollPayments] = useState<PayrollPayment[]>([]);
  const [payrollUnavailable, setPayrollUnavailable] = useState(false);
  const [isSalaryDisbursalPopupOpen, setIsSalaryDisbursalPopupOpen] = useState(false);
  const [selectedPopupPeriods, setSelectedPopupPeriods] = useState<string[]>([]);
  const [popupPaymentMethod, setPopupPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Cheque'>(
    staff.paymentMethod || 'Bank Transfer'
  );
  const [popupNotes, setPopupNotes] = useState('');
  const [popupBusy, setPopupBusy] = useState(false);
  const [popupError, setPopupError] = useState('');

  const loadPayroll = async () => {
    try {
      const data = await getStaffPayroll(staff.id);
      setPayrollRecords(data.records);
      setPayrollPayments(data.payments);
      setPayrollUnavailable(false);
    } catch {
      setPayrollUnavailable(true);
    }
  };

  useEffect(() => {
    if (activeTab === 'salary') void loadPayroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, staff.id]);

  const outstandingRecords = payrollRecords.filter(r => r.outstanding > 0);

  const handleOpenSalaryDisbursalPopup = () => {
    setPopupError('');
    setSelectedPopupPeriods(outstandingRecords.map(r => r.periodKey));
    setIsSalaryDisbursalPopupOpen(true);
  };

  const handleTogglePopupMonth = (periodKey: string) => {
    setSelectedPopupPeriods(prev =>
      prev.includes(periodKey) ? prev.filter(k => k !== periodKey) : [...prev, periodKey]
    );
  };

  const handleProceedToPayPopup = async () => {
    const chosen = payrollRecords.filter(r => selectedPopupPeriods.includes(r.periodKey) && r.outstanding > 0);
    if (chosen.length === 0) return;
    setPopupBusy(true);
    setPopupError('');
    try {
      const schoolSettings = getSchoolSettings();
      const paidByLabel = schoolSettings.principalName || schoolSettings.schoolName || 'Accounts Office';
      const result = await createBulkPayrollPayments({
        items: chosen.map(r => ({ recordId: r.id, remarks: popupNotes.trim() || undefined })),
        method: popupPaymentMethod,
        paidDate: localISODate(),
        createdBy: paidByLabel,
      });
      applyPayrollSync(result);
      const updated = result.staff.find(s => s.id === staff.id);
      if (updated) onUpdateStaff(updated);
      await loadPayroll();
      setPopupNotes('');
      setIsSalaryDisbursalPopupOpen(false);
    } catch (e) {
      setPopupError(e instanceof Error ? e.message : 'Payment failed — nothing was recorded');
    } finally {
      setPopupBusy(false);
    }
  };

  const handlePrintSlip = (record: PayrollRecord) => {
    const label = monthLabelFromKey(record.periodKey);
    const bd = buildSlipBreakdown(record, label, payrollPayments);
    generateMonthlyIndividualSlipsCombinedPdf([staff], label, staff.id, DEFAULT_SCHOOL, new Map([[staff.id, bd]]));
  };

  // Add Document Handler
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.title.trim()) return;
    if (docUploadError) return;

    let fileId: string | undefined;
    if (newDoc.file) {
      fileId = nextSequential('FILE');
      await putFile(fileId, newDoc.file);
    }

    const docItem: StaffDocument = {
      id: `doc-${Date.now()}`,
      title: newDoc.title.trim(),
      type: newDoc.type,
      fileName: newDoc.fileName || `${newDoc.title.replace(/\s+/g, '_')}.pdf`,
      fileSize: newDoc.fileSize || (newDoc.file ? `${(newDoc.file.size / (1024 * 1024)).toFixed(2)} MB` : '0.1 MB'),
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      fileId
    };

    const updatedDocuments = [docItem, ...documents];
    const logActivity: StaffActivity = {
      id: `act-${Date.now()}`,
      note: `Document added: "${docItem.title}" (${docItem.type}).`,
      date: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      author: 'Admin',
      type: 'Document'
    };

    onUpdateStaff({
      ...staff,
      documents: updatedDocuments,
      activities: [logActivity, ...activities]
    });

    setNewDoc({ title: '', type: 'CNIC Copy', fileName: '' });
    setDocUploadError('');
    setIsAddDocModalOpen(false);
  };

  // Delete Document Handler
  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    const target = documents.find(d => d.id === docId);
    if (target?.fileId) {
      try { await deleteFile(target.fileId); } catch {}
    }
    const updatedDocs = documents.filter(d => d.id !== docId);
    onUpdateStaff({
      ...staff,
      documents: updatedDocs
    });
  };

  // Add Activity Handler
  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.note.trim()) return;

    const actItem: StaffActivity = {
      id: `act-${Date.now()}`,
      note: newActivity.note.trim(),
      date: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      author: newActivity.author || 'Admin',
      type: newActivity.type
    };

    onUpdateStaff({
      ...staff,
      activities: [actItem, ...activities]
    });

    setNewActivity({ note: '', type: 'General Note', author: 'Admin' });
    setIsAddActivityModalOpen(false);
  };

  // Issue / Repay Loan Handler
  const handleLoanAction = (action: 'issue' | 'repay') => {
    if (loanAmount <= 0) return;
    const currentBal = staff.loanBalance || 0;
    const newBal = action === 'issue' ? currentBal + loanAmount : Math.max(0, currentBal - loanAmount);

    const transactionItem: StaffTransaction = {
      id: `txn-${Date.now()}`,
      createdBy: 'Admin (Finance)',
      amount: loanAmount,
      reason: loanReason || (action === 'issue' ? 'Staff Loan Advance' : 'Staff Loan Repayment'),
      payment: 'Bank Transfer',
      type: action === 'issue' ? 'Loan Advance' : 'Loan Repayment',
      createdAt: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    const logActivity: StaffActivity = {
      id: `act-${Date.now()}`,
      note: action === 'issue' 
        ? `Issued loan of ${loanAmount.toLocaleString()} PKR. New balance: ${newBal.toLocaleString()} PKR.`
        : `Received loan repayment of ${loanAmount.toLocaleString()} PKR. Remaining balance: ${newBal.toLocaleString()} PKR.`,
      date: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      author: 'Finance Office',
      type: 'Loan'
    };

    onUpdateStaff({
      ...staff,
      loanBalance: newBal,
      transactions: [transactionItem, ...transactions],
      activities: [logActivity, ...activities]
    });

    setIsLoanModalOpen(null);
    setLoanReason('');
  };

  // Add Custom Transaction Handler
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTransaction.amount <= 0) return;

    const txnItem: StaffTransaction = {
      id: `txn-${Date.now()}`,
      createdBy: 'Admin',
      amount: newTransaction.amount,
      reason: newTransaction.reason || 'Staff transaction',
      payment: newTransaction.payment,
      type: newTransaction.type,
      createdAt: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    onUpdateStaff({
      ...staff,
      transactions: [txnItem, ...transactions]
    });

    setIsAddTransactionModalOpen(false);
  };

  // Generate Experience Letter PDF
  const handleGenerateExperienceLetter = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // The certificate carries the school's REAL identity from Settings —
    // never a hard-coded name. Blank settings simply omit those lines.
    const certSettings = getSchoolSettings();
    const certSchoolName = certSettings.schoolName || '';

    // Institution Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(certSchoolName.toUpperCase(), pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Excellence in Education • Official Human Resources Department', pageWidth / 2, 26, { align: 'center' });
    doc.text('Ref: EXP-' + staff.id + '-' + new Date().getFullYear(), pageWidth / 2, 33, { align: 'center' });

    // Certificate Title
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('EXPERIENCE & SERVICE CERTIFICATE', pageWidth / 2, 60, { align: 'center' });

    // Underline
    doc.setDrawColor(2, 132, 199);
    doc.setLineWidth(1.5);
    doc.line(pageWidth / 2 - 50, 64, pageWidth / 2 + 50, 64);

    // Letter Body
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    const letterDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Date: ${letterDate}`, 20, 78);

    doc.setFont('helvetica', 'bold');
    doc.text('TO WHOM IT MAY CONCERN', 20, 92);

    doc.setFont('helvetica', 'normal');
    const introText = `This is to officially certify that ${staff.gender === 'Female' ? 'Ms./Mrs.' : 'Mr.'} ${staff.name.toUpperCase()}, ` +
      `bearing CNIC No. ${staff.cnic || 'N/A'} (Staff ID: ${staff.id}), has been an esteemed employee${certSchoolName ? ` of ${certSchoolName}` : ''} ` +
      `serving as ${staff.role} in the department of ${staff.department}.`;

    const splitIntro = doc.splitTextToSize(introText, pageWidth - 40);
    doc.text(splitIntro, 20, 104);

    const serviceText = `During the tenure starting from ${staff.joiningDate} to the present date, ${staff.name} has demonstrated exceptional professional competence, dedication, and integrity in carrying out designated instructional and administrative responsibilities.`;
    const splitService = doc.splitTextToSize(serviceText, pageWidth - 40);
    doc.text(splitService, 20, 126);

    const conductText = `We found ${staff.name} to be hardworking, punctual, and possessing exemplary interpersonal and pedagogical skills. Furthermore, the conduct and moral character of ${staff.name} has been commendable throughout the employment duration.`;
    const splitConduct = doc.splitTextToSize(conductText, pageWidth - 40);
    doc.text(splitConduct, 20, 148);

    const wishText = `We take this opportunity to appreciate the contributions rendered to this institution and wish ${staff.gender === 'Female' ? 'her' : 'him'} continued success and prosperity in all future career endeavors.`;
    const splitWish = doc.splitTextToSize(wishText, pageWidth - 40);
    doc.text(splitWish, 20, 170);

    // Signatures
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Authorized Signatory', 25, 225);
    doc.setFont('helvetica', 'normal');
    doc.text('Head of Human Resources', 25, 231);
    doc.text(certSchoolName, 25, 237);

    doc.setFont('helvetica', 'bold');
    doc.text('Principal / Director', pageWidth - 75, 225);
    doc.setFont('helvetica', 'normal');
    doc.text(certSchoolName, pageWidth - 75, 231);
    doc.text('Official Stamp & Seal', pageWidth - 75, 237);

    // Dotted signature lines
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(25, 220, 85, 220);
    doc.line(pageWidth - 75, 220, pageWidth - 15, 220);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      certSettings.schoolEmail
        ? `This document is electronically verified. For authenticity queries: ${certSettings.schoolEmail}`
        : 'This document is electronically verified.',
      pageWidth / 2, 280, { align: 'center' });

    doc.save(`Experience_Letter_${staff.id}_${staff.name.replace(/\s+/g, '_')}.pdf`);
  };

  const avatarBg = staff.avatarColor || getAvatarColor(staff.name);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Breadcrumb */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Staff Details
        </h1>
        <BreadcrumbTrail
          items={[
            { label: 'Overview', onClick: onNavigateOverview },
            { label: 'Staff', onClick: onBack },
            { label: staff.name }
          ]}
        />
      </div>

      {/* Profile Header Row with Monogram Avatar & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Profile Info */}
        <div className="flex items-center gap-4">
          {staff.photo ? (
            <img 
              src={staff.photo} 
              alt={staff.name} 
              className="w-16 h-16 rounded-full object-cover border-2 border-[#2b3952] shrink-0" 
            />
          ) : (
            <div className={`w-16 h-16 rounded-full ${avatarBg} text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-lg shadow-purple-900/30`}>
              {getInitials(staff.name)}
            </div>
          )}

          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                {staff.name}
              </h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                staff.status === 'Active'
                  ? 'bg-[#0e2c20] text-[#4ade80] border border-[#164e3b]'
                  : staff.status === 'Terminated'
                  ? 'bg-[#3b1218] text-[#f87171] border border-[#601a24]'
                  : 'bg-[#2b2413] text-[#facc15] border border-[#4a3b1a]'
              }`}>
                {staff.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {staff.role} <span className="text-slate-600">•</span> {staff.id}
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Salary Slip */}
          <button
            type="button"
            onClick={() => {
              if (onOpenSalarySlipModal) {
                onOpenSalarySlipModal(staff);
              } else {
                onOpenPayModal(staff);
              }
            }}
            className="h-8 px-3 rounded-lg bg-surface-19 hover:bg-surface-42 border border-[#222e44] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer box-border"
            id="btn-details-salary-slip"
          >
            <FileText className="w-3.5 h-3.5 text-slate-300" />
            <span>Salary Slip</span>
          </button>

          {/* Experience Letter */}
          <button
            type="button"
            onClick={handleGenerateExperienceLetter}
            className="h-8 px-3 rounded-lg bg-surface-19 hover:bg-surface-42 border border-[#222e44] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer box-border"
            id="btn-details-exp-letter"
          >
            <Mail className="w-3.5 h-3.5 text-slate-300" />
            <span>Experience Letter</span>
          </button>

          {/* ID Cards */}
          <button
            type="button"
            onClick={() => onOpenIdCardModal(staff)}
            className="h-8 px-3 rounded-lg bg-surface-19 hover:bg-surface-42 border border-[#222e44] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer box-border"
            id="btn-details-id-card"
          >
            <IdCard className="w-3.5 h-3.5 text-slate-300" />
            <span>ID Cards</span>
          </button>

          {/* Edit Detail */}
          <button
            type="button"
            onClick={() => onOpenEditModal(staff)}
            className="h-8 px-3 rounded-lg bg-surface-19 hover:bg-surface-42 border border-[#222e44] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer box-border"
            id="btn-details-edit"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-300" />
            <span>Edit Detail</span>
          </button>

          {/* Terminate */}
          <button
            type="button"
            onClick={() => {
              if (confirm(`Are you sure you want to terminate ${staff.name}? This will mark their status as Terminated.`)) {
                onTerminateStaff(staff.id);
              }
            }}
            className="h-8 px-3 rounded-lg bg-[#241014] hover:bg-[#33141a] border border-[#4d1f27] text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer box-border"
            id="btn-details-terminate"
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Terminate</span>
          </button>
        </div>
      </div>

      {/* Two Main Cards Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Card: Current balance / Loans */}
        <div className="bg-[#101724] border border-edge-4 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden shadow-xl min-h-[260px]">
          {/* Subtle background ambient blur */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-900/10 via-transparent to-transparent rounded-full pointer-events-none" />

          <div>
            <p className="text-xs font-medium text-slate-400">Current balance</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {loanBalance.toLocaleString()} PKR
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 cursor-pointer hover:text-white" />
            </div>
            {loanBalance > 0 && (
              <p className="text-xs text-amber-400 mt-1 font-medium">
                Active staff loan balance outstanding
              </p>
            )}
          </div>

          {/* Action pill buttons: Repay Loan & Issue Loan */}
          <div className="flex items-center gap-3 mt-8">
            <button
              type="button"
              onClick={() => setIsLoanModalOpen('repay')}
              className="px-4 py-2 rounded-full bg-surface-34 hover:bg-[#1f2b40] border border-[#25344d] text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
              id="btn-repay-loan"
            >
              <div className="w-5 h-5 rounded-full bg-slate-700/60 flex items-center justify-center text-slate-300">
                <Minus className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span>Repay Loan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLoanModalOpen('issue')}
              className="px-4 py-2 rounded-full bg-surface-34 hover:bg-[#1f2b40] border border-[#25344d] text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
              id="btn-issue-loan"
            >
              <div className="w-5 h-5 rounded-full bg-slate-700/60 flex items-center justify-center text-slate-300">
                <Plus className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span>Issue Loan</span>
            </button>
          </div>
        </div>

        {/* Right Card: Staff Information */}
        <div className="bg-[#101724] border border-edge-4 rounded-2xl p-6 shadow-xl relative">
          <div className="flex items-center justify-between pb-4 border-b border-surface-42">
            <h3 className="text-sm font-bold text-white tracking-tight">Staff Information</h3>
            <button
              type="button"
              onClick={() => onOpenEditModal(staff)}
              className="px-2.5 py-1 rounded-md bg-surface-32 hover:bg-[#1e2a3f] border border-edge-34 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              id="btn-edit-staff-info"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit Info</span>
            </button>
          </div>

          <div className="divide-y divide-surface-32 text-xs">
            {/* Full name */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Full name</span>
              </div>
              <span className="font-semibold text-slate-100">{staff.name}</span>
            </div>

            {/* Father Name */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Father Name</span>
              </div>
              <span className="font-semibold text-slate-100">{staff.fatherName || '—'}</span>
            </div>

            {/* WhatsApp Number */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>WhatsApp Number</span>
              </div>
              <span className="font-semibold text-slate-100">{staff.whatsapp || staff.phone}</span>
            </div>

            {/* Phone Number */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>Phone Number</span>
              </div>
              <span className="font-semibold text-slate-100">{staff.phone}</span>
            </div>

            {/* CNIC */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>CNIC</span>
              </div>
              <span className="font-mono font-semibold text-slate-100">{staff.cnic || '—'}</span>
            </div>

            {/* Pay */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                <span>Pay</span>
              </div>
              <span className="font-semibold text-slate-100">
                {staff.salary ? `${staff.salary.toLocaleString()} PKR` : '0 PKR'}
              </span>
            </div>

            {/* Joining Date */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Joining Date</span>
              </div>
              <span className="font-semibold text-slate-100">{staff.joiningDate}</span>
            </div>

            {/* Address */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Address</span>
              </div>
              <span className="font-semibold text-slate-100">{staff.address || '—'}</span>
            </div>

            {/* Note */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <StickyNote className="w-3.5 h-3.5 text-slate-500" />
                <span>Note</span>
              </div>
              <span className="font-semibold text-slate-100">{staff.notes || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Tabbed Panel */}
      <div className="bg-[#101724] border border-edge-4 rounded-2xl overflow-hidden shadow-xl">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-edge-4 px-5 bg-surface-7 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-3.5 px-4 text-xs font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'transactions'
                ? 'text-white border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Transactions
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('salary')}
            className={`py-3.5 px-4 text-xs font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'salary'
                ? 'text-white border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Salary History
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`py-3.5 px-4 text-xs font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'attendance'
                ? 'text-white border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Attendance
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-3.5 px-4 text-xs font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'text-white border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <span>Documents</span>
            {documents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#1e2a3e] text-[10px] text-slate-300 font-bold">
                {documents.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activities')}
            className={`py-3.5 px-4 text-xs font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'activities'
                ? 'text-white border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <span>Activities</span>
            {activities.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#1e2a3e] text-[10px] text-slate-300 font-bold">
                {activities.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Transactions */}
        {activeTab === 'transactions' && (
          <div className="p-5">
            {/* Filter row: Date range & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-[#141b27] border border-edge-14 text-xs text-slate-300 font-medium flex items-center gap-2 cursor-pointer hover:bg-[#1a2332]"
                >
                  <span>01 - 11 Sep 2026</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={transactionSearch}
                    onChange={(e) => setTransactionSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-[#141b27] border border-edge-14 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddTransactionModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#141b27] hover:bg-surface-45 border border-edge-14 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>Add Transaction</span>
              </button>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto border border-edge-4 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-surface-7 border-b border-edge-4 text-[11px] font-semibold text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Created By</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Document</th>
                    <th className="py-3 px-4">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-32 text-xs">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400">
                        <p className="text-sm font-semibold text-slate-300">No data</p>
                      </td>
                    </tr>
                  ) : (
                    transactions
                      .filter(t => 
                        !transactionSearch || 
                        t.reason.toLowerCase().includes(transactionSearch.toLowerCase()) || 
                        t.type.toLowerCase().includes(transactionSearch.toLowerCase())
                      )
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-surface-19 transition-colors">
                          <td className="py-3 px-4 text-slate-300 font-medium">{t.createdBy}</td>
                          <td className="py-3 px-4 font-bold text-white">{t.amount.toLocaleString()} PKR</td>
                          <td className="py-3 px-4 text-slate-300">{t.reason}</td>
                          <td className="py-3 px-4 text-slate-400">{t.payment}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                              t.type.includes('Loan') 
                                ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50' 
                                : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">{t.document || '—'}</td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">{t.createdAt}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Salary History */}
        {activeTab === 'salary' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Monthly Payroll Disbursements</h4>
                <p className="text-xs text-slate-400 mt-0.5">Historical salary records, allowances, and slips</p>
              </div>
              <div className="flex items-center gap-2">
                {outstandingRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenSalaryDisbursalPopup}
                    className="px-3.5 py-1.5 rounded-lg bg-[#192436] hover:bg-[#202e46] border border-edge-39 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Pay Outstanding ({outstandingRecords.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenPayModal(staff)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Pay Salary</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-edge-4 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[860px]">
                <thead className="bg-surface-7 border-b border-edge-4 text-[11px] font-semibold text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Month</th>
                    <th className="py-3 px-4">Basic Pay</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Net Payable</th>
                    <th className="py-3 px-4">Outstanding</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-32 text-xs">
                  {payrollUnavailable ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-amber-300">
                        Payroll requires the SchoolEx app server — salary history is stored in the app database and is not available in the browser-only demo.
                      </td>
                    </tr>
                  ) : payrollRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No payroll records yet. Prepare a month's payroll in Pay Staff to start this employee's salary history (older history can be imported there via “Import Legacy History”).
                      </td>
                    </tr>
                  ) : [...payrollRecords].reverse().map(record => {
                    const monthPayments = payrollPayments.filter(p => p.recordId === record.id);
                    const latest = monthPayments[0];
                    return (
                      <tr key={record.id} className="hover:bg-surface-19">
                        <td className="py-3 px-4 font-bold text-white">{monthLabelFromKey(record.periodKey)}</td>
                        <td className="py-3 px-4 text-slate-300">{record.baseSalary.toLocaleString()} PKR</td>
                        <td className="py-3 px-4 font-extrabold text-emerald-400">{record.paid.toLocaleString()} PKR</td>
                        <td className="py-3 px-4 text-slate-300">{record.due.toLocaleString()} PKR</td>
                        <td className={`py-3 px-4 font-semibold ${record.outstanding > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{record.outstanding.toLocaleString()} PKR</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            record.status === 'Paid'
                              ? 'bg-[#0e2c20] text-[#4ade80] border-[#164e3b]'
                              : record.status === 'Partial'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{latest ? latest.method : '—'}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{latest ? latest.paidDate : '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrintSlip(record)}
                            className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                          >
                            Print Slip
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Attendance (Live interactive attendance reflection) */}
        {activeTab === 'attendance' && (
          <div className="p-5">
            <MemberAttendanceSection
              memberId={staff.id}
              memberName={staff.name}
              memberType="staff"
              allAttendance={allAttendance}
              onUpdateStatus={(date, status, checkInTime, remarks) => {
                if (onUpdateAttendance) {
                  onUpdateAttendance(date, status, checkInTime, remarks);
                }
              }}
              holidays={holidays}
            />
          </div>
        )}

        {/* Tab 4: Documents (Requested by user) */}
        {activeTab === 'documents' && (
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Employee Documents</h4>
                <p className="text-xs text-slate-400 mt-0.5">Uploaded IDs, academic certificates, and employment contracts</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search documents..."
                    className="bg-[#141b27] border border-edge-14 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddDocModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  id="btn-add-document"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-edge-17 rounded-xl">
                <FileText className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <h5 className="text-sm font-semibold text-slate-300">No documents uploaded yet</h5>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Upload CNIC scans, academic transcripts, experience letters, and signed employment contracts.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddDocModalOpen(true)}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#192436] hover:bg-[#202e46] border border-edge-39 text-xs font-semibold text-slate-200 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Upload First Document</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents
                  .filter(d => !docSearch || d.title.toLowerCase().includes(docSearch.toLowerCase()) || d.type.toLowerCase().includes(docSearch.toLowerCase()))
                  .map((doc) => (
                    <div 
                      key={doc.id}
                      className="bg-surface-18 border border-edge-14 hover:border-[#2b3c56] rounded-xl p-4 flex flex-col justify-between transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-9 h-9 rounded-lg bg-blue-950/60 border border-blue-800/40 text-blue-400 flex items-center justify-center shrink-0">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1a2436] text-slate-300 border border-edge-31">
                          {doc.type}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h5 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                          {doc.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {doc.fileName} • {doc.fileSize || '1.2 MB'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Uploaded: {doc.uploadedAt}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-edge-4">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2436] transition-colors cursor-pointer"
                          title="Preview Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            let url: string | null = null;
                            if (doc.fileId) {
                              const blob = await getFile(doc.fileId).catch(() => undefined);
                              if (blob) url = URL.createObjectURL(blob);
                            } else if (doc.fileData) {
                              url = doc.fileData;
                            }
                            if (!url) {
                              const file = new Blob([`Official SchoolEx Document: ${doc.title}\nEmployee: ${staff.name} (${staff.id})\nType: ${doc.type}\nUploaded: ${doc.uploadedAt}`], {type: 'text/plain'});
                              url = URL.createObjectURL(file);
                            }
                            const element = document.createElement("a");
                            element.href = url;
                            element.download = doc.fileName;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                            if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url!), 1000);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2436] transition-colors cursor-pointer"
                          title="Download Document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Activities (Requested by user with note and date) */}
        {activeTab === 'activities' && (
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Staff Activity Log</h4>
                <p className="text-xs text-slate-400 mt-0.5">Chronological record of HR notes, evaluations, assignments, and updates</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    placeholder="Search activities..."
                    className="bg-[#141b27] border border-edge-14 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddActivityModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  id="btn-add-activity"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Activity</span>
                </button>
              </div>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-edge-17 rounded-xl">
                <Clock className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <h5 className="text-sm font-semibold text-slate-300">No activity notes recorded yet</h5>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Add supervisor notes, performance feedback, or HR updates.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddActivityModalOpen(true)}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#192436] hover:bg-[#202e46] border border-edge-39 text-xs font-semibold text-slate-200 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Log First Activity</span>
                </button>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-edge-17">
                {activities
                  .filter(a => !activitySearch || a.note.toLowerCase().includes(activitySearch.toLowerCase()) || (a.type || '').toLowerCase().includes(activitySearch.toLowerCase()))
                  .map((act) => (
                    <div key={act.id} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-edge-3 border-2 border-emerald-500 shadow-sm shadow-emerald-500/20" />

                      <div className="bg-surface-18 border border-edge-14 rounded-xl p-4 hover:border-[#2b3c56] transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                              {act.type || 'General Note'}
                            </span>
                            <span className="text-xs font-semibold text-slate-300">
                              By {act.author}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{act.date}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-200 leading-relaxed mt-2 whitespace-pre-wrap">
                          {act.note}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: Upload / Add Document */}
      {isAddDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-17 border border-[#223048] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-edge-7 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-800/40">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Upload Staff Document</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddDocModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Document Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDoc.title}
                  onChange={(e) => setNewDoc(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Master Degree Transcript, CNIC Copy"
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Document Category
                </label>
                <select
                  value={newDoc.type}
                  onChange={(e) => setNewDoc(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="CNIC Copy">CNIC Copy</option>
                  <option value="Contract">Employment Contract</option>
                  <option value="Educational Degree">Educational Degree</option>
                  <option value="Experience Certificate">Experience Certificate</option>
                  <option value="Resume/CV">Resume / CV</option>
                  <option value="Police Verification">Police Verification</option>
                  <option value="Other">Other Document</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Select File (PDF, DOCX, JPG, PNG)
                </label>
                <div className="border border-dashed border-[#263752] rounded-xl p-4 text-center bg-[#151e2e]">
                  <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-300 font-medium">Click to choose file or drag & drop</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Maximum size: 5MB</p>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          setDocUploadError('Document size must be under 5 MB.');
                          return;
                        }
                        setDocUploadError('');
                        setNewDoc(prev => ({
                          ...prev,
                          file,
                          fileName: file.name,
                          fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                          title: prev.title || file.name.replace(/\.[^/.]+$/, '')
                        }));
                      }
                    }}
                    className="mt-2 text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                  />
                  {docUploadError && (
                    <p className="text-xs text-rose-400 mt-1.5 font-medium">{docUploadError}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-edge-7">
                <button
                  type="button"
                  onClick={() => setIsAddDocModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 font-semibold hover:bg-surface-48"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                >
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Activity Note */}
      {isAddActivityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-17 border border-[#223048] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-edge-7 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Add Staff Activity Note</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddActivityModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddActivity} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Activity Type
                </label>
                <select
                  value={newActivity.type}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="General Note">General Note</option>
                  <option value="Performance Feedback">Performance Feedback</option>
                  <option value="Appraisal Review">Appraisal Review</option>
                  <option value="Leave Request">Leave Request</option>
                  <option value="Assignment / Role">Assignment / Role</option>
                  <option value="Disciplinary Note">Disciplinary Note</option>
                  <option value="Promotion">Promotion</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Activity Note <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={newActivity.note}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Write activity note, supervisor remarks, or details here..."
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Author / Logged By
                </label>
                <input
                  type="text"
                  value={newActivity.author}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, author: e.target.value }))}
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-edge-7">
                <button
                  type="button"
                  onClick={() => setIsAddActivityModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 font-semibold hover:bg-surface-48"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pay outstanding payroll months (API-backed, one transaction with the ledger) */}
      {isSalaryDisbursalPopupOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-17 border border-[#223048] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-edge-7 mb-4">
              <h3 className="text-base font-bold text-white">Pay Outstanding Salary — {staff.name}</h3>
              <button type="button" onClick={() => setIsSalaryDisbursalPopupOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-400">
                Pays the full outstanding amount of each selected month. The payment and the ledger
                expense are recorded together by the server — both or neither.
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {outstandingRecords.map(r => (
                  <label key={r.id} className="flex items-center justify-between gap-2 bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedPopupPeriods.includes(r.periodKey)}
                        onChange={() => handleTogglePopupMonth(r.periodKey)}
                        className="accent-emerald-500"
                      />
                      <span className="font-semibold text-slate-100">{monthLabelFromKey(r.periodKey)}</span>
                    </span>
                    <span className="text-amber-300 font-bold">{r.outstanding.toLocaleString()} PKR outstanding</span>
                  </label>
                ))}
                {outstandingRecords.length === 0 && (
                  <p className="text-slate-500">Nothing outstanding — all prepared months are fully paid.</p>
                )}
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Payment Method</label>
                <select
                  value={popupPaymentMethod}
                  onChange={e => setPopupPaymentMethod(e.target.value as 'Bank Transfer' | 'Cash' | 'Cheque')}
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Notes (optional)</label>
                <input
                  type="text" value={popupNotes} onChange={e => setPopupNotes(e.target.value)}
                  placeholder="e.g. Salary disbursement"
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {popupError && <p className="text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{popupError}</p>}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-edge-7">
                <button type="button" onClick={() => setIsSalaryDisbursalPopupOpen(false)} className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 font-semibold hover:bg-surface-48">
                  Cancel
                </button>
                <button
                  type="button" onClick={handleProceedToPayPopup}
                  disabled={popupBusy || selectedPopupPeriods.length === 0}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold cursor-pointer"
                >
                  {popupBusy ? 'Paying…' : 'Pay Selected Months'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Issue or Repay Loan */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-17 border border-[#223048] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-edge-7 mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${isLoanModalOpen === 'issue' ? 'bg-blue-950/60 text-blue-400' : 'bg-emerald-950/60 text-emerald-400'}`}>
                  {isLoanModalOpen === 'issue' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </div>
                <h3 className="text-base font-bold text-white">
                  {isLoanModalOpen === 'issue' ? 'Issue Staff Loan / Advance' : 'Record Loan Repayment'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsLoanModalOpen(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-surface-32 border border-surface-48">
                <span className="text-slate-400">Current Loan Balance:</span>{' '}
                <span className="font-bold text-white">{loanBalance.toLocaleString()} PKR</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Amount (PKR) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reason / Memo
                </label>
                <input
                  type="text"
                  value={loanReason}
                  onChange={(e) => setLoanReason(e.target.value)}
                  placeholder={isLoanModalOpen === 'issue' ? 'e.g. Medical emergency advance' : 'e.g. Monthly salary installment deduction'}
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-edge-7">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(null)}
                  className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 font-semibold hover:bg-surface-48"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleLoanAction(isLoanModalOpen)}
                  className={`px-4 py-2 rounded-lg text-white font-bold cursor-pointer ${
                    isLoanModalOpen === 'issue' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {isLoanModalOpen === 'issue' ? 'Issue Loan' : 'Confirm Repayment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Custom Transaction */}
      {isAddTransactionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-17 border border-[#223048] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-edge-7 mb-4">
              <h3 className="text-base font-bold text-white">Add Staff Transaction</h3>
              <button 
                type="button" 
                onClick={() => setIsAddTransactionModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Amount (PKR) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reason / Description <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTransaction.reason}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Fuel allowance reimbursement, bonus"
                  className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={newTransaction.type}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Debit">Debit</option>
                    <option value="Credit">Credit</option>
                    <option value="Allowance">Allowance</option>
                    <option value="Bonus">Bonus</option>
                    <option value="Deduction">Deduction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Payment Method
                  </label>
                  <select
                    value={newTransaction.payment}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, payment: e.target.value }))}
                    className="w-full bg-surface-32 border border-edge-31 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-edge-7">
                <button
                  type="button"
                  onClick={() => setIsAddTransactionModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 font-semibold hover:bg-surface-48"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                >
                  Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Document Preview */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-17 border border-[#223048] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-edge-7 mb-4">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">{previewDoc.title}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 rounded-xl bg-surface-32 border border-[#202e46] text-center space-y-3">
              {(previewBlobUrl || previewDoc.fileData) && /\.(png|jpe?g|webp|gif)$/i.test(previewDoc.fileName) ? (
                <img
                  src={previewBlobUrl || previewDoc.fileData}
                  alt={previewDoc.title}
                  className="max-h-56 mx-auto object-contain rounded-lg border border-edge-35"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white">{previewDoc.fileName}</p>
                <p className="text-xs text-slate-400 mt-0.5">Category: {previewDoc.type} • {previewDoc.fileSize || '1.2 MB'}</p>
                <p className="text-xs text-slate-500 mt-1">Uploaded On: {previewDoc.uploadedAt}</p>
              </div>
              <div className="p-3 bg-[#0f1522] rounded-lg text-xs text-slate-300 border border-[#1b273a] text-left font-mono">
                [Certified Document Record]<br/>
                Employee: {staff.name} ({staff.id})<br/>
                Verification Status: Verified by {getSchoolSettings().schoolName || 'School'} Human Resources
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-edge-7">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-lg bg-surface-41 text-slate-300 font-semibold hover:bg-surface-48"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
