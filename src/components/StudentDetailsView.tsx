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
  ArrowUpRight,
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
  ChevronRight
} from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus, HolidayRecord } from '../types';
import { getAvatarColor, getInitials } from '../data/initialStudents';
import { getStudentAvatar } from '../utils/studentAvatarHelper';
import { MemberAttendanceSection } from './MemberAttendanceSection';
import { BreadcrumbTrail } from './BreadcrumbTrail';

interface StudentDetailsViewProps {
  student: Student;
  onBack: () => void;
  onNavigateOverview?: () => void;
  onOpenEditModal: (student: Student) => void;
  onOpenIdCardModal: (student: Student) => void;
  onUpdateStudent?: (updatedStudent: Student) => void;
  allAttendance: Record<string, AttendanceRecord[]>;
  onUpdateAttendance?: (
    date: string,
    status: AttendanceStatus,
    checkInTime?: string,
    remarks?: string
  ) => void;
  holidays?: HolidayRecord[];
}

type TabType = 
  | 'student-info'
  | 'fee-timeline'
  | 'transactions'
  | 'fines'
  | 'recurring-payments'
  | 'attendance'
  | 'exams'
  | 'observations'
  | 'activities'
  | 'documents';

export const StudentDetailsView: React.FC<StudentDetailsViewProps> = ({
  student,
  onBack,
  onNavigateOverview,
  onOpenEditModal,
  onOpenIdCardModal,
  onUpdateStudent,
  allAttendance,
  onUpdateAttendance,
  holidays = []
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('student-info');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isAdmissionFormOpen, setIsAdmissionFormOpen] = useState(false);
  const [isChangeSectionOpen, setIsChangeSectionOpen] = useState(false);
  const [isPromoteClassOpen, setIsPromoteClassOpen] = useState(false);
  const [isChangeFamilyOpen, setIsChangeFamilyOpen] = useState(false);
  const [isAddFineOpen, setIsAddFineOpen] = useState(false);
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [isAddAchievementOpen, setIsAddAchievementOpen] = useState(false);
  const [isCharacterCertOpen, setIsCharacterCertOpen] = useState(false);
  const [isLetterPadOpen, setIsLetterPadOpen] = useState(false);
  const [isAddObservationOpen, setIsAddObservationOpen] = useState(false);
  const [isTerminateOpen, setIsTerminateOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  // Form states for modals
  const [newSection, setNewSection] = useState(student.section || 'A');
  const [newClass, setNewClass] = useState(student.class || 'Class 1');
  const [newFamilyId, setNewFamilyId] = useState(student.familyId || 'F0080');
  const [newGuardianName, setNewGuardianName] = useState(student.family || '');
  const [fineTitle, setFineTitle] = useState('Late Submission Fine');
  const [fineAmount, setFineAmount] = useState('500');
  const [recurringTitle, setRecurringTitle] = useState('Transport Monthly Fee');
  const [recurringAmount, setRecurringAmount] = useState('3000');
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('B-Form');
  const [achievementTitle, setAchievementTitle] = useState('1st Position in Science Fair');
  const [achievementCategory, setAchievementCategory] = useState('Academic');
  const [observationText, setObservationText] = useState('Excellent academic participation in class discussion.');
  const [terminationReason, setTerminationReason] = useState('Transferred to another school');
  const [letterSubject, setLetterSubject] = useState('Bonafide Student Certificate');
  const [letterBody, setLetterBody] = useState(
    `This is to certify that ${student.name}, son/daughter of ${student.family}, Roll No ${student.id}, is a bonafide student of this institution studying in ${student.class}, Section ${student.section || 'A'}. Their conduct and character have been consistently commendable.`
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Local student data fallback for profile fields
  const studentInfo = useMemo(() => {
    return {
      studentId: student.id,
      displayName: `${student.name}, (${student.id})`,
      guardian: student.family || 'gulzar',
      religion: student.religion || 'Islam',
      gender: student.gender || 'Female',
      dob: student.dob || '15/06/2007',
      cnic: student.cnic || '-',
      bloodGroup: student.bloodGroup || '-',
      discount: student.discount || 'None',
      admissionFee: typeof student.admissionFee === 'number' 
        ? `${student.admissionFee.toLocaleString()} PKR` 
        : student.admissionFee || '0 PKR',
      previousSchool: student.previousSchool || '-',
      previousClass: student.previousClass || '-',
      previousResult: student.previousResult || '-',
      reference: student.reference || '-',
      note: student.note || '-',
      // Class Container
      className: student.class || 'testing class',
      section: student.section || 'A',
      classFee: typeof student.classFee === 'number' 
        ? `${student.classFee.toLocaleString()} PKR` 
        : student.classFee || '10,000 PKR',
      admissionDate: student.admissionDate || '15/06/2026',
      // Family Container
      familyId: student.familyId || 'F0080',
      guardianCnic: student.guardianCnic || '7647646475',
      guardianOccupation: student.guardianOccupation || 'lbr',
      motherName: student.motherName || '-',
      motherCnic: student.motherCnic || '-',
      motherOccupation: student.motherOccupation || '-',
      phoneNumber: student.phone || '03356226026',
      whatsapp: student.whatsapp || student.phone || '03356226026',
      email: student.email || 'dfghgfd456@gmail.com',
      address: student.address || '-',
      caste: student.caste || '-',
      // KPIs
      totalDue: student.totalDue != null ? `${student.totalDue.toLocaleString()} PKR` : '0 PKR',
      totalPaid: student.totalPaid != null ? `${student.totalPaid.toLocaleString()} PKR` : '40,000 PKR'
    };
  }, [student]);

  // Handle updates
  const handleSaveSection = () => {
    if (onUpdateStudent) {
      onUpdateStudent({ ...student, section: newSection });
    }
    showToast(`Section changed to ${newSection}`);
    setIsChangeSectionOpen(false);
  };

  const handleSaveClass = () => {
    if (onUpdateStudent) {
      onUpdateStudent({ ...student, class: newClass, section: newSection });
    }
    showToast(`Student promoted to ${newClass}`);
    setIsPromoteClassOpen(false);
  };

  const handleSaveFamily = () => {
    if (onUpdateStudent) {
      onUpdateStudent({ ...student, familyId: newFamilyId, family: newGuardianName });
    }
    showToast(`Family updated to ${newFamilyId}`);
    setIsChangeFamilyOpen(false);
  };

  const handleAddFine = () => {
    const amt = parseInt(fineAmount) || 0;
    const currentDue = student.totalDue || 0;
    const updatedFines = student.finesList || [];
    const newFine = {
      id: `FN-${Date.now()}`,
      title: fineTitle,
      amount: amt,
      date: new Date().toISOString().split('T')[0],
      status: 'Unpaid' as const
    };
    if (onUpdateStudent) {
      onUpdateStudent({
        ...student,
        totalDue: currentDue + amt,
        finesList: [newFine, ...updatedFines]
      });
    }
    showToast(`Fine of ${amt} PKR added for ${student.name}`);
    setIsAddFineOpen(false);
  };

  const handleAddRecurring = () => {
    showToast(`Recurring payment "${recurringTitle}" configured`);
    setIsAddRecurringOpen(false);
  };

  const handleUploadDoc = () => {
    const newDoc = {
      id: `DOC-${Date.now()}`,
      title: docTitle || `${docType} Document`,
      type: docType,
      date: new Date().toISOString().split('T')[0]
    };
    const currentDocs = student.documentsList || [];
    if (onUpdateStudent) {
      onUpdateStudent({
        ...student,
        documentsList: [newDoc, ...currentDocs]
      });
    }
    showToast(`Document "${newDoc.title}" uploaded`);
    setIsUploadDocOpen(false);
    setDocTitle('');
  };

  const handleAddAchievement = () => {
    const newAch = {
      id: `ACH-${Date.now()}`,
      title: achievementTitle,
      category: achievementCategory,
      date: new Date().toISOString().split('T')[0]
    };
    const currentAch = student.achievementsList || [];
    if (onUpdateStudent) {
      onUpdateStudent({
        ...student,
        achievementsList: [newAch, ...currentAch]
      });
    }
    showToast(`Achievement recorded for ${student.name}`);
    setIsAddAchievementOpen(false);
  };

  const handleAddObservation = () => {
    const newObs = {
      id: `OBS-${Date.now()}`,
      note: observationText,
      author: 'Principal / Class Teacher',
      date: new Date().toISOString().split('T')[0]
    };
    const currentObs = student.observationsList || [];
    if (onUpdateStudent) {
      onUpdateStudent({
        ...student,
        observationsList: [newObs, ...currentObs]
      });
    }
    showToast(`Observation added for ${student.name}`);
    setIsAddObservationOpen(false);
    setObservationText('');
  };

  const handleTerminateStudent = () => {
    if (onUpdateStudent) {
      onUpdateStudent({
        ...student,
        status: 'Inactive',
        note: `Terminated on ${new Date().toISOString().split('T')[0]}: ${terminationReason}`
      });
    }
    showToast(`Student ${student.name} marked as Inactive / Terminated`);
    setIsTerminateOpen(false);
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
          Student Detail
        </h1>
        <BreadcrumbTrail
          items={[
            { label: 'Overview', onClick: onNavigateOverview },
            { label: 'Students', onClick: onBack },
            { label: studentInfo.displayName }
          ]}
        />
      </div>

      {/* ======================================================== */}
      {/* 2. STUDENT IDENTITY BANNER & ACTIONS (MATCHING PICTURE) */}
      {/* ======================================================== */}
      <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-5 mb-5 shadow-xl">
        <div className="flex flex-col gap-4">
          
          {/* Top Row: Picture/Logo + Name + Roll Number */}
          <div className="flex items-center gap-4">
            <img
              src={getStudentAvatar(student)}
              alt={student.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-700 shadow-md shrink-0 bg-[#0c121d]"
            />

            <div className="flex flex-col">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {studentInfo.displayName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onOpenEditModal(student)}
                  className="text-xs text-sky-400 hover:text-sky-300 font-mono underline cursor-pointer tracking-wider"
                  title="Click to view or edit student ID"
                >
                  {student.id}
                </button>
                {student.status === 'Inactive' && (
                  <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-400 text-[10px] font-bold border border-red-800/40">
                    Terminated / Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Features Row (10 feature buttons directly matching reference picture) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#182335]">
            
            {/* 1. Change Family */}
            <button
              type="button"
              onClick={() => setIsChangeFamilyOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-change-family"
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Change Family</span>
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

            {/* 6. Add Achievement */}
            <button
              type="button"
              onClick={() => setIsAddAchievementOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-add-achievement"
            >
              <Award className="w-3.5 h-3.5 text-slate-400" />
              <span>Add Achievement</span>
            </button>

            {/* 7. + Add Character Certificate */}
            <button
              type="button"
              onClick={() => setIsCharacterCertOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-add-certificate"
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              <span>Add Character Certificate</span>
            </button>

            {/* 8. Create Letter Pad */}
            <button
              type="button"
              onClick={() => setIsLetterPadOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-letter-pad"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Create Letter Pad</span>
            </button>

            {/* 9. Add Observation */}
            <button
              type="button"
              onClick={() => setIsAddObservationOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#141d2d] hover:bg-[#1a263a] border border-[#22334c] text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              id="btn-feature-add-observation"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>Add Observation</span>
            </button>

            {/* 10. Terminate */}
            <button
              type="button"
              onClick={() => setIsTerminateOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#261316] hover:bg-[#38161c] border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ml-auto"
              id="btn-feature-terminate"
            >
              <UserX className="w-3.5 h-3.5 text-red-400" />
              <span>Terminate</span>
            </button>

          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. KPI FINANCIAL SUMMARY CARDS (MATCHING PICTURE)       */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        
        {/* Total Due Card */}
        <div 
          className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-lg"
          id="kpi-card-total-due"
        >
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {studentInfo.totalDue}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              Total Due
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
              {studentInfo.totalPaid}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              Total Paid
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#0e271d] border border-[#174633] flex items-center justify-center text-emerald-400 shadow-inner">
            <Wallet className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 4. NAVIGATION TABS BAR (10 TABS AS IN PICTURE)           */}
      {/* ======================================================== */}
      <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-1.5 mb-5 flex items-center overflow-x-auto gap-1 shadow-md">
        
        <button
          type="button"
          onClick={() => setActiveTab('student-info')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'student-info'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-student-info"
        >
          Student Info
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
          onClick={() => setActiveTab('exams')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'exams'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-exams"
        >
          Exams
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
          onClick={() => setActiveTab('activities')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'activities'
              ? 'bg-[#1a273e] text-white shadow-sm border border-[#2c3f61]'
              : 'text-slate-400 hover:text-white hover:bg-[#141d2d]'
          }`}
          id="tab-activities"
        >
          Activities
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

      {/* TAB 1: STUDENT INFO (3 CONTAINERS: ABOUT, CLASS, FAMILY) */}
      {activeTab === 'student-info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          
          {/* ========================================= */}
          {/* CONTAINER 1: ABOUT                       */}
          {/* ========================================= */}
          <div 
            className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col"
            id="container-about-student"
          >
            {/* Header: Title + Edit Button */}
            <div className="flex items-center justify-between pb-3 border-b border-[#182335] mb-3.5">
              <h3 className="text-sm font-bold text-white">
                About
              </h3>
              <button
                type="button"
                onClick={() => onOpenEditModal(student)}
                className="px-2.5 py-1 rounded-lg bg-[#141e2f] hover:bg-[#1c2a42] border border-[#22344f] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                id="btn-edit-about"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                <span>Edit</span>
              </button>
            </div>

            {/* Quick Actions: Admission Form & ID Card */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setIsAdmissionFormOpen(true)}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#141e2f] hover:bg-[#1b2940] border border-[#22334e] text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                id="btn-about-admission-form"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Admission Form</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenIdCardModal(student)}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#141e2f] hover:bg-[#1b2940] border border-[#22334e] text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                id="btn-about-id-card"
              >
                <IdCard className="w-3.5 h-3.5 text-slate-400" />
                <span>ID Card</span>
              </button>
            </div>

            {/* Information Rows */}
            <div className="space-y-2.5 text-xs">
              
              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Student ID</span>
                </div>
                <span className="text-sky-400 font-mono font-medium">{studentInfo.studentId}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Name</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.displayName}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guardian</span>
                </div>
                <span className="text-slate-200 font-medium capitalize">{studentInfo.guardian}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Heart className="w-3.5 h-3.5 text-slate-500" />
                  <span>Religion</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.religion}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Gender</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.gender}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>DOB</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.dob}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>CNIC/B-Form</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.cnic}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Droplet className="w-3.5 h-3.5 text-slate-500" />
                  <span>Blood Group</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.bloodGroup}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Percent className="w-3.5 h-3.5 text-slate-500" />
                  <span>Discount</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.discount}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Coins className="w-3.5 h-3.5 text-slate-500" />
                  <span>Admission Fee</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.admissionFee}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <School className="w-3.5 h-3.5 text-slate-500" />
                  <span>Previous School</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.previousSchool}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                  <span>Previous Class</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.previousClass}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Award className="w-3.5 h-3.5 text-slate-500" />
                  <span>Previous Result</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.previousResult}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reference</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.reference}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 text-slate-400">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Note</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.note}</span>
              </div>

            </div>
          </div>

          {/* ========================================= */}
          {/* CONTAINER 2: CLASS                       */}
          {/* ========================================= */}
          <div 
            className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col"
            id="container-class-student"
          >
            {/* Header: Title + Change Section & Promote Class */}
            <div className="flex items-center justify-between pb-3 border-b border-[#182335] mb-4">
              <h3 className="text-sm font-bold text-white">
                Class
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangeSectionOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#141e2f] hover:bg-[#1c2a42] border border-[#22344f] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  id="btn-change-section"
                >
                  <Repeat className="w-3.5 h-3.5 text-slate-400" />
                  <span>Change Section</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPromoteClassOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#141e2f] hover:bg-[#1c2a42] border border-[#22344f] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  id="btn-promote-class"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>Promote Class</span>
                </button>
              </div>
            </div>

            {/* Information Rows */}
            <div className="space-y-3 text-xs">
              
              <div className="flex items-center justify-between py-2 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <School className="w-3.5 h-3.5 text-slate-500" />
                  <span>Class</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.className}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Section</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.section}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Coins className="w-3.5 h-3.5 text-slate-500" />
                  <span>Class Fee</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.classFee}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Admission Date</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.admissionDate}</span>
              </div>

            </div>
          </div>

          {/* ========================================= */}
          {/* CONTAINER 3: FAMILY                      */}
          {/* ========================================= */}
          <div 
            className="bg-[#101726] border border-[#1b273b] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col"
            id="container-family-student"
          >
            {/* Header: Title + Edit Button */}
            <div className="flex items-center justify-between pb-3 border-b border-[#182335] mb-4">
              <h3 className="text-sm font-bold text-white">
                Family
              </h3>
              <button
                type="button"
                onClick={() => setIsChangeFamilyOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#141e2f] hover:bg-[#1c2a42] border border-[#22344f] text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                id="btn-edit-family"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                <span>Edit</span>
              </button>
            </div>

            {/* Information Rows */}
            <div className="space-y-2.5 text-xs">
              
              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Family ID</span>
                </div>
                <span className="text-sky-400 font-mono font-medium">{studentInfo.familyId}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guardian Name</span>
                </div>
                <span className="text-slate-200 font-medium capitalize">{studentInfo.guardian}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guardian CNIC</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.guardianCnic}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Guardian Occupation</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.guardianOccupation}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mother Name</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.motherName}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mother CNIC</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.motherCnic}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mother Occupation</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.motherOccupation}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Phone Number</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.phoneNumber}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>Whatsapp</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.whatsapp}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Email</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.email}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-[#172234]">
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Address</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.address}</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Caste</span>
                </div>
                <span className="text-slate-200 font-medium">{studentInfo.caste}</span>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* TAB 2: FEE TIMELINE */}
      {activeTab === 'fee-timeline' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Fee Timeline & Installments</h3>
              <p className="text-slate-400 text-xs mt-0.5">Payment schedule, dues, and verified clearance receipts</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddRecurringOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
            >
              + Add Fee Entry
            </button>
          </div>

          <div className="space-y-4">
            {[
              { title: 'September 2026 Tuition Fee', due: '10,000 PKR', status: 'Paid', date: '05 Sep 2026', receipt: 'REC-8841' },
              { title: 'August 2026 Tuition Fee', due: '10,000 PKR', status: 'Paid', date: '04 Aug 2026', receipt: 'REC-7622' },
              { title: 'July 2026 Tuition Fee', due: '10,000 PKR', status: 'Paid', date: '02 Jul 2026', receipt: 'REC-6910' },
              { title: 'Admission & Registration Charge', due: '10,000 PKR', status: 'Paid', date: '15 Jun 2026', receipt: 'REC-5401' }
            ].map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e] flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-100">{f.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Cleared on {f.date} • Ref: {f.receipt}</p>
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

      {/* TAB 3: TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <h3 className="text-base font-bold text-white mb-1">Financial Transactions Ledger</h3>
          <p className="text-slate-400 text-xs mb-4">Complete audit trail of all receipts and invoices</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1b273b] text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-[#0c121e]">
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172234]">
                {[
                  { id: 'TXN-90412', desc: 'Monthly Tuition Clearance', method: 'Cash Deposit', date: '2026-09-05', amount: '10,000 PKR' },
                  { id: 'TXN-88123', desc: 'Term Examination & Lab Fee', method: 'Bank Transfer', date: '2026-08-10', amount: '5,000 PKR' },
                  { id: 'TXN-79401', desc: 'Annual Curriculum & Books', method: 'Cash Deposit', date: '2026-06-20', amount: '15,000 PKR' },
                  { id: 'TXN-75120', desc: 'New Enrollment Admission', method: 'Bank Transfer', date: '2026-06-15', amount: '10,000 PKR' }
                ].map(t => (
                  <tr key={t.id} className="hover:bg-[#141d2e] transition-colors">
                    <td className="py-3 px-4 font-mono text-sky-400">{t.id}</td>
                    <td className="py-3 px-4 text-slate-200 font-medium">{t.desc}</td>
                    <td className="py-3 px-4 text-slate-400">{t.method}</td>
                    <td className="py-3 px-4 text-slate-400">{t.date}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">+{t.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FINES */}
      {activeTab === 'fines' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Disciplinary & Late Fines</h3>
              <p className="text-slate-400 text-xs mt-0.5">Penalties, library fines, and policy violation records</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddFineOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer"
            >
              + Add Fine
            </button>
          </div>

          {(student.finesList && student.finesList.length > 0) ? (
            <div className="space-y-3">
              {student.finesList.map(f => (
                <div key={f.id} className="p-3.5 rounded-xl bg-[#141d2d] border border-[#1f2b3e] flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-100">{f.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Issued: {f.date} • ID: {f.id}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-red-400 block">{f.amount} PKR</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-300 text-[10px] font-bold border border-red-800/40">
                      {f.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <ShieldCheck className="w-10 h-10 text-emerald-500/60 mx-auto mb-2" />
              <p className="font-semibold text-slate-200">No active fines</p>
              <p className="text-xs text-slate-500 mt-1">This student has a clean record with zero outstanding penalties.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RECURRING PAYMENTS */}
      {activeTab === 'recurring-payments' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Recurring Payment Items</h3>
              <p className="text-slate-400 text-xs mt-0.5">Automated recurring billing elements generated each cycle</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddRecurringOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
            >
              + Configure Recurring
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">Standard Class Tuition</span>
                <span className="text-emerald-400 font-mono font-bold">10,000 PKR / mo</span>
              </div>
              <p className="text-slate-400 text-xs">Generated on 1st of every calendar month for {studentInfo.className}.</p>
            </div>

            <div className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">Dedicated Transport Fee</span>
                <span className="text-emerald-400 font-mono font-bold">3,000 PKR / mo</span>
              </div>
              <p className="text-slate-400 text-xs">Assigned Route 4 (Gulshan - Campus). Active status.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ATTENDANCE (SYNCHRONIZED WITH GLOBAL ATTENDANCE STATE) */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <MemberAttendanceSection
            memberId={student.id}
            memberName={student.name}
            memberType="student"
            allAttendance={allAttendance}
            onUpdateStatus={onUpdateAttendance}
            holidays={holidays}
            memberClass={student.class}
            memberSection={student.section}
          />
        </div>
      )}

      {/* TAB 7: EXAMS */}
      {activeTab === 'exams' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <h3 className="text-base font-bold text-white mb-1">Academic Examination Records</h3>
          <p className="text-slate-400 text-xs mb-5">Term results, percentage, GPA, and subject breakdown</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e]">
              <span className="text-slate-400 font-medium">Midterm Examination</span>
              <div className="text-xl font-bold text-white mt-1">472 / 500</div>
              <span className="text-emerald-400 text-xs font-semibold">94.4% • Grade A+</span>
            </div>
            <div className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e]">
              <span className="text-slate-400 font-medium">Class Rank</span>
              <div className="text-xl font-bold text-white mt-1">2nd Position</div>
              <span className="text-sky-400 text-xs font-semibold">Top 3% of Class</span>
            </div>
            <div className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e]">
              <span className="text-slate-400 font-medium">Cumulative GPA</span>
              <div className="text-xl font-bold text-white mt-1">3.92 / 4.00</div>
              <span className="text-emerald-400 text-xs font-semibold">Dean's Honor Roll</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1b273b] text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-[#0c121e]">
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4">Total Marks</th>
                  <th className="py-2.5 px-4">Obtained</th>
                  <th className="py-2.5 px-4">Grade</th>
                  <th className="py-2.5 px-4">Teacher Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172234]">
                {[
                  { subject: 'Mathematics', total: 100, obtained: 96, grade: 'A+', remark: 'Outstanding analytical skills' },
                  { subject: 'English Language', total: 100, obtained: 92, grade: 'A+', remark: 'Excellent comprehension' },
                  { subject: 'General Science', total: 100, obtained: 95, grade: 'A+', remark: 'Great lab performance' },
                  { subject: 'Social Studies', total: 100, obtained: 94, grade: 'A+', remark: 'Very thorough essays' },
                  { subject: 'Computer Science', total: 100, obtained: 95, grade: 'A+', remark: 'Passionate programmer' }
                ].map(s => (
                  <tr key={s.subject} className="hover:bg-[#141d2e] transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-200">{s.subject}</td>
                    <td className="py-2.5 px-4 text-slate-400">{s.total}</td>
                    <td className="py-2.5 px-4 font-bold text-white">{s.obtained}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                        {s.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{s.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: OBSERVATIONS */}
      {activeTab === 'observations' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Teacher & Counselor Observations</h3>
              <p className="text-slate-400 text-xs mt-0.5">Behavioral assessments, special notes, and mentor remarks</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddObservationOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
            >
              + Add Observation
            </button>
          </div>

          <div className="space-y-3">
            {[
              { note: 'Demonstrates exemplary leadership in student council and group projects.', author: 'Class Teacher', date: '2026-09-08' },
              { note: 'Consistently completes homework on time and helps peers with difficult topics.', author: 'Math Instructor', date: '2026-08-25' },
              ...(student.observationsList || [])
            ].map((o, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e]">
                <p className="text-slate-200 text-xs leading-relaxed font-medium">"{o.note}"</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-[#182335]">
                  <span>By: <strong className="text-slate-300">{o.author}</strong></span>
                  <span>{o.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: ACTIVITIES */}
      {activeTab === 'activities' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Extracurricular Activities & Achievements</h3>
              <p className="text-slate-400 text-xs mt-0.5">Clubs, sports tournaments, badges, and honors</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddAchievementOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
            >
              + Add Achievement
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'School Debate Team Captain', cat: 'Leadership', date: '2026-08-15' },
              { title: '1st Position in Inter-School Science Fair', cat: 'Academic', date: '2026-07-20' },
              { title: 'Annual Athletics 200m Sprint Gold Medal', cat: 'Sports', date: '2026-05-12' },
              ...(student.achievementsList || [])
            ].map((a, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#141d2d] border border-[#1f2b3e] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-100">{a.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{a.cat} • Awarded {a.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="bg-[#101726] border border-[#1b273b] rounded-2xl p-6 shadow-xl text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#182335] mb-5">
            <div>
              <h3 className="text-base font-bold text-white">Student Uploaded Documents</h3>
              <p className="text-slate-400 text-xs mt-0.5">Official digital archives, certificates, and scanned credentials</p>
            </div>
            <button
              type="button"
              onClick={() => setIsUploadDocOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
            >
              + Upload Document
            </button>
          </div>

          <div className="space-y-3">
            {[
              { title: 'Official Government B-Form (Nadra)', type: 'Identity Verification', date: '2026-06-15' },
              { title: 'Previous School Leaving Certificate', type: 'Academic Record', date: '2026-06-15' },
              { title: 'Medical Fitness & Vaccination Record', type: 'Health', date: '2026-06-16' },
              ...(student.documentsList || [])
            ].map((d, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-[#141d2d] border border-[#1f2b3e] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200">{d.title}</h4>
                    <p className="text-[11px] text-slate-400">{d.type} • Uploaded {d.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => showToast(`Downloading ${d.title}`)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MODALS                                                */}
      {/* ======================================================== */}

      {/* MODAL 1: OFFICIAL PRINTABLE ADMISSION FORM */}
      {isAdmissionFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col text-slate-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0b1120]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Student Official Admission Form</h3>
                  <p className="text-[11px] text-slate-400">Application #{student.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdmissionFormOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="p-6 rounded-xl bg-white text-slate-900 shadow-sm border border-slate-200">
                {/* School Header */}
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-4">
                  <h2 className="text-xl font-extrabold uppercase tracking-wider text-slate-900">
                    Genius Public Model School
                  </h2>
                  <p className="text-xs text-slate-600">Higher Secondary Education Campus • Estd. 1998</p>
                  <div className="mt-2 inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded">
                    Official Student Enrollment & Admission Record
                  </div>
                </div>

                {/* Top Section with DP Photo */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-700"><strong>Enrollment Number:</strong> {student.id}</p>
                    <p className="text-xs text-slate-700"><strong>Admission Date:</strong> {studentInfo.admissionDate}</p>
                    <p className="text-xs text-slate-700"><strong>Class Admitted:</strong> {studentInfo.className} (Sec {studentInfo.section})</p>
                    <p className="text-xs text-slate-700"><strong>Family Reg ID:</strong> {studentInfo.familyId}</p>
                  </div>
                  <div className="w-24 h-28 border-2 border-slate-300 rounded overflow-hidden flex items-center justify-center text-center bg-slate-50 text-[10px] text-slate-500 font-semibold shrink-0">
                    <img src={getStudentAvatar(student)} alt={student.name} className="w-full h-full object-cover" />
                  </div>
                </div>

                {/* Candidate Info Grid */}
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
                  1. Candidate Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div><strong>Full Name:</strong> {student.name}</div>
                  <div><strong>Father / Guardian:</strong> {studentInfo.guardian}</div>
                  <div><strong>Gender:</strong> {studentInfo.gender}</div>
                  <div><strong>Date of Birth:</strong> {studentInfo.dob}</div>
                  <div><strong>B-Form / CNIC:</strong> {studentInfo.cnic}</div>
                  <div><strong>Blood Group:</strong> {studentInfo.bloodGroup}</div>
                  <div><strong>Religion:</strong> {studentInfo.religion}</div>
                  <div><strong>Caste:</strong> {studentInfo.caste}</div>
                </div>

                {/* Parent & Contact Details */}
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
                  2. Parent & Contact Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div><strong>Father/Guardian CNIC:</strong> {studentInfo.guardianCnic}</div>
                  <div><strong>Occupation:</strong> {studentInfo.guardianOccupation}</div>
                  <div><strong>Primary Phone:</strong> {studentInfo.phoneNumber}</div>
                  <div><strong>WhatsApp:</strong> {studentInfo.whatsapp}</div>
                  <div><strong>Email Address:</strong> {studentInfo.email}</div>
                  <div><strong>Residential Address:</strong> {studentInfo.address}</div>
                </div>

                {/* Academic History */}
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
                  3. Previous School History
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs mb-6">
                  <div><strong>Previous Institution:</strong> {studentInfo.previousSchool}</div>
                  <div><strong>Previous Class:</strong> {studentInfo.previousClass}</div>
                  <div><strong>Exam Result / GPA:</strong> {studentInfo.previousResult}</div>
                  <div><strong>Reference Person:</strong> {studentInfo.reference}</div>
                </div>

                {/* Signature Row */}
                <div className="grid grid-cols-3 gap-4 pt-10 text-center text-xs border-t border-slate-300 text-slate-700">
                  <div>
                    <div className="border-t border-slate-500 pt-1">Parent / Guardian Signature</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-500 pt-1">Admission Incharge</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-500 pt-1">Principal Seal & Sign</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHANGE SECTION */}
      {isChangeSectionOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-sm shadow-2xl p-5 text-white">
            <h3 className="text-sm font-bold text-white mb-2">Change Class Section</h3>
            <p className="text-xs text-slate-400 mb-4">Select target section for {student.name}:</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {['A', 'B', 'C', 'D'].map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setNewSection(sec)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    newSection === sec
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                      : 'bg-[#141e2f] border-[#22334e] text-slate-300 hover:text-white'
                  }`}
                >
                  Sec {sec}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsChangeSectionOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSection}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                Save Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PROMOTE CLASS */}
      {isPromoteClassOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <h3 className="text-sm font-bold text-white mb-1">Promote Student Class</h3>
            <p className="text-xs text-slate-400 mb-4">Advance {student.name} to the next academic level:</p>
            
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Class</label>
                <select
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {['Playgroup', 'Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Section</label>
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {['A', 'B', 'C', 'D'].map(s => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPromoteClassOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveClass}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CHANGE FAMILY */}
      {isChangeFamilyOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <h3 className="text-sm font-bold text-white mb-1">Change Family & Guardian</h3>
            <p className="text-xs text-slate-400 mb-4">Reassign {student.name} to a family group:</p>
            
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Family ID</label>
                <input
                  type="text"
                  value={newFamilyId}
                  onChange={(e) => setNewFamilyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Guardian Name</label>
                <input
                  type="text"
                  value={newGuardianName}
                  onChange={(e) => setNewGuardianName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsChangeFamilyOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFamily}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                Update Family
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD FINE */}
      {isAddFineOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <h3 className="text-sm font-bold text-white mb-1">Add Student Fine</h3>
            <p className="text-xs text-slate-400 mb-4">Record fine for {student.name}:</p>
            
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Fine Reason / Title</label>
                <input
                  type="text"
                  value={fineTitle}
                  onChange={(e) => setFineTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddFineOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFine}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
              >
                Add Fine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: ADD RECURRING PAYMENT */}
      {isAddRecurringOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <h3 className="text-sm font-bold text-white mb-1">Add Recurring Payment Item</h3>
            <p className="text-xs text-slate-400 mb-4">Set up recurring charge for {student.name}:</p>
            
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Fee Item Title</label>
                <input
                  type="text"
                  value={recurringTitle}
                  onChange={(e) => setRecurringTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Monthly Amount (PKR)</label>
                <input
                  type="number"
                  value={recurringAmount}
                  onChange={(e) => setRecurringAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddRecurringOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddRecurring}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                Save Recurring Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: UPLOAD DOCUMENT */}
      {isUploadDocOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <h3 className="text-sm font-bold text-white mb-1">Upload Student Document</h3>
            <p className="text-xs text-slate-400 mb-4">Attach digital documents for {student.name}:</p>
            
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Document Category</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="B-Form">B-Form / CNIC Scanned</option>
                  <option value="Birth Certificate">Birth Certificate</option>
                  <option value="Leaving Certificate">School Leaving Certificate</option>
                  <option value="Medical Certificate">Medical & Health Record</option>
                  <option value="Character Certificate">Previous Character Certificate</option>
                  <option value="Other">Other Document</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Document Title / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Nadra Verified Copy"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="border-2 border-dashed border-[#22334e] rounded-xl p-6 text-center bg-[#111927]">
                <UploadCloud className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-xs text-slate-300 font-medium">Click or Drag & Drop file here</p>
                <p className="text-[10px] text-slate-500 mt-1">PDF, JPG, PNG up to 15MB</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsUploadDocOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadDoc}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                Attach Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: ADD ACHIEVEMENT */}
      {isAddAchievementOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <h3 className="text-sm font-bold text-white mb-1">Add Student Achievement</h3>
            <p className="text-xs text-slate-400 mb-4">Record honor for {student.name}:</p>
            
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Title</label>
                <input
                  type="text"
                  value={achievementTitle}
                  onChange={(e) => setAchievementTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={achievementCategory}
                  onChange={(e) => setAchievementCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Academic">Academic Honors</option>
                  <option value="Sports">Sports & Athletics</option>
                  <option value="Debate">Debate & Public Speaking</option>
                  <option value="Arts">Fine Arts & Crafts</option>
                  <option value="Leadership">Student Leadership</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddAchievementOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAchievement}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
              >
                Save Achievement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: OFFICIAL CHARACTER CERTIFICATE */}
      {isCharacterCertOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-100 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0b1120]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <FileBadge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Character & Conduct Certificate</h3>
                  <p className="text-[11px] text-slate-400">{student.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCharacterCertOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="p-8 rounded-xl bg-gradient-to-b from-amber-50/10 via-white to-amber-50/20 text-slate-900 border-4 border-double border-amber-600 shadow-md">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-serif font-black uppercase text-slate-900 tracking-wider">
                    Genius Public Model School
                  </h2>
                  <p className="text-xs text-slate-600 italic">Affiliated with Board of Intermediate & Secondary Education</p>
                  <div className="my-3 inline-block border-b-2 border-amber-600 pb-1 text-base font-serif font-bold tracking-widest uppercase text-amber-900">
                    Character Certificate
                  </div>
                </div>

                <div className="space-y-4 text-xs leading-relaxed font-serif text-slate-800 text-justify">
                  <p>
                    This is to certify that <strong>{student.name}</strong>, son/daughter of <strong>{student.family}</strong>, residing at {studentInfo.address || 'Local Campus Resident'}, is a bonafide student of this institution bearing Enrollment ID <strong>{student.id}</strong> in <strong>{student.class}</strong>, Section <strong>{student.section || 'A'}</strong>.
                  </p>
                  <p>
                    During their tenure at our academy, they have borne an exemplary moral character, shown diligence in academic pursuits, and adhered strictly to institutional discipline.
                  </p>
                  <p>
                    They possess a pleasant disposition and participate enthusiastically in co-curricular activities. We wish them success in all their future endeavors.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-12 text-xs font-serif text-slate-800 mt-6">
                  <div>
                    <p className="text-slate-600">Date: {new Date().toLocaleDateString('en-GB')}</p>
                    <p className="text-slate-600">Ref No: GPS/CC/{student.id}/2026</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-block border-t-2 border-slate-800 pt-1 text-center min-w-[140px]">
                      <strong>Principal</strong>
                      <p className="text-[10px] text-slate-500">Seal & Signature</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 10: CREATE LETTER PAD */}
      {isLetterPadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-100 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0b1120]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Official School Letter Pad</h3>
                  <p className="text-[11px] text-slate-400">{student.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLetterPadOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Document Subject</label>
                  <input
                    type="text"
                    value={letterSubject}
                    onChange={(e) => setLetterSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Body Text</label>
                  <textarea
                    rows={4}
                    value={letterBody}
                    onChange={(e) => setLetterBody(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Letterhead Preview */}
              <div className="p-8 rounded-xl bg-white text-slate-900 border border-slate-300 shadow-sm mt-4">
                <div className="border-b-2 border-blue-900 pb-3 mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-lg uppercase tracking-wider text-blue-950">Genius Public School</h3>
                    <p className="text-[11px] text-slate-600">Main Boulevard Campus • Phone: 042-35889901</p>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <p>Ref: GPS/LP/2026/09</p>
                    <p>Date: {new Date().toLocaleDateString('en-GB')}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="font-bold text-xs uppercase tracking-wide text-slate-800 underline">
                    Subject: {letterSubject}
                  </p>
                </div>

                <div className="text-xs leading-relaxed text-slate-800 text-justify mb-8 whitespace-pre-line">
                  {letterBody}
                </div>

                <div className="pt-8 flex justify-end">
                  <div className="text-center min-w-[160px]">
                    <div className="border-t border-slate-700 pt-1 text-xs font-bold">Authorized Signatory</div>
                    <p className="text-[10px] text-slate-500">Genius Public School</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 11: ADD OBSERVATION */}
      {isAddObservationOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <h3 className="text-sm font-bold text-white mb-1">Add Teacher Observation</h3>
            <p className="text-xs text-slate-400 mb-4">Record behavior or academic note for {student.name}:</p>
            
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observation Remark</label>
                <textarea
                  rows={3}
                  value={observationText}
                  onChange={(e) => setObservationText(e.target.value)}
                  placeholder="e.g. Shows great aptitude in team projects..."
                  className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddObservationOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddObservation}
                disabled={!observationText.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Save Observation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 12: TERMINATE STUDENT */}
      {isTerminateOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Terminate Student Enrollment</h3>
                <p className="text-xs text-red-400 font-semibold">{student.name} ({student.id})</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Marking a student as Terminated will set their status to Inactive and record the termination reason in their permanent archive.
            </p>

            <div className="mb-5 text-xs">
              <label className="block text-slate-300 font-semibold mb-1">Reason for Termination</label>
              <input
                type="text"
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141e2f] border border-[#22334e] text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTerminateOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTerminateStudent}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 13: SEND WHATSAPP */}
      {isWhatsAppOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md shadow-2xl p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#25D366]/20 text-[#25D366] flex items-center justify-center font-bold">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Send WhatsApp Notification</h3>
                <p className="text-xs text-slate-400">Recipient: {studentInfo.phoneNumber || studentInfo.whatsapp}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141e2f] border border-[#22334e] mb-5 text-xs space-y-2">
              <p className="text-slate-300">
                <strong>Sample Message:</strong>
              </p>
              <div className="p-3 rounded-lg bg-[#0c131f] text-slate-300 font-mono text-[11px] leading-relaxed border border-[#1b273b]">
                Dear Parent of {student.name}, this is an official update from Genius Public School. Current fee status: {studentInfo.totalDue} due. Thank you for your continued partnership.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIsWhatsAppOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`Dear Parent of ${student.name}, this is an official update from Genius Public School.`);
                  showToast('Message copied to clipboard');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#152338] text-sky-400 border border-[#223755] cursor-pointer"
              >
                Copy Text
              </button>
              <a
                href={`https://wa.me/${(studentInfo.whatsapp || studentInfo.phoneNumber).replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsWhatsAppOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Open WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
