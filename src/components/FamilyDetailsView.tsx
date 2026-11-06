import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  IdCard, 
  Edit3, 
  Phone, 
  User, 
  Calendar, 
  GraduationCap, 
  MapPin, 
  CreditCard, 
  Clock, 
  FileText, 
  Coins, 
  ShieldCheck,
  Building2,
  Users,
  MessageCircle,
  AlertCircle,
  UploadCloud,
  Award,
  Plus,
  Mail,
  BookOpen,
  UserX,
  Wallet,
  Stars,
  Repeat,
  Printer,
  FileCheck,
  CheckCircle2,
  X,
  Heart,
  Droplet,
  FileBadge,
  Sparkles,
  School,
  Percent,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus, HolidayRecord } from '../types';
import { getAvatarColor, getInitials } from '../data/initialStudents';
import { BreadcrumbTrail } from './BreadcrumbTrail';

export interface FamilyData {
  familyId: string;
  familyName: string;
  phone?: string;
  guardianCnic?: string;
  guardianOccupation?: string;
  motherName?: string;
  motherCnic?: string;
  motherOccupation?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  caste?: string;
  religion?: string;
  emergencyContact?: string;
  notes?: string;
  students: Student[];
  totalDue?: number;
  totalPaid?: number;
}

interface FamilyDetailsViewProps {
  family: FamilyData;
  onBack: () => void;
  onNavigateOverview?: () => void;
  onSelectStudent: (student: Student) => void;
  onOpenIdCardModal: (student: Student) => void;
  onUpdateStudent?: (updatedStudent: Student) => void;
  onUpdateFamily?: (updatedFamily: FamilyData) => void;
  allAttendance?: Record<string, AttendanceRecord[]>;
}

type TabType = 
  | 'family-info'
  | 'enrolled-students'
  | 'fee-timeline'
  | 'transactions'
  | 'fines'
  | 'recurring-payments'
  | 'attendance'
  | 'observations'
  | 'documents';

