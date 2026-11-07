import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Video, 
  FileText, 
  FileCheck, 
  Printer, 
  Bell, 
  BellRing,
  Download, 
  Users, 
  User, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  CreditCard, 
  Eye, 
  Percent, 
  Sparkles, 
  Coins, 
  Wallet, 
  Receipt,
  MessageCircle,
  Phone,
  CheckCircle2,
  Filter,
  X,
  ExternalLink,
  Mail,
  BookOpen
} from 'lucide-react';
import { Student, ClassInfo, PaymentMethod, normalizeMethod } from '../types';
import { 
  formatPKR, 
  getStudentFeeDefaults, 
  buildFamilyFeeSummaries, 
  FamilyFeeSummary, 
  StudentFeeData,
  createWhatsAppFeeAlertUrl
} from '../utils/feeHelper';
import { FeeReminderModal } from './FeeReminderModal';
import { FeePaymentModal } from './FeePaymentModal';
import { FeeChallanModal } from './FeeChallanModal';
import { FeeCardModal } from './FeeCardModal';
import { StudentFeeDetailsPage, FeePaymentSuccessResult } from './StudentFeeDetailsPage';
import { GenerateChallanModal } from './GenerateChallanModal';
import { FeesReportModal } from './FeesReportModal';
import { exportFeesDataToCSV, FeeReportRowItem } from '../utils/feeExportHelper';
import { 
  getGeneratedChallans, 
  getChallanByTargetId, 
  GeneratedChallan,
  markChallansAsPaid 
} from '../utils/challanStore';
import { GetChallanModal, ChallanPaymentPayload } from './GetChallanModal';
import { FeeInvoicePage } from './FeeInvoicePage';
import { FeeInvoiceData } from '../utils/feeInvoicePdfGenerator';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { loadAllLedgerItems } from '../utils/studentFeeLedgerHelper';
import { listPayments, recordPayment, getCreditForStudents } from '../utils/paymentStore';

interface FeesModuleProps {
  students: Student[];
  classes: ClassInfo[];
  onSelectStudent: (student: Student) => void;
  onSelectFamily?: (familyId: string, familyName: string) => void;
  onShowToast: (message: string) => void;
  onOpenLedger?: () => void;
  onNavigateToClasses?: () => void;
  onBreadcrumbOverview?: () => void;
  initialTargetStudentId?: string | null;
  onClearInitialTarget?: () => void;
}

interface ActiveFeeDetailsTarget {
  family: FamilyFeeSummary;
  students: Student[];
  initialSelectedStudentId?: string;
}

const isMatchingId = (id1?: string, id2?: string) => {
  if (!id1 || !id2) return false;
  const clean1 = id1.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const clean2 = id2.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean1 === clean2;
};