export const FamilyDetailsView: React.FC<FamilyDetailsViewProps> = ({
  family,
  onBack,
  onNavigateOverview,
  onSelectStudent,
  onOpenIdCardModal,
  onUpdateStudent,
  onUpdateFamily,
  allAttendance = {}
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('family-info');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isEditFamilyOpen, setIsEditFamilyOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isAddFineOpen, setIsAddFineOpen] = useState(false);
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [isLetterPadOpen, setIsLetterPadOpen] = useState(false);
  const [isAddObservationOpen, setIsAddObservationOpen] = useState(false);
  const [isPrintVoucherOpen, setIsPrintVoucherOpen] = useState(false);

  // Form states for modals
  const [formFamilyName, setFormFamilyName] = useState(family.familyName);
  const [formGuardianCnic, setFormGuardianCnic] = useState(family.guardianCnic || '7647646475');
  const [formPhone, setFormPhone] = useState(family.phone || '03356226026');
  const [formWhatsapp, setFormWhatsapp] = useState(family.whatsapp || family.phone || '03356226026');
  const [formEmail, setFormEmail] = useState(family.email || 'dfghgfd456@gmail.com');
  const [formAddress, setFormAddress] = useState(family.address || 'House #14, Sector G-10, Islamabad');
  const [formOccupation, setFormOccupation] = useState(family.guardianOccupation || 'Business');
  const [formMotherName, setFormMotherName] = useState(family.motherName || '-');
  const [formMotherCnic, setFormMotherCnic] = useState(family.motherCnic || '-');
  const [formMotherOccupation, setFormMotherOccupation] = useState(family.motherOccupation || 'Homemaker');
  const [formCaste, setFormCaste] = useState(family.caste || '-');
  const [formReligion, setFormReligion] = useState(family.religion || 'Islam');

  // Fine form
  const [fineTitle, setFineTitle] = useState('Late Fee Clearance');
  const [fineAmount, setFineAmount] = useState('1000');
  const [fineStudentId, setFineStudentId] = useState(family.students[0]?.id || '');

  // Recurring payment
  const [recurringTitle, setRecurringTitle] = useState('Monthly Van Transport');
  const [recurringAmount, setRecurringAmount] = useState('5000');

  // Document form
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('Family B-Form');

  // Observation form
  const [observationText, setObservationText] = useState('Guardian attended mid-term parent-teacher conference. Satisfied with overall progress.');

  // Letter pad
  const [letterSubject, setLetterSubject] = useState('Parent Notification & Fee Summary');
  const [letterBody, setLetterBody] = useState(
    `Dear Guardian ${family.familyName},\n\nThis is an official communication regarding the enrollment and academic standing of your children (${family.students.map(s => `${s.name} - ${s.class}`).join(', ')}). We appreciate your continued partnership with our institution.`
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Financial aggregates
  const financialTotals = useMemo(() => {
    const totalDue = family.students.reduce((sum, s) => sum + (s.totalDue ?? 0), 0);
    const totalPaid = family.students.reduce((sum, s) => sum + (s.totalPaid ?? 40000), 0);
    return {
      totalDueFormatted: `${totalDue.toLocaleString()} PKR`,
      totalPaidFormatted: `${totalPaid.toLocaleString()} PKR`,
      totalDue,
      totalPaid
    };
  }, [family.students]);

  // Display name format: e.g. "gulzar, (F0080)"
  const displayName = `${family.familyName}, (${family.familyId})`;

  const handleSaveFamily = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: FamilyData = {
      ...family,
      familyName: formFamilyName,
      guardianCnic: formGuardianCnic,
      phone: formPhone,
      whatsapp: formWhatsapp,
      email: formEmail,
      address: formAddress,
      guardianOccupation: formOccupation,
      motherName: formMotherName,
      motherCnic: formMotherCnic,
      motherOccupation: formMotherOccupation,
      caste: formCaste,
      religion: formReligion
    };

    if (onUpdateFamily) {
      onUpdateFamily(updated);
    }
    // Also update all students in this family
    if (onUpdateStudent) {
      family.students.forEach(s => {
        onUpdateStudent({
          ...s,
          family: formFamilyName,
          guardianCnic: formGuardianCnic,
          phone: formPhone,
          whatsapp: formWhatsapp,
          email: formEmail,
          address: formAddress,
          guardianOccupation: formOccupation,
          motherName: formMotherName,
          motherCnic: formMotherCnic,
          motherOccupation: formMotherOccupation,
          caste: formCaste,
          religion: formReligion
        });
      });
    }

    showToast(`Family ${formFamilyName} updated successfully`);
    setIsEditFamilyOpen(false);
  };

  const handleAddFine = () => {
    const amt = parseInt(fineAmount) || 0;
    const targetStudent = family.students.find(s => s.id === fineStudentId) || family.students[0];
    if (targetStudent && onUpdateStudent) {
      const currentDue = targetStudent.totalDue || 0;
      const updatedFines = targetStudent.finesList || [];
      const newFine = {
        id: `FN-${Date.now()}`,
        title: fineTitle,
        amount: amt,
        date: new Date().toISOString().split('T')[0],
        status: 'Unpaid' as const
      };
      onUpdateStudent({
        ...targetStudent,
        totalDue: currentDue + amt,
        finesList: [newFine, ...updatedFines]
      });
    }
    showToast(`Fine of ${amt} PKR added for family`);
    setIsAddFineOpen(false);
  };

  const handleAddRecurring = () => {
    showToast(`Recurring schedule "${recurringTitle}" activated for family`);
    setIsAddRecurringOpen(false);
  };

  const handleUploadDoc = () => {
    const newDoc = {
      id: `DOC-${Date.now()}`,
      title: docTitle || `${docType} Document`,
      type: docType,
      date: new Date().toISOString().split('T')[0]
    };
    const firstStudent = family.students[0];
    if (firstStudent && onUpdateStudent) {
      const currentDocs = firstStudent.documentsList || [];
      onUpdateStudent({
        ...firstStudent,
        documentsList: [newDoc, ...currentDocs]
      });
    }
    showToast(`Document "${newDoc.title}" uploaded`);
    setIsUploadDocOpen(false);
    setDocTitle('');
  };

  const handleAddObservation = () => {
    const newObs = {
      id: `OBS-${Date.now()}`,
      note: observationText,
      author: 'Principal / Admin',
      date: new Date().toISOString().split('T')[0]
    };
    const firstStudent = family.students[0];
    if (firstStudent && onUpdateStudent) {
      const currentObs = firstStudent.observationsList || [];
      onUpdateStudent({
        ...firstStudent,
        observationsList: [newObs, ...currentObs]
      });
    }
    showToast(`Family observation recorded`);
    setIsAddObservationOpen(false);
    setObservationText('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 text-slate-100 animate-in fade-in duration-150 select-none">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#14261f] border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TOP HEADER & BREADCRUMBS                              */}
      {/* ======================================================== */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Family Detail
        </h1>
        <BreadcrumbTrail
          items={[
            { label: 'Overview', onClick: onNavigateOverview },
            { label: 'Students', onClick: onBack },
            { label: displayName }
          ]}
        />
      </div>

      {/* ======================================================== */}
      {/* 2. FAMILY IDENTITY BANNER & ACTIONS                    */}
      {/* ======================================================== */}
      <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-5 mb-5 shadow-xl">
        <div className="flex flex-col gap-4">
          
          {/* Top Row: Picture/Logo + Name + Family ID */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-700 via-indigo-600 to-sky-500 text-white font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-lg border-2 border-white/10 tracking-tight"
              id="family-profile-avatar"
            >
              {getInitials(family.familyName) || 'F('}
            </div>

            <div className="flex flex-col">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight capitalize">
                {displayName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-purple-400 font-mono tracking-wider">
                  {family.familyId}
                </span>
                <span className="text-slate-600">•</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                  {family.students.length} {family.students.length === 1 ? 'Student Enrolled' : 'Students Enrolled'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Features Row (Directly matching style of student profile action bar) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#182335]">
            
            {/* 1. Edit Family */}
            <button
              type="button"
              onClick={() => setIsEditFamilyOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-edit-family"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-400" />
              <span>Edit Family</span>
            </button>

            {/* 2. Send WhatsApp */}
            <button
              type="button"
              onClick={() => setIsWhatsAppOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#0e271c] hover:bg-[#123525] border border-[#25D366]/40 text-[#25D366] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-send-whatsapp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              <span>Send WhatsApp</span>
            </button>

            {/* 3. Add Fine */}
            <button
              type="button"
              onClick={() => setIsAddFineOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-add-fine"
            >
              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Add Fine</span>
            </button>

            {/* 4. Add Recurring Payment */}
            <button
              type="button"
              onClick={() => setIsAddRecurringOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-add-recurring"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Add Recurring Payment</span>
            </button>

            {/* 5. Upload Document */}
            <button
              type="button"
              onClick={() => setIsUploadDocOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-upload-doc"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-400" />
              <span>Upload Document</span>
            </button>

            {/* 6. Family Fee Voucher */}
            <button
              type="button"
              onClick={() => setIsPrintVoucherOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-print-voucher"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Family Fee Voucher</span>
            </button>

            {/* 7. Create Letter Pad */}
            <button
              type="button"
              onClick={() => setIsLetterPadOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-letter-pad"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Create Letter Pad</span>
            </button>

            {/* 8. Add Observation */}
            <button
              type="button"
              onClick={() => setIsAddObservationOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ml-auto"
              id="btn-feature-add-observation"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>Add Observation</span>
            </button>

          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. KPI FINANCIAL SUMMARY CARDS (MATCHING REFERENCE)     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        
        {/* Total Due Card */}
        <div 
          className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-lg"
          id="kpi-card-total-due"
        >
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {financialTotals.totalDueFormatted}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              Total Due (All Children)
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#2a171a] border border-[#4d2328] flex items-center justify-center text-red-400 shadow-inner">
            <Stars className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* Total Paid Card */}
        <div 
          className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-lg"
          id="kpi-card-total-paid"
        >
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {financialTotals.totalPaidFormatted}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              Total Paid (Cumulative)
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#0e271d] border border-[#174633] flex items-center justify-center text-emerald-400 shadow-inner">
            <Wallet className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 4. NAVIGATION TABS BAR                                   */}
      {/* ======================================================== */}
      <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-1.5 mb-5 flex items-center overflow-x-auto gap-1 shadow-md">
        
        <button
          type="button"
          onClick={() => setActiveTab('family-info')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'family-info'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-family-info"
        >
          Family Info
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('enrolled-students')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'enrolled-students'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-enrolled-students"
        >
          <span>Enrolled Students</span>
          <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px]">
            {family.students.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fee-timeline')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'fee-timeline'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-fee-timeline"
        >
          Fee Timeline
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-transactions"
        >
          Transactions
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fines')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'fines'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-fines"
        >
          Fines
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recurring-payments')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'recurring-payments'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-recurring-payments"
        >
          Recurring Payments
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-attendance"
        >
          Attendance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('observations')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'observations'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-observations"
        >
          Observations
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-documents"
        >
          Documents
        </button>

      </div>

      {/* ======================================================== */}
      {/* 5. TAB CONTENT PANELS                                    */}
      {/* ======================================================== */}

      {/* TAB 1: FAMILY INFO (3 CONTAINERS MATCHING REFERENCE) */}
      {activeTab === 'family-info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          
          {/* CONTAINER 1: ABOUT GUARDIAN */}
          <div 
            className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col"
            id="container-about-guardian"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#182335] mb-3.5">
              <h3 className="text-sm font-bold text-white">
                About Guardian
              </h3>
              <button
                type="button"
                onClick={() => setIsEditFamilyOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#141e2f] hover:bg-[#1c2a42] border border-[#22344f] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                id="btn-edit-about-guardian"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                <span>Edit</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setIsPrintVoucherOpen(true)}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#141e2f] hover:bg-[#1b2940] border border-[#22334e] text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                id="btn-guardian-voucher"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Print Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setIsLetterPadOpen(true)}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#141e2f] hover:bg-[#1b2940] border border-[#22334e] text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                id="btn-guardian-letter"
              >
                <FileBadge className="w-3.5 h-3.5 text-slate-400" />
                <span>Letter Pad</span>
              </button>
            </div>

            {/* Information Rows */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Family ID</span>
                </div>
                <span className="text-purple-400 font-mono font-medium">{family.familyId}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guardian Name</span>
                </div>
                <span className="text-slate-200 font-medium capitalize">{family.familyName}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guardian CNIC</span>
                </div>
                <span className="text-slate-200 font-medium font-mono">{family.guardianCnic || '7647646475'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guardian Occupation</span>
                </div>
                <span className="text-slate-200 font-medium">{family.guardianOccupation || 'lbr'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Heart className="w-3.5 h-3.5 text-slate-500" />
                  <span>Religion</span>
                </div>
                <span className="text-slate-200 font-medium">{family.religion || 'Islam'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Caste</span>
                </div>
                <span className="text-slate-200 font-medium">{family.caste || '-'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Emergency Contact</span>
                </div>
                <span className="text-slate-200 font-medium font-mono">{family.phone || '03356226026'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 text-slate-400">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Note</span>
                </div>
                <span className="text-slate-200 font-medium">{family.notes || 'Verified Household'}</span>
              </div>
            </div>
          </div>

          {/* CONTAINER 2: MOTHER & HOUSEHOLD */}
          <div 
            className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col"
            id="container-mother-household"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#182335] mb-4">
              <h3 className="text-sm font-bold text-white">
                Mother & Household
              </h3>
              <button
                type="button"
                onClick={() => setIsEditFamilyOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#141e2f] hover:bg-[#1c2a42] border border-[#22344f] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                id="btn-edit-mother"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                <span>Edit</span>
              </button>
            </div>

            {/* Information Rows */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mother Name</span>
                </div>
                <span className="text-slate-200 font-medium">{family.motherName || '-'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mother CNIC</span>
                </div>
                <span className="text-slate-200 font-medium font-mono">{family.motherCnic || '-'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mother Occupation</span>
                </div>
                <span className="text-slate-200 font-medium">{family.motherOccupation || 'Homemaker'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                  <span>Enrolled Children</span>
                </div>
                <span className="text-purple-300 font-semibold">{family.students.length} Students</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Account Established</span>
                </div>
                <span className="text-slate-200 font-medium">{family.students[0]?.admissionDate || '15/06/2026'}</span>
              </div>
            </div>
          </div>

          {/* CONTAINER 3: CONTACT & RESIDENCE */}
          <div 
            className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col"
            id="container-contact-residence"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#182335] mb-4">
              <h3 className="text-sm font-bold text-white">
                Contact & Residence
              </h3>
              <button
                type="button"
                onClick={() => setIsEditFamilyOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#141e2f] hover:bg-[#1c2a42] border border-[#22344f] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                id="btn-edit-contact"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                <span>Edit</span>
              </button>
            </div>

            {/* Information Rows */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Phone Number</span>
                </div>
                <span className="text-slate-200 font-medium font-mono">{family.phone || '03356226026'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>Whatsapp</span>
                </div>
                <span className="text-slate-200 font-medium font-mono">{family.whatsapp || family.phone || '03356226026'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Email</span>
                </div>
                <span className="text-slate-200 font-medium">{family.email || 'dfghgfd456@gmail.com'}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Address</span>
                </div>
                <span className="text-slate-200 font-medium text-right max-w-[180px] truncate" title={family.address}>
                  {family.address || '-'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 text-slate-400">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>City / Region</span>
                </div>
                <span className="text-slate-200 font-medium">Islamabad</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: ENROLLED STUDENTS */}
      {activeTab === 'enrolled-students' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Enrolled Students in this Family</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Click any student row to inspect their full student profile, attendance, and academics
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-semibold border border-purple-500/30">
              {family.students.length} Registered {family.students.length === 1 ? 'Student' : 'Students'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {family.students.map((student) => {
              const avatarBg = student.avatarColor || getAvatarColor(student.name);
              return (
                <div
                  key={student.id}
                  onClick={() => onSelectStudent(student)}
                  className="bg-[#141d2d] hover:bg-[#182336] border border-[#1f2b3e] hover:border-purple-500/50 rounded-xl p-4 transition-all duration-150 cursor-pointer group shadow-sm flex items-start justify-between gap-3"
                  id={`family-student-card-${student.id}`}
                >
                  <div className="flex items-center gap-3.5">
                    {student.photo ? (
                      <img
                        src={student.photo}
                        alt={student.name}
                        className="w-12 h-12 rounded-full object-cover border border-white/20 shrink-0 shadow"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow border border-white/10`}
                      >
                        {getInitials(student.name)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white group-hover:text-purple-300 transition-colors capitalize">
                          {student.name}
                        </h4>
                        <span className="text-xs text-sky-400 font-mono font-medium">
                          ({student.id})
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Class: <span className="text-slate-200 font-medium">{student.class}</span> • Section <span className="text-slate-200 font-semibold">{student.section}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {student.status || 'Active'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Fee: {student.classFee || '10,000 PKR'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onOpenIdCardModal(student)}
                      className="p-2 rounded-lg bg-[#1a2538] hover:bg-purple-600/20 text-slate-300 hover:text-purple-300 border border-[#27354d] text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="View ID Card"
                    >
                      <IdCard className="w-3.5 h-3.5" />
                      <span>ID Card</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectStudent(student)}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <span>Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: FEE TIMELINE */}
      {activeTab === 'fee-timeline' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Family Consolidated Fee Timeline</h3>
              <p className="text-slate-400 text-xs mt-0.5">Consolidated invoices and scheduled installments across all registered children</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPrintVoucherOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Consolidated Voucher</span>
            </button>
          </div>

          <div className="space-y-3">
            {[
              { title: 'September 2026 Tuition Fee (All Children)', due: `${(10000 * family.students.length).toLocaleString()} PKR`, status: 'Paid', date: '05 Sep 2026', receipt: 'FAM-8841' },
              { title: 'August 2026 Tuition Fee', due: `${(10000 * family.students.length).toLocaleString()} PKR`, status: 'Paid', date: '04 Aug 2026', receipt: 'FAM-7622' },
              { title: 'July 2026 Tuition Fee', due: `${(10000 * family.students.length).toLocaleString()} PKR`, status: 'Paid', date: '02 Jul 2026', receipt: 'FAM-6910' },
              { title: 'Registration & Annual Admission Charges', due: `${(10000 * family.students.length).toLocaleString()} PKR`, status: 'Paid', date: '15 Jun 2026', receipt: 'FAM-5401' }
            ].map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e] flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-100">{f.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Cleared on {f.date} • Reference: {f.receipt}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-white block text-sm">{f.due}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                    {f.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <h3 className="text-base font-bold text-white mb-1">Family Financial Transactions Ledger</h3>
          <p className="text-slate-400 text-xs mb-4">Complete audit trail of all receipts, bank deposits, and cash vouchers</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1b273b] text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-[#0c121e]">
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Children</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172234]">
                {[
                  { id: 'TXN-FAM-991', desc: 'Monthly Tuition Clearance', method: 'Cash Deposit', date: '05 Sep 2026', amt: '20,000 PKR' },
                  { id: 'TXN-FAM-882', desc: 'August Monthly Fee Clearance', method: 'Bank Transfer (Meezan)', date: '04 Aug 2026', amt: '20,000 PKR' },
                  { id: 'TXN-FAM-774', desc: 'July Tuition & Laboratory Fee', method: 'Online Portal', date: '02 Jul 2026', amt: '20,000 PKR' },
                  { id: 'TXN-FAM-660', desc: 'Annual Admission & Registration', method: 'Bank Voucher', date: '15 Jun 2026', amt: '20,000 PKR' }
                ].map((t) => (
                  <tr key={t.id} className="hover:bg-[#151e2f] transition-colors">
                    <td className="py-3 px-4 font-mono text-purple-400">{t.id}</td>
                    <td className="py-3 px-4 text-slate-200 font-medium">{t.desc}</td>
                    <td className="py-3 px-4 text-slate-300">{family.students.map(s => s.name).join(', ')}</td>
                    <td className="py-3 px-4 text-slate-400">{t.method}</td>
                    <td className="py-3 px-4 text-slate-400">{t.date}</td>
                    <td className="py-3 px-4 text-right font-bold text-white">{t.amt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: FINES */}
      {activeTab === 'fines' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Disciplinary & Administrative Fines</h3>
              <p className="text-slate-400 text-xs mt-0.5">Records of charges, late fee surcharges, and clearance status</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddFineOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Fine</span>
            </button>
          </div>

          <div className="p-8 text-center text-slate-400 bg-[#121927] rounded-xl border border-[#1e2739]">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-200">No Outstanding Fines</p>
            <p className="text-xs text-slate-500 mt-1">This family has cleared all administrative charges on time.</p>
          </div>
        </div>
      )}

      {/* TAB 6: RECURRING PAYMENTS */}
      {activeTab === 'recurring-payments' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Automated Recurring Charges</h3>
              <p className="text-slate-400 text-xs mt-0.5">Subscriptions for transport, food catering, laboratory, and sports clubs</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddRecurringOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Configure Subscription</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-100">School Van Transport Service</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Route #4 • Covers all {family.students.length} children • 1st of every month</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-white block text-sm">6,000 PKR / mo</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                Active
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Family Attendance Overview</h3>
              <p className="text-slate-400 text-xs mt-0.5">Attendance rates and status across all registered children</p>
            </div>
          </div>

          <div className="space-y-4">
            {family.students.map((student) => {
              const records = allAttendance[student.id] || [];
              const presents = records.filter(r => r.status === 'present').length;
              const totalDays = records.length || 1;
              const rate = Math.round((presents / totalDays) * 100);

              return (
                <div key={student.id} className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-900/40 text-blue-300 font-bold flex items-center justify-center text-xs">
                      {getInitials(student.name)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white capitalize">{student.name} ({student.id})</h4>
                      <p className="text-[11px] text-slate-400">{student.class} • Section {student.section}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-bold text-emerald-400 text-sm">96%</span>
                      <span className="text-[10px] text-slate-400 block">Attendance Rate</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectStudent(student)}
                      className="px-3 py-1.5 rounded-lg bg-[#1c283c] hover:bg-[#25354e] text-slate-200 text-xs font-medium cursor-pointer"
                    >
                      View Child Records
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 8: OBSERVATIONS */}
      {activeTab === 'observations' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Family & Parent Meeting Observations</h3>
              <p className="text-slate-400 text-xs mt-0.5">Official notes from guardian meetings, academic consultations, and phone interactions</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddObservationOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Observation</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-200">Parent-Teacher Conference Observation</span>
                <span className="text-[11px] text-slate-500">10 Sep 2026</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Guardian {family.familyName} visited the campus to review first-quarter results for all children. Expressed deep appreciation for faculty dedication and verified updated residential contact information.
              </p>
              <p className="text-[11px] text-slate-500 mt-2 italic">Recorded by: Administration Office</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Family Verified Documents</h3>
              <p className="text-slate-400 text-xs mt-0.5">National identity card copies, NADRA Family Registration Certificates, and affidavits</p>
            </div>
            <button
              type="button"
              onClick={() => setIsUploadDocOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { title: 'Guardian CNIC Front & Back Scans', type: 'CNIC Copy', date: '15 Jun 2026' },
              { title: 'NADRA Family Registration Certificate (FRC)', type: 'B-Form / FRC', date: '15 Jun 2026' },
              { title: 'Residential Utility Bill Affidavit', type: 'Address Proof', date: '18 Jun 2026' }
            ].map((doc, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-100">{doc.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{doc.type} • Uploaded on {doc.date}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => showToast(`Opening ${doc.title}`)}
                  className="px-2.5 py-1 rounded bg-[#1f2b3d] hover:bg-[#2a3a52] text-slate-300 text-[11px] cursor-pointer"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS                                                   */}
      {/* ======================================================== */}

      {/* MODAL 1: EDIT FAMILY */}
      {isEditFamilyOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#101726] border border-[#22334c] rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#1b273b] mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-purple-400" />
                <span>Edit Family Information</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsEditFamilyOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFamily} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Guardian / Family Name</label>
                  <input
                    type="text"
                    value={formFamilyName}
                    onChange={(e) => setFormFamilyName(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white font-medium focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Guardian CNIC</label>
                  <input
                    type="text"
                    value={formGuardianCnic}
                    onChange={(e) => setFormGuardianCnic(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Guardian Occupation</label>
                  <input
                    type="text"
                    value={formOccupation}
                    onChange={(e) => setFormOccupation(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Residential Address</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Mother Name</label>
                  <input
                    type="text"
                    value={formMotherName}
                    onChange={(e) => setFormMotherName(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Religion</label>
                  <input
                    type="text"
                    value={formReligion}
                    onChange={(e) => setFormReligion(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Caste</label>
                  <input
                    type="text"
                    value={formCaste}
                    onChange={(e) => setFormCaste(e.target.value)}
                    className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1b273b]">
                <button
                  type="button"
                  onClick={() => setIsEditFamilyOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#141d2b] hover:bg-[#1a2538] text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SEND WHATSAPP */}
      {isWhatsAppOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-[#22334c] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b273b] mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                <span>Send WhatsApp to Guardian</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsWhatsAppOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Guardian Phone Number</label>
                <input
                  type="text"
                  value={formWhatsapp}
                  readOnly
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Message Content</label>
                <textarea
                  rows={4}
                  defaultValue={`Dear ${family.familyName},\n\nThis is an official communication from School Administration regarding your children enrolled with us. Please feel free to reach out with any inquiries.`}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg p-3 text-white leading-relaxed focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1b273b] mt-4">
              <button
                type="button"
                onClick={() => setIsWhatsAppOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1a2538] text-slate-300 font-medium"
              >
                Cancel
              </button>
              <a
                href={`https://wa.me/${formWhatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  showToast('Redirecting to WhatsApp Web...');
                  setIsWhatsAppOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20b858] text-slate-950 font-bold flex items-center gap-1.5 shadow"
              >
                <span>Launch WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD FINE */}
      {isAddFineOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-[#22334c] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b273b] mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span>Add Fine to Family Account</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddFineOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Select Student</label>
                <select
                  value={fineStudentId}
                  onChange={(e) => setFineStudentId(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white"
                >
                  {family.students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Fine Reason / Title</label>
                <input
                  type="text"
                  value={fineTitle}
                  onChange={(e) => setFineTitle(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1b273b] mt-4">
              <button
                type="button"
                onClick={() => setIsAddFineOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1a2538] text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFine}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                Confirm Fine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD RECURRING PAYMENT */}
      {isAddRecurringOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-[#22334c] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b273b] mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-400" />
                <span>Add Recurring Payment</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddRecurringOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Service Title</label>
                <input
                  type="text"
                  value={recurringTitle}
                  onChange={(e) => setRecurringTitle(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Monthly Amount (PKR)</label>
                <input
                  type="number"
                  value={recurringAmount}
                  onChange={(e) => setRecurringAmount(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1b273b] mt-4">
              <button
                type="button"
                onClick={() => setIsAddRecurringOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1a2538] text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddRecurring}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: UPLOAD DOCUMENT */}
      {isUploadDocOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-[#22334c] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b273b] mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-400" />
                <span>Upload Family Document</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsUploadDocOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white"
                >
                  <option value="Family B-Form">Family B-Form</option>
                  <option value="Guardian CNIC">Guardian CNIC</option>
                  <option value="Residence Affidavit">Residence Affidavit</option>
                  <option value="Vaccination Record">Vaccination Record</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. NADRA Verified CNIC"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="border-2 border-dashed border-[#24344d] rounded-xl p-5 text-center bg-[#131b29]">
                <UploadCloud className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-slate-300 font-medium">Click to select or drag and drop file</p>
                <p className="text-[10px] text-slate-500 mt-1">PDF, JPG, PNG up to 10MB</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1b273b] mt-4">
              <button
                type="button"
                onClick={() => setIsUploadDocOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1a2538] text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadDoc}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                Upload File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: LETTER PAD */}
      {isLetterPadOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-[#22334c] rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b273b] mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <span>Create Official Letter Pad</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsLetterPadOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={letterSubject}
                  onChange={(e) => setLetterSubject(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg px-3 py-2 text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Letter Body</label>
                <textarea
                  rows={6}
                  value={letterBody}
                  onChange={(e) => setLetterBody(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg p-3 text-white leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1b273b] mt-4">
              <button
                type="button"
                onClick={() => setIsLetterPadOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1a2538] text-slate-300 font-medium"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setIsLetterPadOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Letter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: ADD OBSERVATION */}
      {isAddObservationOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101726] border border-[#22334c] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b273b] mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>Add Meeting Observation</span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddObservationOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Observation Remarks</label>
                <textarea
                  rows={4}
                  value={observationText}
                  onChange={(e) => setObservationText(e.target.value)}
                  className="w-full bg-[#162032] border border-[#24344d] rounded-lg p-3 text-white leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#1b273b] mt-4">
              <button
                type="button"
                onClick={() => setIsAddObservationOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1a2538] text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddObservation}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: CONSOLIDATED FAMILY FEE VOUCHER */}
      {isPrintVoucherOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95">
            
            {/* Action Bar (hidden in print) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6 print:hidden">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                <Printer className="w-4 h-4" />
                <span>Consolidated Family Fee Voucher</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintVoucherOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Content */}
            <div className="border-2 border-slate-800 p-6 rounded-xl space-y-4">
              {/* Header */}
              <div className="text-center pb-3 border-b-2 border-slate-800">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
                  Islamabad Model International School
                </h2>
                <p className="text-xs text-slate-600">Main Campus, Sector H-8/4, Islamabad • Ph: +92 51 9283741</p>
                <div className="inline-block mt-2 px-3 py-0.5 bg-slate-900 text-white font-bold text-[11px] rounded tracking-wider uppercase">
                  Consolidated Family Fee Bill • Month: Sep 2026
                </div>
              </div>

              {/* Family Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Family ID: <span className="font-bold text-slate-900 font-mono">{family.familyId}</span></p>
                  <p className="text-slate-500">Guardian Name: <span className="font-bold text-slate-900 capitalize">{family.familyName}</span></p>
                  <p className="text-slate-500">CNIC: <span className="font-bold text-slate-900 font-mono">{family.guardianCnic || '7647646475'}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Voucher No: <span className="font-bold text-slate-900 font-mono">VCH-2026-9081</span></p>
                  <p className="text-slate-500">Issue Date: <span className="font-bold text-slate-900">01 Sep 2026</span></p>
                  <p className="text-slate-500">Due Date: <span className="font-bold text-red-600 font-semibold">15 Sep 2026</span></p>
                </div>
              </div>

              {/* Students Fee Breakdown Table */}
              <div className="pt-2">
                <table className="w-full text-xs text-left border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Roll No</th>
                      <th className="py-2 px-3">Class</th>
                      <th className="py-2 px-3 text-right">Fee (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {family.students.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 px-3 font-semibold capitalize">{s.name}</td>
                        <td className="py-2 px-3 font-mono">{s.id}</td>
                        <td className="py-2 px-3">{s.class} ({s.section})</td>
                        <td className="py-2 px-3 text-right font-medium">{s.classFee || '10,000 PKR'}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td colSpan={3} className="py-2 px-3 text-right uppercase">Net Total Payable:</td>
                      <td className="py-2 px-3 text-right text-purple-700 text-sm">{financialTotals.totalPaidFormatted}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bank Payment Notes */}
              <div className="pt-2 border-t border-slate-300 text-[11px] text-slate-500 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-700">Bank Accounts for Payment:</p>
                  <p>Meezan Bank A/C: 0102-39847120938</p>
                  <p>HBL A/C: 0042-99812401823</p>
                </div>
                <div className="text-center">
                  <div className="w-32 h-10 border-b border-slate-400 mb-1" />
                  <span className="text-[10px] text-slate-500">Authorized Signature & Stamp</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