export const FeesModule: React.FC<FeesModuleProps> = ({
  students,
  classes,
  onSelectStudent,
  onSelectFamily,
  onShowToast,
  onOpenLedger,
  onNavigateToClasses,
  onBreadcrumbOverview,
  initialTargetStudentId,
  onClearInitialTarget
}) => {
  // Local state for view switcher: 'family' | 'student'
  const [activeView, setActiveView] = useState<'family' | 'student'>('family');

  // Status Filter: 'All' | 'Unpaid' | 'Partially Paid' | 'Paid'
  const [statusFilter, setStatusFilter] = useState<'All' | 'Unpaid' | 'Partially Paid' | 'Paid'>('All');

  // Class Filter
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState<boolean>(false);

  // Search input
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active family & students for dedicated Fee Details page
  const [activeFeeDetailsTarget, setActiveFeeDetailsTarget] = useState<ActiveFeeDetailsTarget | null>(null);

  // Active invoice for dedicated Invoice view after marking payment
  const [activeInvoiceData, setActiveInvoiceData] = useState<FeeInvoiceData | null>(null);

  // Expanded family rows (Set of family IDs)
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(() => new Set());

  // Counter to refresh derived fee totals whenever payments or ledger items change
  const [feeVersion, setFeeVersion] = useState<number>(0);

  // Modal States
  const [reminderModalState, setReminderModalState] = useState<{
    isOpen: boolean;
    entryType?: 'family' | 'student';
    recipientName: string;
    studentName?: string;
    studentId?: string;
    studentClass?: string;
    phone: string;
    email: string;
    familyId: string;
    studentNames: string[];
    amountDue: number;
    family?: FamilyFeeSummary;
    students?: Student[];
  }>({
    isOpen: false,
    entryType: 'family',
    recipientName: '',
    phone: '',
    email: '',
    familyId: '',
    studentNames: [],
    amountDue: 0
  });

  const [paymentModalState, setPaymentModalState] = useState<{
    isOpen: boolean;
    title: string;
    name: string;
    identifier: string;
    totalDue: number;
    totalPaid: number;
    studentId?: string;
    familyId?: string;
  }>({
    isOpen: false,
    title: '',
    name: '',
    identifier: '',
    totalDue: 0,
    totalPaid: 0
  });

  const [challanModalState, setChallanModalState] = useState<{
    isOpen: boolean;
    title: string;
    name: string;
    idNumber: string;
    className?: string;
    section?: string;
    phone?: string;
    totalFee: number;
    totalPaid: number;
    remainingDue: number;
    challanNumber?: string;
    issueDate?: string;
    dueDate?: string;
    validityDate?: string;
    feeRange?: string;
    multipleChallans?: GeneratedChallan[];
    studentIds?: string[];
  }>({
    isOpen: false,
    title: '',
    name: '',
    idNumber: '',
    totalFee: 0,
    totalPaid: 0,
    remainingDue: 0
  });

  // Generate Challan Wizard Modal State (Scope, Fee Range, Selection Ctrl+A, Confirm Dates, Download)
  const [isGenerateChallanModalOpen, setIsGenerateChallanModalOpen] = useState<boolean>(false);

  // Get Challan Selection & Payment Workflow Modal State (Step 1 Select Challan IDs -> Step 2 Pay & Deduct)
  const [isGetChallanModalOpen, setIsGetChallanModalOpen] = useState<boolean>(false);

  // Fees Report Preview Modal (Matching 3rd reference PDF image)
  const [isFeesReportModalOpen, setIsFeesReportModalOpen] = useState<boolean>(false);

  // Export Dropdown State (Download CSV vs PDF Report Preview)
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Print Dropdown & Fee Card Modal States
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState<boolean>(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);
  const [isFeeCardModalOpen, setIsFeeCardModalOpen] = useState<boolean>(false);
  const [feeCardStudentId, setFeeCardStudentId] = useState<string | undefined>(undefined);

  // Close print and export dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(event.target as Node)) {
        setIsPrintDropdownOpen(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen to feeDataUpdated / storage events
  useEffect(() => {
    const refresh = () => setFeeVersion(v => v + 1);
    window.addEventListener('feeDataUpdated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('feeDataUpdated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const payments = useMemo(() => listPayments(), [students, feeVersion]);

  // Compute family fee summaries & global KPI cards
  const { families, kpi, counts } = useMemo(() => {
    return buildFamilyFeeSummaries(students, payments);
  }, [students, payments, feeVersion]);

  // Class list for dropdown
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    classes.forEach(c => { if (c.name) set.add(c.name.trim()); });
    students.forEach(s => { if (s.class) set.add(s.class.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classes, students]);

  // Filtered families based on status tab, class filter, and search
  const filteredFamilies = useMemo(() => {
    return families.filter(fam => {
      // Status tab filter
      if (statusFilter !== 'All' && fam.status !== statusFilter) {
        return false;
      }

      // Class filter
      if (selectedClass !== 'All') {
        const hasClass = fam.students.some(s => s.class.toLowerCase() === selectedClass.toLowerCase());
        if (!hasClass) return false;
      }

      // Search term
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        const matchesFamilyName = fam.familyName.toLowerCase().includes(term);
        const matchesFamilyId = fam.familyId.toLowerCase().includes(term);
        const matchesPhone = fam.phone.toLowerCase().includes(term);
        const matchesStudent = fam.students.some(s => 
          s.name.toLowerCase().includes(term) ||
          s.id.toLowerCase().includes(term) ||
          s.class.toLowerCase().includes(term)
        );

        if (!matchesFamilyName && !matchesFamilyId && !matchesPhone && !matchesStudent) {
          return false;
        }
      }

      return true;
    });
  }, [families, statusFilter, selectedClass, searchQuery]);

  // Flatten students for Student View
  const studentFeeList = useMemo(() => {
    const ledgers = loadAllLedgerItems();
    return students.map(student => {
      const def = getStudentFeeDefaults(student, ledgers, payments);
      return {
        ...def,
        originalStudent: student
      };
    }).filter(s => {
      if (statusFilter !== 'All' && s.status !== statusFilter) return false;
      if (selectedClass !== 'All' && s.class.toLowerCase() !== selectedClass.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        const matchesName = s.studentName.toLowerCase().includes(term);
        const matchesId = s.studentId.toLowerCase().includes(term);
        const matchesFamily = s.family.toLowerCase().includes(term);
        const matchesClass = s.class.toLowerCase().includes(term);
        if (!matchesName && !matchesId && !matchesFamily && !matchesClass) return false;
      }
      return true;
    });
  }, [students, payments, feeVersion, statusFilter, selectedClass, searchQuery]);

  // Export data items mapped strictly to required columns:
  // NAME, ID, PHONE, CLASSES/CLASS, DUE, PAID, STATUS
  // Strictly no metadata
  const activeExportItems = useMemo<FeeReportRowItem[]>(() => {
    if (activeView === 'family') {
      const source = filteredFamilies.length > 0 ? filteredFamilies : families;
      return source.map(fam => ({
        id: fam.familyId,
        name: fam.familyName,
        phone: fam.phone || '',
        classesOrClass: fam.students?.map(s => s.class).filter(Boolean).join(', ') || '—',
        due: fam.totalDue,
        paid: fam.totalPaid,
        status: fam.status
      }));
    } else {
      const source = studentFeeList;
      return source.map(s => ({
        id: s.studentId,
        name: s.studentName,
        phone: s.phone || '',
        classesOrClass: s.class || '—',
        due: s.remainingDue,
        paid: s.totalPaid,
        status: s.status
      }));
    }
  }, [activeView, filteredFamilies, families, studentFeeList]);

  // Export handlers for Reusable CSV and PDF
  const handleExportCSV = () => {
    setIsExportDropdownOpen(false);
    exportFeesDataToCSV(activeView, activeExportItems);
    onShowToast(`Exported ${activeExportItems.length} ${activeView === 'family' ? 'families' : 'students'} to Reusable CSV!`);
  };

  const handleExportPDF = () => {
    setIsExportDropdownOpen(false);
    setIsFeesReportModalOpen(true);
  };

  // Toggle family expansion
  const toggleFamilyExpansion = (familyId: string) => {
    setExpandedFamilyIds(prev => {
      const next = new Set(prev);
      if (next.has(familyId)) {
        next.delete(familyId);
      } else {
        next.add(familyId);
      }
      return next;
    });
  };

  // Record payment handler
  const handleRecordPayment = (payment: {
    amount: number;
    method: PaymentMethod;
    date: string;
    notes?: string;
    useCredit?: boolean;
  }) => {
    const { studentId, familyId } = paymentModalState;
    let targetStudents: Student[] = [];

    if (studentId) {
      const targetStudent = students.find(s => isMatchingId(s.id, studentId)) || students.find(s => s.id === studentId);
      if (targetStudent) targetStudents = [targetStudent];
    } else if (familyId) {
      const fam = families.find(f => f.familyId === familyId);
      if (fam && fam.students.length > 0) {
        targetStudents = fam.students;
      } else {
        targetStudents = students.filter(s => s.familyId === familyId);
      }
    }

    if (targetStudents.length === 0) return;

    const p = recordPayment({
      students: targetStudents,
      amount: payment.amount,
      method: normalizeMethod(payment.method),
      date: payment.date,
      note: payment.notes,
      createdBy: 'Accounts Office',
      useCredit: payment.useCredit
    });

    setFeeVersion(v => v + 1);
    onShowToast(`Recorded payment of ${formatPKR(payment.amount)} (${p.receiptNo})`);
  };

  // Handle Pay and Deduct from Get Challan Modal
  const handlePayAndDeductChallans = (payload: ChallanPaymentPayload) => {
    const { selectedChallans, paymentInfo } = payload;
    if (!selectedChallans || selectedChallans.length === 0) return;

    const paidChallanIds: string[] = [];
    const totalOriginal = selectedChallans.reduce((acc, c) => acc + (c.amount || 0), 0);

    selectedChallans.forEach(challan => {
      paidChallanIds.push(challan.id);
      paidChallanIds.push(challan.challanNumber);
      const allocated = totalOriginal > 0
        ? Math.round((challan.amount / totalOriginal) * paymentInfo.amount)
        : challan.amount;

      let targetStudents: Student[] = [];
      if (challan.targetType === 'student' || (challan.studentIds && challan.studentIds.length === 1)) {
        const targetStudentId = challan.studentIds?.[0] || challan.targetId;
        const targetStudent = students.find(s => isMatchingId(s.id, targetStudentId) || s.id === targetStudentId);
        if (targetStudent) targetStudents = [targetStudent];
      } else {
        const targetFamilyId = challan.familyId || challan.targetId;
        targetStudents = students.filter(s => s.familyId === targetFamilyId);
      }

      if (targetStudents.length > 0 && allocated > 0) {
        recordPayment({
          students: targetStudents,
          amount: allocated,
          method: normalizeMethod(paymentInfo.method),
          date: paymentInfo.date,
          note: paymentInfo.notes || `Challan ${challan.challanNumber}`,
          createdBy: 'Accounts Office'
        });
      }
    });

    markChallansAsPaid(paidChallanIds);
    setFeeVersion(v => v + 1);
    onShowToast(
      `Paid ${formatPKR(paymentInfo.amount)} for ${selectedChallans.length} Challan(s)! Dues deducted from member accounts.`
    );
  };

  // Open Reminder Modal (WhatsApp / Email) for family
  const handleOpenFamilyReminder = (fam: FamilyFeeSummary) => {
    const famStudents = fam.students && fam.students.length > 0 
      ? fam.students 
      : students.filter(s => (s.familyId || '').trim() === fam.familyId.trim() || s.family === fam.familyName);
    const studentWithEmail = famStudents.find(s => s.email && s.email.includes('@'));
    const cleanFamId = fam.familyId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const resolvedEmail = studentWithEmail?.email || `parent.${cleanFamId || 'fam'}@gmail.com`;

    setReminderModalState({
      isOpen: true,
      recipientName: fam.familyName,
      phone: fam.phone || '',
      email: resolvedEmail,
      familyId: fam.familyId,
      studentNames: famStudents.map(s => `${s.name} (${s.id})`),
      amountDue: fam.totalDue,
      family: fam,
      students: famStudents
    });
  };

  // Open Reminder Modal (WhatsApp / Email) for student
  const handleOpenStudentReminder = (studentFee: StudentFeeData) => {
    const matched = students.find(s => s.id === studentFee.studentId);
    const fam = families.find(f => f.familyId === studentFee.familyId);
    const resolvedPhone = matched?.phone || fam?.phone || studentFee.phone || '';
    const resolvedEmail = matched?.email || `student.${studentFee.studentId.toLowerCase()}@gmail.com`;

    setReminderModalState({
      isOpen: true,
      recipientName: studentFee.family || studentFee.studentName,
      phone: resolvedPhone,
      email: resolvedEmail,
      familyId: studentFee.familyId,
      studentNames: [`${studentFee.studentName} (${studentFee.studentId})`],
      amountDue: studentFee.remainingDue,
      family: fam,
      students: fam ? fam.students : (matched ? [matched] : [])
    });
  };

  // Open Dedicated Fee Details Page for Family Pay (All family students pre-selected)
  const handleOpenFamilyPay = (fam: FamilyFeeSummary) => {
    const cleanFamId = fam.familyId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const famNameLower = (fam.familyName || '').trim().toLowerCase();

    // Collect all students for this family from master students list
    const matchedStudents = students.filter(s => {
      const sFamId = (s.familyId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cleanFamId && sFamId && cleanFamId === sFamId) return true;
      if (s.family && famNameLower && s.family.trim().toLowerCase() === famNameLower) return true;
      return fam.students.some(fs => isMatchingId(fs.id, s.id));
    });

    const targetStudents = matchedStudents.length > 0 
      ? matchedStudents 
      : (fam.students && fam.students.length > 0 ? fam.students : []);

    setActiveFeeDetailsTarget({
      family: fam,
      students: targetStudents,
      initialSelectedStudentId: undefined // For family pay all students are selected
    });
  };

  // Open Dedicated Fee Details Page for Student Pay (Opens family details and selects this student's boxes)
  const handleOpenStudentPay = (studentFee: StudentFeeData) => {
    // Locate the student in the master students registry
    const matchedStudent = students.find(s => 
      isMatchingId(s.id, studentFee.studentId) ||
      (s.name && studentFee.studentName && s.name.trim().toLowerCase() === studentFee.studentName.trim().toLowerCase())
    ) || studentFee.originalStudent;

    const studentFamilyId = matchedStudent?.familyId || studentFee.familyId || '';
    const cleanFamId = studentFamilyId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const famNameLower = (studentFee.family || matchedStudent?.family || '').trim().toLowerCase();

    // Find the corresponding family summary
    const fam = families.find(f => {
      const fClean = f.familyId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cleanFamId && fClean && cleanFamId === fClean) return true;
      if (famNameLower && f.familyName.trim().toLowerCase() === famNameLower) return true;
      return f.students.some(s => 
        isMatchingId(s.id, studentFee.studentId) || 
        (matchedStudent && isMatchingId(s.id, matchedStudent.id)) ||
        (s.name && studentFee.studentName && s.name.trim().toLowerCase() === studentFee.studentName.trim().toLowerCase())
      );
    });

    // Find all sibling students in this family from the master students list
    const famStudents = students.filter(s => {
      const sFamId = (s.familyId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cleanFamId && sFamId && cleanFamId === sFamId) return true;
      if (famNameLower && s.family && s.family.trim().toLowerCase() === famNameLower) return true;
      if (fam && fam.students.some(fs => isMatchingId(fs.id, s.id))) return true;
      return false;
    });

    let combinedStudents = famStudents.length > 0 
      ? famStudents 
      : (fam && fam.students.length > 0 ? fam.students : (matchedStudent ? [matchedStudent] : []));

    // Ensure matchedStudent is in combined list
    if (matchedStudent && !combinedStudents.some(s => isMatchingId(s.id, matchedStudent.id))) {
      combinedStudents = [matchedStudent, ...combinedStudents];
    }

    const targetFamily: FamilyFeeSummary = fam || {
      familyId: studentFamilyId || (matchedStudent?.familyId) || 'F-0000',
      familyName: studentFee.family || (matchedStudent?.family) || (matchedStudent?.name ? matchedStudent.name + ' Family' : 'Family'),
      phone: studentFee.phone || matchedStudent?.phone || '',
      students: combinedStudents,
      totalDue: studentFee.remainingDue,
      totalPaid: studentFee.totalPaid,
      currentMonthCollection: studentFee.currentMonthCollection,
      remainingDue: studentFee.remainingDue,
      status: studentFee.status
    };

    setActiveFeeDetailsTarget({
      family: targetFamily,
      students: combinedStudents,
      initialSelectedStudentId: matchedStudent?.id || studentFee.studentId // Only this student has boxes selected
    });
  };

  // If initialTargetStudentId is provided (e.g., from clicking Pay in OverviewModule)
  useEffect(() => {
    if (!initialTargetStudentId) return;

    // Find in studentFeeList (or students)
    const targetStudentFee = studentFeeList.find(s => 
      isMatchingId(s.studentId, initialTargetStudentId) || 
      isMatchingId(s.originalStudent?.id, initialTargetStudentId)
    );
    if (targetStudentFee) {
      handleOpenStudentPay(targetStudentFee);
    } else {
      const directStudent = students.find(s => isMatchingId(s.id, initialTargetStudentId));
      if (directStudent) {
        const def = getStudentFeeDefaults(directStudent, loadAllLedgerItems(), payments);
        handleOpenStudentPay({
          ...def,
          originalStudent: directStudent
        });
      }
    }

    if (onClearInitialTarget) {
      onClearInitialTarget();
    }
  }, [initialTargetStudentId]);

  // Handle successful fee payment from Fee Details page
  const handleFeeDetailsPaymentSuccess = (_result: FeePaymentSuccessResult) => {
    setFeeVersion(v => v + 1);
  };

  // Handle adding charge from Fee Details page
  const handleFeeDetailsAddCharge = (_result: { studentId: string; amount: number; type: string; reason: string }) => {
    setFeeVersion(v => v + 1);
  };

  // Open Challan modal for family
  const handleOpenFamilyChallan = (fam: FamilyFeeSummary) => {
    const existing = getChallanByTargetId(fam.familyId);

    setChallanModalState({
      isOpen: true,
      title: 'Family Fee Challan',
      name: fam.familyName,
      idNumber: fam.familyId,
      className: (fam.students || []).map(s => s.class).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'School',
      section: fam.students?.[0]?.section || 'A',
      phone: fam.phone,
      totalFee: existing ? existing.amount : (fam.totalPaid + fam.totalDue),
      totalPaid: existing ? 0 : fam.totalPaid,
      remainingDue: existing ? existing.amount : fam.totalDue,
      challanNumber: existing?.challanNumber,
      issueDate: existing?.issueDate,
      dueDate: existing?.dueDate,
      validityDate: existing?.validityDate,
      feeRange: existing?.feeRange,
      multipleChallans: undefined,
      studentIds: (fam.students || []).map(s => s.id)
    });
  };

  // Open Challan modal for student
  const handleOpenStudentChallan = (studentFee: StudentFeeData) => {
    const existing = getChallanByTargetId(studentFee.studentId);

    setChallanModalState({
      isOpen: true,
      title: 'Student Fee Challan',
      name: studentFee.studentName,
      idNumber: studentFee.studentId,
      className: studentFee.class,
      section: studentFee.section,
      phone: studentFee.phone,
      totalFee: existing ? existing.amount : studentFee.totalFee,
      totalPaid: existing ? 0 : studentFee.totalPaid,
      remainingDue: existing ? existing.amount : studentFee.remainingDue,
      challanNumber: existing?.challanNumber,
      issueDate: existing?.issueDate,
      dueDate: existing?.dueDate,
      validityDate: existing?.validityDate,
      feeRange: existing?.feeRange,
      multipleChallans: undefined,
      studentIds: [studentFee.studentId]
    });
  };

  // If invoice is active, render dedicated FeeInvoicePage (Matching Reference Image)
  if (activeInvoiceData) {
    return (
      <FeeInvoicePage
        invoiceData={activeInvoiceData}
        students={students}
        onBackToFamily={() => setActiveInvoiceData(null)}
        onBackToFees={() => {
          setActiveInvoiceData(null);
          setActiveFeeDetailsTarget(null);
        }}
        onBreadcrumbOverview={onBreadcrumbOverview}
        onShowToast={(msg) => onShowToast(msg)}
      />
    );
  }

  // If a family/student is selected for dedicated Fee Details view, render StudentFeeDetailsPage
  if (activeFeeDetailsTarget) {
    return (
      <StudentFeeDetailsPage
        key={`${activeFeeDetailsTarget.family.familyId}-${activeFeeDetailsTarget.initialSelectedStudentId || 'family'}`}
        family={activeFeeDetailsTarget.family}
        students={activeFeeDetailsTarget.students}
        initialSelectedStudentId={activeFeeDetailsTarget.initialSelectedStudentId}
        classes={classes}
        allStudents={students}
        onBack={() => setActiveFeeDetailsTarget(null)}
        onBreadcrumbOverview={onBreadcrumbOverview}
        onSelectStudentProfile={(s) => {
          setActiveFeeDetailsTarget(null);
          onSelectStudent(s);
        }}
        onShowToast={(msg) => onShowToast(msg)}
        onPaymentSuccess={handleFeeDetailsPaymentSuccess}
        onAddCharge={handleFeeDetailsAddCharge}
        onNavigateToInvoice={(inv) => setActiveInvoiceData(inv)}
        onNavigateToClasses={onNavigateToClasses}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150" id="module-fees-root">
      {/* 1. Header with Breadcrumb & Top Buttons directly in header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-edge-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Fees
            </h1>
            <Video className="w-4 h-4 text-slate-400 inline" />
          </div>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Fees' }
            ]}
          />
        </div>

        {/* Top Header Action Buttons directly against the Fees header */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Generate Challan */}
          <button
            type="button"
            onClick={() => setIsGenerateChallanModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            id="btn-fees-generate-challan"
          >
            <FileText className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Generate Challan</span>
          </button>

          {/* Get Challan */}
          <button
            type="button"
            onClick={() => setIsGetChallanModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-surface-27 hover:bg-edge-11 border border-[#23354d] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:border-emerald-500/50"
            id="btn-fees-get-challan"
            title="Select Challans, pay price and deduct from member accounts"
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Get Challan</span>
          </button>

          {/* Ledger Button */}
          {onOpenLedger && (
            <button
              type="button"
              onClick={onOpenLedger}
              className="px-3.5 py-2 rounded-lg bg-surface-27 hover:bg-edge-11 border border-[#23354d] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:border-blue-500/50"
              id="btn-fees-open-ledger"
              title="View School Ledger, Income & Expenses"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>Ledger</span>
            </button>
          )}

          {/* Print dropdown with Generate Fee Card and Download Generated Challans options */}
          <div className="relative" ref={printDropdownRef}>
            <button
              type="button"
              onClick={() => setIsPrintDropdownOpen(prev => !prev)}
              className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              id="btn-fees-print"
              aria-expanded={isPrintDropdownOpen}
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              <span>Print</span>
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isPrintDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPrintDropdownOpen && (
              <div 
                className="absolute right-0 mt-1.5 w-44 bg-surface-9 border border-edge-29 rounded-xl shadow-2xl z-50 py-1 text-xs animate-in fade-in zoom-in-95 duration-150"
                id="dropdown-fees-print-options"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintDropdownOpen(false);
                    setFeeCardStudentId(undefined);
                    setIsFeeCardModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-edge-5 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                  id="btn-print-fee-card"
                >
                  <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-semibold text-white">Fee Card</span>
                </button>

                <div className="my-0.5 border-t border-[#1c293c]" />

                <button
                  type="button"
                  onClick={() => {
                    setIsPrintDropdownOpen(false);
                    const allGen = getGeneratedChallans();
                    if (allGen.length === 0) {
                      onShowToast('No generated challans yet. Click "Generate Challan" to create them.');
                      return;
                    }
                    setChallanModalState({
                      isOpen: true,
                      title: 'Fee Challans',
                      name: allGen[0].targetName,
                      idNumber: allGen[0].targetId,
                      className: allGen[0].className,
                      section: allGen[0].section,
                      phone: allGen[0].phone,
                      totalFee: allGen[0].amount,
                      totalPaid: 0,
                      remainingDue: allGen[0].amount,
                      challanNumber: allGen[0].challanNumber,
                      issueDate: allGen[0].issueDate,
                      dueDate: allGen[0].dueDate,
                      validityDate: allGen[0].validityDate,
                      feeRange: allGen[0].feeRange,
                      multipleChallans: allGen
                    });
                  }}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-edge-5 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                  id="btn-print-challans"
                >
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-white">Challans</span>
                </button>
              </div>
            )}
          </div>

          {/* Export Dropdown with two simple options: Reusable CSV or PDF */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              type="button"
              onClick={() => setIsExportDropdownOpen(prev => !prev)}
              className="px-3.5 py-2 rounded-lg bg-surface-27 hover:bg-edge-11 border border-[#23354d] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              id="btn-fees-export"
              aria-expanded={isExportDropdownOpen}
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export</span>
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportDropdownOpen && (
              <div 
                className="absolute right-0 mt-1.5 w-56 bg-surface-9 border border-edge-29 rounded-xl shadow-2xl z-50 py-1 text-xs animate-in fade-in zoom-in-95 duration-150 divide-y divide-edge-8"
                id="dropdown-fees-export-options"
              >
                {/* 1. Reusable CSV */}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full px-3.5 py-2.5 text-left text-slate-200 hover:bg-[#162337] flex items-center gap-2.5 transition-colors cursor-pointer group"
                  id="btn-export-csv"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">Reusable CSV</span>
                    <span className="text-[10px] text-slate-400">
                      {activeView === 'family' ? 'Family' : 'Student'} section data (.csv)
                    </span>
                  </div>
                </button>

                {/* 2. PDF */}
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-full px-3.5 py-2.5 text-left text-slate-200 hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors cursor-pointer group"
                  id="btn-export-pdf"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">PDF</span>
                    <span className="text-[10px] text-slate-400">Preview &amp; option to print or cancel</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Four KPI Cards: Soft Pastel Palette */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="fees-kpi-cards">
        {/* Card 1: Current Month (Soft Light Blue) */}
        <div className="p-5 rounded-2xl bg-[#dce9f8] border border-[#bcd3ee] shadow-sm flex flex-col justify-between min-h-[125px] transition-all hover:shadow-md">
          <div className="w-9 h-9 rounded-xl bg-blue-600/15 text-blue-700 flex items-center justify-center mb-3">
            <Receipt className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
              Current Month
            </span>
            <span className="text-2xl font-black text-slate-900 tracking-tight mt-0.5 block">
              {formatPKR(kpi.currentMonth)}
            </span>
          </div>
        </div>

        {/* Card 2: Total Collected (Soft Lavender / Purple) */}
        <div className="p-5 rounded-2xl bg-[#eee5fc] border border-[#d9c4f8] shadow-sm flex flex-col justify-between min-h-[125px] transition-all hover:shadow-md">
          <div className="w-9 h-9 rounded-xl bg-purple-600/15 text-purple-700 flex items-center justify-center mb-3">
            <Wallet className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
              Total Collected
            </span>
            <span className="text-2xl font-black text-slate-900 tracking-tight mt-0.5 block">
              {formatPKR(kpi.totalCollected)}
            </span>
          </div>
        </div>

        {/* Card 3: Total Due (Soft Peach / Coral) */}
        <div className="p-5 rounded-2xl bg-[#fdede7] border border-[#faccc0] shadow-sm flex flex-col justify-between min-h-[125px] transition-all hover:shadow-md">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center mb-3">
            <Coins className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
              Total Due
            </span>
            <span className="text-2xl font-black text-slate-900 tracking-tight mt-0.5 block">
              {formatPKR(kpi.totalDue)}
            </span>
          </div>
        </div>

        {/* Card 4: Collection Rate (Soft Mint / Light Green) */}
        <div className="p-5 rounded-2xl bg-[#dcfae5] border border-[#b8f0c9] shadow-sm flex flex-col justify-between min-h-[125px] transition-all hover:shadow-md">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/15 text-emerald-700 flex items-center justify-center mb-3">
            <Percent className="w-5 h-5 stroke-[2.4]" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
              Collection Rate
            </span>
            <span className="text-2xl font-black text-slate-900 tracking-tight mt-0.5 block">
              {kpi.collectionRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Centered View Switcher Buttons (Family View vs Student View) */}
      <div className="flex justify-center my-2" id="fees-view-switcher">
        <div className="inline-flex items-center p-1 rounded-xl bg-surface-18 border border-edge-20 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveView('family')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
              activeView === 'family'
                ? 'bg-edge-31 text-white shadow-sm ring-1 ring-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-[#1a2536]'
            }`}
            id="btn-view-family"
          >
            <Users className="w-4 h-4" />
            <span>Family View</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('student')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
              activeView === 'student'
                ? 'bg-edge-31 text-white shadow-sm ring-1 ring-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-[#1a2536]'
            }`}
            id="btn-view-student"
          >
            <User className="w-4 h-4" />
            <span>Student View</span>
          </button>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <div className="space-y-3.5">
        {/* Status Tabs with count badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs select-none">
          {/* All */}
          <button
            type="button"
            onClick={() => setStatusFilter('All')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 font-semibold cursor-pointer transition-all ${
              statusFilter === 'All'
                ? 'bg-edge-3 text-white border border-[#2e3f5b]'
                : 'bg-[#111823] text-slate-400 hover:text-slate-200 border border-edge-8'
            }`}
          >
            <span>All</span>
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#25364f] text-white">
              {counts.all}
            </span>
          </button>

          {/* Unpaid */}
          <button
            type="button"
            onClick={() => setStatusFilter('Unpaid')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 font-semibold cursor-pointer transition-all ${
              statusFilter === 'Unpaid'
                ? 'bg-[#2a1b1a] text-orange-300 border border-orange-500/50'
                : 'bg-[#111823] text-slate-400 hover:text-slate-200 border border-edge-8'
            }`}
          >
            <span className="text-orange-400">Unpaid</span>
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30">
              {counts.unpaid}
            </span>
          </button>

          {/* Partially Paid */}
          <button
            type="button"
            onClick={() => setStatusFilter('Partially Paid')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 font-semibold cursor-pointer transition-all ${
              statusFilter === 'Partially Paid'
                ? 'bg-[#2e2515] text-amber-300 border border-amber-500/50'
                : 'bg-[#111823] text-slate-400 hover:text-slate-200 border border-edge-8'
            }`}
          >
            <span className="text-amber-400">Partially Paid</span>
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {counts.partiallyPaid}
            </span>
          </button>

          {/* Paid */}
          <button
            type="button"
            onClick={() => setStatusFilter('Paid')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 font-semibold cursor-pointer transition-all ${
              statusFilter === 'Paid'
                ? 'bg-[#152a1e] text-emerald-300 border border-emerald-500/50'
                : 'bg-[#111823] text-slate-400 hover:text-slate-200 border border-edge-8'
            }`}
          >
            <span className="text-emerald-400">Paid</span>
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {counts.paid}
            </span>
          </button>
        </div>

        {/* Filter By Class dropdown & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Filter By Class Select */}
          <div className="relative shrink-0 sm:w-56">
            <div className="relative">
              <label className="absolute -top-2 left-3 px-1 text-[10px] font-semibold text-slate-400 bg-canvas z-10">
                Filter By Class
              </label>
              <button
                type="button"
                onClick={() => setIsClassDropdownOpen(prev => !prev)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#111723] border border-[#233249] hover:border-slate-500 text-left text-xs font-semibold text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                id="btn-filter-class"
              >
                <span>{selectedClass === 'All' ? 'Filter By Class' : selectedClass}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Menu */}
            {isClassDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsClassDropdownOpen(false)} 
                />
                <div className="absolute left-0 mt-1 w-full rounded-xl bg-surface-18 border border-[#24364f] shadow-2xl z-30 py-1 max-h-56 overflow-y-auto text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClass('All');
                      setIsClassDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-[#1c273a] flex items-center justify-between cursor-pointer ${
                      selectedClass === 'All' ? 'text-blue-400 font-bold bg-edge-1' : 'text-slate-200'
                    }`}
                  >
                    <span>All Classes</span>
                    {selectedClass === 'All' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  {availableClasses.map(cls => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => {
                        setSelectedClass(cls);
                        setIsClassDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-[#1c273a] flex items-center justify-between cursor-pointer ${
                        selectedClass === cls ? 'text-blue-400 font-bold bg-edge-1' : 'text-slate-200'
                      }`}
                    >
                      <span>{cls}</span>
                      {selectedClass === cls && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by family name, student name, roll number, class..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#111723] border border-[#233249] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. FAMILY VIEW: Rows with Expandable Sub-table */}
      {activeView === 'family' ? (
        <div className="space-y-3" id="fees-family-list">
          {filteredFamilies.length === 0 ? (
            <div className="py-12 text-center bg-[#111723] border border-[#1f2d42] rounded-2xl">
              <Users className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-semibold text-slate-300">No family records found</h3>
              <p className="text-xs text-slate-500 mt-1">Try adjusting the status tabs, class selector, or search filter</p>
            </div>
          ) : (
            filteredFamilies.map((fam) => {
              const isExpanded = expandedFamilyIds.has(fam.familyId);

              // Status color accents
              const borderLeftClass = 
                fam.status === 'Unpaid' 
                  ? 'border-l-4 border-l-orange-500' 
                  : fam.status === 'Partially Paid' 
                    ? 'border-l-4 border-l-amber-500' 
                    : 'border-l-4 border-l-emerald-500';

              const statusBadge = 
                fam.status === 'Unpaid' ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#3c1d1d] text-orange-400 border border-orange-500/30">
                    Unpaid
                  </span>
                ) : fam.status === 'Partially Paid' ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#382b17] text-amber-400 border border-amber-500/30">
                    Partially Paid
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#163523] text-emerald-400 border border-emerald-500/30">
                    Paid
                  </span>
                );

              return (
                <div 
                  key={fam.familyId} 
                  className={`rounded-xl bg-[#141b26] border border-[#202d3e] overflow-hidden transition-all shadow-sm ${borderLeftClass}`}
                  id={`family-card-${fam.familyId}`}
                >
                  {/* Family Card Summary Row (Clickable to expand) */}
                  <div 
                    onClick={() => toggleFamilyExpansion(fam.familyId)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-[#182130] transition-colors"
                  >
                    {/* Left: Family Name, Eye Icon, Status, and ID • Phone */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white tracking-tight">
                            {fam.familyName}
                          </span>
                          {/* Eye Icon to view family profile/details */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectFamily) onSelectFamily(fam.familyId, fam.familyName);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-400 rounded transition-colors cursor-pointer"
                            title="View Family Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {statusBadge}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                          <span>{fam.familyId}</span>
                          <span className="text-slate-600">•</span>
                          {/* Clickable WhatsApp number that auto-fills into fee alert modal */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFamilyReminder(fam);
                            }}
                            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors group cursor-pointer"
                            title="Click to send Fee Reminder (WhatsApp or Email)"
                            id={`btn-phone-alert-${fam.familyId}`}
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-400 group-hover:scale-110 transition-transform" />
                            <span className="group-hover:underline">{fam.phone}</span>
                          </button>
                          {(() => {
                            const existingChl = getChallanByTargetId(fam.familyId);
                            if (existingChl) {
                              return (
                                <span 
                                  className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                  title={`Challan #${existingChl.challanNumber} already generated for PKR ${existingChl.amount}. Use Print to view.`}
                                >
                                  {existingChl.challanNumber}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Financial Metrics Columns */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-8 flex-1">
                      {/* Total Due */}
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Total Due
                        </span>
                        <span className="text-xs font-bold text-red-400">
                          {formatPKR(fam.totalDue)}
                        </span>
                      </div>

                      {/* Total Paid */}
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Total Paid
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {formatPKR(fam.totalPaid)}
                        </span>
                      </div>

                      {/* Current Month Collection */}
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Curr. Month
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {formatPKR(fam.currentMonthCollection)}
                        </span>
                      </div>

                      {/* Balance */}
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Balance
                        </span>
                        <span className="text-xs font-bold text-slate-200">
                          {formatPKR(fam.balance)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions (Pay, Print, Alert WhatsApp, Dropdown Chevron) */}
                    <div className="flex items-center gap-2 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                      {/* Pay Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenFamilyPay(fam)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#222f42] hover:bg-[#2c3d55] text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                        id={`btn-pay-family-${fam.familyId}`}
                      >
                        Pay
                      </button>

                      {/* Print Challan Slip */}
                      <button
                        type="button"
                        onClick={() => handleOpenFamilyChallan(fam)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#222f42] transition-colors cursor-pointer"
                        title="Print Challan Slip"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {/* Reminder Button (WhatsApp or Email) */}
                      <button
                        type="button"
                        onClick={() => handleOpenFamilyReminder(fam)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-[#222f42] transition-colors cursor-pointer"
                        title="Send Fee Reminder (WhatsApp or Email)"
                        id={`btn-reminder-family-${fam.familyId}`}
                      >
                        <BellRing className="w-4 h-4" />
                      </button>

                      {/* Dropdown Chevron Arrow */}
                      <button
                        type="button"
                        onClick={() => toggleFamilyExpansion(fam.familyId)}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student Sub-Table */}
                  {isExpanded && (
                    <div className="border-t border-[#1d293b] bg-[#0d131c] px-4 py-3 animate-in fade-in duration-150">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b border-[#1b2637] text-[9.5px] uppercase tracking-wider">
                              <th className="py-2 px-2 font-semibold">Student</th>
                              <th className="py-2 px-2 font-semibold">Class</th>
                              <th className="py-2 px-2 font-semibold">Total Fee</th>
                              <th className="py-2 px-2 font-semibold">Total Paid</th>
                              <th className="py-2 px-2 font-semibold">Remaining Due</th>
                              <th className="py-2 px-2 font-semibold">Curr. Month</th>
                              <th className="py-2 px-2 font-semibold">Status</th>
                              <th className="py-2 px-2 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#172233]">
                            {(() => {
                              const rowLedgers = loadAllLedgerItems();
                              return fam.students.map((student) => {
                                const sDef = getStudentFeeDefaults(student, rowLedgers, payments);
                                const { totalFee, totalPaid, remainingDue, currentMonthCollection: currentMonth, status: sStatus } = sDef;

                                const clsObj = classes.find(c => c.name.trim().toLowerCase() === (student.class || '').trim().toLowerCase());
                                const missingClassFee = (rowLedgers[student.id]?.length ?? 0) === 0 && (Number(clsObj?.fee) || 0) <= 0;

                                const studentFeeData: StudentFeeData = sDef;

                                return (
                                  <tr key={student.id} className="hover:bg-[#141d2a] transition-colors">
                                    {/* Student Name, Avatar & ID with Redirection */}
                                    <td className="py-2.5 px-2">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-purple-700/50 border border-purple-500/40 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                          {student.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            {/* Clicking student name redirects to profile */}
                                            <button
                                              type="button"
                                              onClick={() => onSelectStudent(student)}
                                              className="font-bold text-white hover:text-blue-400 hover:underline transition-colors text-left cursor-pointer"
                                              title="View student profile"
                                            >
                                              {student.name} ({student.id})
                                            </button>
                                            <Eye 
                                              className="w-3 h-3 text-slate-500 hover:text-blue-400 cursor-pointer" 
                                              onClick={() => onSelectStudent(student)} 
                                            />
                                          </div>
                                          {/* Student ID redirect */}
                                          <button
                                            type="button"
                                            onClick={() => onSelectStudent(student)}
                                            className="text-[11px] text-slate-400 font-mono hover:text-blue-400 text-left block"
                                          >
                                            {student.id}
                                          </button>
                                          {missingClassFee && (
                                            <div className="mt-1 text-[11px] text-amber-400">
                                              Set the class fee for {student.class || 'this class'} to start billing{' '}
                                              {onNavigateToClasses && (
                                                <button
                                                  type="button"
                                                  onClick={onNavigateToClasses}
                                                  className="underline font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                                                >
                                                  (Go to Classes)
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Class */}
                                    <td className="py-2.5 px-2 text-slate-300">
                                      <span className="font-semibold block">{student.class}</span>
                                      <span className="text-[11px] text-slate-500">{student.section || 'A'}</span>
                                    </td>

                                    {/* Total Fee */}
                                    <td className="py-2.5 px-2 font-semibold text-slate-200">
                                      {formatPKR(totalFee)}
                                    </td>

                                    {/* Total Paid */}
                                    <td className="py-2.5 px-2 font-semibold text-emerald-400">
                                      {formatPKR(totalPaid)}
                                    </td>

                                    {/* Remaining Due */}
                                    <td className="py-2.5 px-2 font-bold text-red-400">
                                      {formatPKR(remainingDue)}
                                    </td>

                                    {/* Current Month Collection */}
                                    <td className="py-2.5 px-2 font-semibold text-emerald-400">
                                      {formatPKR(currentMonth)}
                                    </td>

                                    {/* Status */}
                                    <td className="py-2.5 px-2">
                                      {sStatus === 'Unpaid' ? (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#3c1d1d] text-orange-400 border border-orange-500/30">
                                          Unpaid
                                        </span>
                                      ) : sStatus === 'Partially Paid' ? (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#382b17] text-amber-400 border border-amber-500/30">
                                          Partially Paid
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#163523] text-emerald-400 border border-emerald-500/30">
                                          Paid
                                        </span>
                                      )}
                                    </td>

                                    {/* Actions */}
                                    <td className="py-2.5 px-2 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {/* Pay button */}
                                        <button
                                          type="button"
                                          onClick={() => handleOpenStudentPay(studentFeeData)}
                                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                                        >
                                          Pay
                                        </button>

                                        {/* Print Challan */}
                                        <button
                                          type="button"
                                          onClick={() => handleOpenStudentChallan(studentFeeData)}
                                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1a2536] transition-colors cursor-pointer"
                                          title="Print Challan Slip"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Generate Fee Card */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFeeCardStudentId(studentFeeData.studentId);
                                            setIsFeeCardModalOpen(true);
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-[#1a2536] transition-colors cursor-pointer"
                                          title="Generate 2-Page Annual Fee Card"
                                        >
                                          <CreditCard className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Reminder (WhatsApp or Email) */}
                                        <button
                                          type="button"
                                          onClick={() => handleOpenStudentReminder(studentFeeData)}
                                          className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-[#1a2536] transition-colors cursor-pointer"
                                          title="Send Fee Reminder (WhatsApp or Email)"
                                          id={`btn-reminder-substudent-${student.id}`}
                                        >
                                          <BellRing className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* 6. STUDENT VIEW: Full Student Table */
        <div className="rounded-xl bg-[#141b26] border border-[#202d3e] overflow-hidden shadow-sm" id="fees-student-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-[#202d3e] bg-[#111723] text-[9.5px] uppercase tracking-wider">
                  <th className="py-3 px-3.5 font-semibold">Student</th>
                  <th className="py-3 px-3 font-semibold">Family & Phone</th>
                  <th className="py-3 px-3 font-semibold">Class</th>
                  <th className="py-3 px-3 font-semibold">Total Fee</th>
                  <th className="py-3 px-3 font-semibold">Total Paid</th>
                  <th className="py-3 px-3 font-semibold">Remaining Due</th>
                  <th className="py-3 px-3 font-semibold">Curr. Month</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b2637]">
                {(() => {
                  const rowLedgers = loadAllLedgerItems();
                  return studentFeeList.map((item) => {
                    const clsObj = classes.find(c => c.name.trim().toLowerCase() === (item.class || '').trim().toLowerCase());
                    const missingClassFee = (rowLedgers[item.studentId]?.length ?? 0) === 0 && (Number(clsObj?.fee) || 0) <= 0;
                    return (
                  <tr key={item.studentId} className="hover:bg-[#182130] transition-colors">
                    {/* Student */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-700/50 border border-blue-500/40 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {item.studentName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectStudent(item.originalStudent)}
                              className="font-bold text-white hover:text-blue-400 hover:underline transition-colors text-left cursor-pointer"
                              title="Go to student profile"
                            >
                              {item.studentName}
                            </button>
                            <Eye 
                              className="w-3 h-3 text-slate-500 hover:text-blue-400 cursor-pointer" 
                              onClick={() => onSelectStudent(item.originalStudent)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectStudent(item.originalStudent)}
                            className="text-[11px] text-slate-400 font-mono hover:text-blue-400 block text-left"
                          >
                            {item.studentId}
                          </button>
                          {missingClassFee && (
                            <div className="mt-1 text-[11px] text-amber-400">
                              Set the class fee for {item.class || 'this class'} to start billing{' '}
                              {onNavigateToClasses && (
                                <button
                                  type="button"
                                  onClick={onNavigateToClasses}
                                  className="underline font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                                >
                                  (Go to Classes)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Family & Phone */}
                    <td className="py-3 px-3 text-slate-300">
                      <span className="font-semibold block">{item.family}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{item.phone}</span>
                    </td>

                    {/* Class */}
                    <td className="py-3 px-3 text-slate-300">
                      <span className="font-semibold block">{item.class}</span>
                      <span className="text-[11px] text-slate-500">{item.section || 'A'}</span>
                    </td>

                    {/* Total Fee */}
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {formatPKR(item.totalFee)}
                    </td>

                    {/* Total Paid */}
                    <td className="py-3 px-3 font-semibold text-emerald-400">
                      {formatPKR(item.totalPaid)}
                    </td>

                    {/* Remaining Due */}
                    <td className="py-3 px-3 font-bold text-red-400">
                      {formatPKR(item.remainingDue)}
                    </td>

                    {/* Current Month */}
                    <td className="py-3 px-3 font-semibold text-emerald-400">
                      {formatPKR(item.currentMonthCollection)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {item.status === 'Unpaid' ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#3c1d1d] text-orange-400 border border-orange-500/30">
                          Unpaid
                        </span>
                      ) : item.status === 'Partially Paid' ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#382b17] text-amber-400 border border-amber-500/30">
                          Partially Paid
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#163523] text-emerald-400 border border-emerald-500/30">
                          Paid
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenStudentPay(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                        >
                          Pay
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenStudentChallan(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#222f42] transition-colors cursor-pointer"
                          title="Print Challan Slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFeeCardStudentId(item.studentId);
                            setIsFeeCardModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-[#222f42] transition-colors cursor-pointer"
                          title="Generate 2-Page Annual Fee Card"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenStudentReminder(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-[#222f42] transition-colors cursor-pointer"
                          title="Send Fee Reminder (WhatsApp or Email)"
                          id={`btn-reminder-student-${item.studentId}`}
                        >
                          <BellRing className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Interactive Modals */}
      <FeeReminderModal
        isOpen={reminderModalState.isOpen}
        onClose={() => setReminderModalState(prev => ({ ...prev, isOpen: false }))}
        recipientName={reminderModalState.recipientName}
        phone={reminderModalState.phone}
        email={reminderModalState.email}
        familyId={reminderModalState.familyId}
        studentNames={reminderModalState.studentNames}
        amountDue={reminderModalState.amountDue}
        family={reminderModalState.family}
        students={reminderModalState.students || students}
        onSentConfirm={(channel) => {
          onShowToast(`Fee reminder dispatched via ${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} to ${reminderModalState.recipientName}`);
        }}
      />

      <FeePaymentModal
        isOpen={paymentModalState.isOpen}
        onClose={() => setPaymentModalState(prev => ({ ...prev, isOpen: false }))}
        title={paymentModalState.title}
        familyOrStudentName={paymentModalState.name}
        identifier={paymentModalState.identifier}
        totalDue={paymentModalState.totalDue}
        totalPaid={paymentModalState.totalPaid}
        availableCredit={(() => {
          if (paymentModalState.studentId) {
            const st = students.find(s => isMatchingId(s.id, paymentModalState.studentId)) || students.find(s => s.id === paymentModalState.studentId);
            return st ? getCreditForStudents([st]) : 0;
          }
          if (paymentModalState.familyId) {
            const fam = families.find(f => f.familyId === paymentModalState.familyId);
            return fam ? getCreditForStudents(fam.students) : 0;
          }
          return 0;
        })()}
        onRecordPayment={handleRecordPayment}
        onPrintChallan={() => {
          setPaymentModalState(prev => ({ ...prev, isOpen: false }));
          if (paymentModalState.studentId) {
            const sf = studentFeeList.find(s => s.studentId === paymentModalState.studentId);
            if (sf) handleOpenStudentChallan(sf);
          } else if (paymentModalState.familyId) {
            const fam = families.find(f => f.familyId === paymentModalState.familyId);
            if (fam) handleOpenFamilyChallan(fam);
          }
        }}
      />

      <FeeChallanModal
        isOpen={challanModalState.isOpen}
        onClose={() => setChallanModalState(prev => ({ ...prev, isOpen: false, multipleChallans: undefined }))}
        title={challanModalState.title}
        name={challanModalState.name}
        idNumber={challanModalState.idNumber}
        className={challanModalState.className}
        section={challanModalState.section}
        phone={challanModalState.phone}
        totalFee={challanModalState.totalFee}
        totalPaid={challanModalState.totalPaid}
        remainingDue={challanModalState.remainingDue}
        challanNumber={challanModalState.challanNumber}
        issueDate={challanModalState.issueDate}
        dueDate={challanModalState.dueDate}
        validityDate={challanModalState.validityDate}
        feeRange={challanModalState.feeRange}
        multipleChallans={challanModalState.multipleChallans}
        studentIds={challanModalState.studentIds}
      />

      {/* Generate Challan Configuration Wizard (Image 1 reference) */}
      <GenerateChallanModal
        isOpen={isGenerateChallanModalOpen}
        onClose={() => setIsGenerateChallanModalOpen(false)}
        families={families}
        students={students}
        classes={classes}
        onShowToast={(msg, type) => onShowToast(msg)}
        onOpenChallanView={(generatedList) => {
          if (generatedList.length > 0) {
            setChallanModalState({
              isOpen: true,
              title: 'Generated Fee Challans',
              name: generatedList[0].targetName,
              idNumber: generatedList[0].targetId,
              className: generatedList[0].className,
              section: generatedList[0].section,
              phone: generatedList[0].phone,
              totalFee: generatedList[0].amount,
              totalPaid: 0,
              remainingDue: generatedList[0].amount,
              challanNumber: generatedList[0].challanNumber,
              issueDate: generatedList[0].issueDate,
              dueDate: generatedList[0].dueDate,
              validityDate: generatedList[0].validityDate,
              feeRange: generatedList[0].feeRange,
              multipleChallans: generatedList
            });
          }
        }}
      />

      {/* Fees Report Preview Modal (Strictly required fields, Cancel or Print/Save options) */}
      <FeesReportModal
        isOpen={isFeesReportModalOpen}
        onClose={() => setIsFeesReportModalOpen(false)}
        section={activeView}
        items={activeExportItems}
      />

      {/* 2-Page Annual Fee Card Modal */}
      <FeeCardModal
        isOpen={isFeeCardModalOpen}
        onClose={() => {
          setIsFeeCardModalOpen(false);
          setFeeCardStudentId(undefined);
        }}
        students={students}
        classes={classes}
        initialSelectedStudentId={feeCardStudentId}
        onShowToast={onShowToast}
      />

      {/* Get Challan Selection & Payment Deduction Modal (Popup 1 Select IDs -> Popup 2 Pay & Deduct) */}
      <GetChallanModal
        isOpen={isGetChallanModalOpen}
        onClose={() => setIsGetChallanModalOpen(false)}
        students={students}
        families={families}
        onPayAndDeduct={handlePayAndDeductChallans}
      />
    </div>
  );
};
