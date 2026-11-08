import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  GraduationCap, 
  Users, 
  Briefcase, 
  UserPlus,
  Banknote, 
  CalendarCheck, 
  FileText, 
  Receipt, 
  Award, 
  IdCard, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  Plus,
  Send,
  ShieldAlert,
  CheckCircle2,
  Phone,
  MessageCircle,
  HelpCircle,
  UserCheck,
  Building,
  RotateCw,
  Search,
  Filter,
  DollarSign,
  Calendar,
  X,
  Sparkles,
  ExternalLink,
  Smartphone,
  ChevronDown,
  Info,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { Student, ClassInfo, StaffMember, AttendanceRecord } from '../types';
import { SchoolSettings } from '../utils/settingsHelper';
import { 
  LedgerTransaction, 
  getLedgerTransactions, 
  addLedgerTransaction, 
  formatPKR,
  formatLac,
  LedgerDateRangeOption,
  LedgerGraphMode,
  getLedgerGraphSettings,
  saveLedgerGraphSettings,
  computeLedgerGraphData,
  formatLedgerYAxisLabel,
  LEDGER_DATE_RANGE_LABELS
} from '../utils/ledgerStore';
import { groupStudentsIntoFamilies } from '../utils/familyHelper';
import { getStudentFeeDefaults } from '../utils/feeHelper';
import { loadAllLedgerItems } from '../utils/studentFeeLedgerHelper';
import { addCharge, listPayments } from '../utils/paymentStore';
import { getStoredExams, Exam } from '../utils/examStore';
import { 
  StudentInquiry, 
  getStoredInquiries, 
  addInquiry, 
  updateInquiryStatus, 
  saveStoredInquiries 
} from '../utils/inquiryStore';
import { 
  Announcement, 
  getStoredAnnouncements, 
  addAnnouncement 
} from '../utils/announcementStore';
import { RecordTransactionModal } from './RecordTransactionModal';
import { AppModule } from './VerticalNavBar';
import { getAvatarColor, getInitials } from '../data/initialStudents';
import { listPayrollPeriods, listPayrollRecords } from '../utils/payrollApi';
import { monthKeyOf } from '../utils/dates';

export type DashboardDateRange = 'this-month' | 'last-30' | 'this-week' | 'today' | 'academic-year';

interface OverviewModuleProps {
  students: Student[];
  staff: StaffMember[];
  classes: ClassInfo[];
  allAttendance: Record<string, AttendanceRecord[]>;
  schoolSettings?: SchoolSettings;
  onNavigateModule: (module: AppModule) => void;
  onSelectStudent?: (student: Student) => void;
  onNavigateToFamily?: () => void;
  onOpenAddStudent: () => void;
  onOpenAddStaff: () => void;
  onOpenPayStaff?: (member?: StaffMember) => void;
  onOpenFeePayment: () => void;
  onOpenGenerateChallan: () => void;
  onOpenIdCards: () => void;
  onOpenBackup: () => void;
  onPayStudentFee?: (student: Student) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({
  students = [],
  staff = [],
  classes = [],
  allAttendance = {},
  schoolSettings,
  onNavigateModule,
  onSelectStudent,
  onNavigateToFamily,
  onOpenAddStudent,
  onOpenAddStaff,
  onOpenPayStaff,
  onOpenFeePayment,
  onOpenGenerateChallan,
  onOpenIdCards,
  onOpenBackup,
  onPayStudentFee,
  onShowToast
}) => {
  // =========================================================================
  // 1. STATE & PERSISTENCE
  // =========================================================================
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[]>(() => getLedgerTransactions());
  const [feeVersion, setFeeVersion] = useState(0);
  const [inquiries, setInquiries] = useState<StudentInquiry[]>(() => getStoredInquiries());
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => getStoredAnnouncements());
  const [exams, setExams] = useState<Exam[]>(() => getStoredExams());

  // Salary-due aggregate from the payroll tables (PAYROLL_PLAN §3.5): the sum
  // of outstanding over all prepared periods up to the current month. Zeros
  // until the first period is prepared, and when the app server is
  // unreachable (browser-only demo) — never an accrual estimate.
  const [payrollDue, setPayrollDue] = useState<{ total: number; unpaidIds: Set<string>; owedRecords: number }>({
    total: 0, unpaidIds: new Set(), owedRecords: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = monthKeyOf();
        const periods = await listPayrollPeriods();
        const due = periods.filter(p => p.periodKey <= key);
        let total = 0;
        let owedRecords = 0;
        const unpaidIds = new Set<string>();
        for (const p of due) {
          const { records } = await listPayrollRecords(p.periodKey);
          for (const r of records) {
            if (r.outstanding > 0) {
              total += r.outstanding;
              owedRecords += 1;
              unpaidIds.add(r.staffId);
            }
          }
        }
        if (!cancelled) setPayrollDue({ total, unpaidIds, owedRecords });
      } catch {
        /* server unreachable → keep zeros */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Shared Ledger Graph states (Two-way synced with LedgerModule)
  const [ledgerGraphMode, setLedgerGraphModeState] = useState<LedgerGraphMode>(() => getLedgerGraphSettings().graphMode);
  const [ledgerDateRange, setLedgerDateRangeState] = useState<LedgerDateRangeOption>(() => getLedgerGraphSettings().dateRange);
  const [isLedgerDateRangeOpen, setIsLedgerDateRangeOpen] = useState(false);
  const ledgerDateRangeRef = useRef<HTMLDivElement>(null);
  const [hoveredLedgerPoint, setHoveredLedgerPoint] = useState<{
    x: number;
    y: number;
    date: string;
    amount: number;
    income: number;
    expense: number;
  } | null>(null);

  const setLedgerGraphMode = (mode: LedgerGraphMode) => {
    setLedgerGraphModeState(mode);
    saveLedgerGraphSettings({ graphMode: mode });
  };

  const setLedgerDateRange = (range: LedgerDateRangeOption) => {
    setLedgerDateRangeState(range);
    saveLedgerGraphSettings({ dateRange: range });
  };

  // Right Analytics Card mode: 'ledger-radial' (Profit/Expense/Income) | 'fee-donut' (Collected/Due)
  const [rightChartView, setRightChartView] = useState<'ledger-radial' | 'fee-donut'>('ledger-radial');
  const [hoveredRadialStrip, setHoveredRadialStrip] = useState<'profit' | 'expense' | 'income' | null>(null);
  const [selectedDonutOption, setSelectedDonutOption] = useState<'collected' | 'due'>('collected');

  // Attendance Trend states (Monthly based, draggable left to right, minimal view)
  const [attendanceTarget, setAttendanceTarget] = useState<'students' | 'staff'>('students');
  const attendanceScrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingAttendanceGraph, setIsDraggingAttendanceGraph] = useState(false);
  const [dragStartAttendanceX, setDragStartAttendanceX] = useState(0);
  const [dragStartAttendanceScrollLeft, setDragStartAttendanceScrollLeft] = useState(0);
  const [activeAttendanceHoverIndex, setActiveAttendanceHoverIndex] = useState<number | null>(null);

  // Close ledger date range dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ledgerDateRangeRef.current && !ledgerDateRangeRef.current.contains(event.target as Node)) {
        setIsLedgerDateRangeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Automatically scroll attendance chart to the right on load / target change so latest months are in view
  useEffect(() => {
    const scrollToLatestAttendanceMonths = () => {
      const el = attendanceScrollContainerRef.current;
      if (el) {
        el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      }
    };
    scrollToLatestAttendanceMonths();
    const timer = setTimeout(scrollToLatestAttendanceMonths, 100);
    return () => clearTimeout(timer);
  }, [attendanceTarget]);

  // Defaulters filtering
  const [defaulterFilter, setDefaulterFilter] = useState<'all' | 'high' | 'medium'>('all');

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordModalType, setRecordModalType] = useState<'Incoming' | 'Outgoing'>('Incoming');
  const [isAddFineModalOpen, setIsAddFineModalOpen] = useState(false);
  const [isSendAnnouncementModalOpen, setIsSendAnnouncementModalOpen] = useState(false);
  const [isAddInquiryModalOpen, setIsAddInquiryModalOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<StudentInquiry | null>(null);

  // Reload external stores on mount or manual refresh
  const reloadData = () => {
    setIsRefreshing(true);
    setLedgerTransactions(getLedgerTransactions());
    setFeeVersion(v => v + 1);
    const graphSettings = getLedgerGraphSettings();
    setLedgerGraphModeState(graphSettings.graphMode);
    setLedgerDateRangeState(graphSettings.dateRange);
    setInquiries(getStoredInquiries());
    setAnnouncements(getStoredAnnouncements());
    setExams(getStoredExams());
    setTimeout(() => {
      setIsRefreshing(false);
      onShowToast?.('Dashboard synchronized with latest records', 'info');
    }, 400);
  };

  useEffect(() => {
    const handleLedgerUpdate = () => {
      setLedgerTransactions(getLedgerTransactions());
    };
    const handleGraphSettingsUpdate = () => {
      const settings = getLedgerGraphSettings();
      setLedgerGraphModeState(settings.graphMode);
      setLedgerDateRangeState(settings.dateRange);
    };
    const handleFeeDataUpdate = () => {
      setFeeVersion(v => v + 1);
    };
    const handleStorageChange = () => {
      handleLedgerUpdate();
      handleGraphSettingsUpdate();
      handleFeeDataUpdate();
      setInquiries(getStoredInquiries());
      setAnnouncements(getStoredAnnouncements());
      setExams(getStoredExams());
    };

    window.addEventListener('ledgerTransactionsUpdated', handleLedgerUpdate);
    window.addEventListener('ledgerGraphSettingsUpdated', handleGraphSettingsUpdate);
    window.addEventListener('feeDataUpdated', handleFeeDataUpdate);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('ledgerTransactionsUpdated', handleLedgerUpdate);
      window.removeEventListener('ledgerGraphSettingsUpdated', handleGraphSettingsUpdate);
      window.removeEventListener('feeDataUpdated', handleFeeDataUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // =========================================================================
  // 2. CORE REAL METRIC CALCULATIONS
  // =========================================================================

  // Group students into real families
  const families = useMemo(() => {
    return groupStudentsIntoFamilies(students);
  }, [students]);

  // Active vs Inactive students (100% real data, no fake multiplier)
  const studentMetrics = useMemo(() => {
    const total = students.length;
    const active = students.filter(s => s.status === 'Active').length;
    const inactive = total - active;
    
    // New students: admitted in 2025/2026
    const newStudents = students.filter(s => {
      if (!s.admissionDate) return false;
      try {
        const adm = new Date(s.admissionDate);
        const cutoff = new Date('2025-01-01');
        return adm >= cutoff;
      } catch {
        return false;
      }
    });

    return {
      total,
      active,
      inactive,
      newCount: newStudents.length
    };
  }, [students]);

  // Staff breakdown; salary-due figures come from the payroll aggregate
  // fetched above (prepared periods only, derived from actual payments).
  const staffMetrics = useMemo(() => {
    const total = staff.length;
    const teachers = staff.filter(s => s.category === 'Teacher' || s.role.toLowerCase().includes('teacher')).length;
    const support = total - teachers;
    const onLeave = staff.filter(s => s.status === 'On Leave');
    const unpaidStaff = staff.filter(member => payrollDue.unpaidIds.has(member.id));

    return {
      total,
      teachers,
      support,
      onLeave,
      unpaidStaff,
      totalSalaryDue: payrollDue.total,
      totalOwedMonthsCount: payrollDue.owedRecords
    };
  }, [staff, payrollDue]);

  // Unified real-time Ledger Graph & Summary Calculations (matches LedgerModule)
  const ledgerGraphData = useMemo(() => {
    return computeLedgerGraphData(ledgerTransactions, ledgerDateRange, ledgerGraphMode);
  }, [ledgerTransactions, ledgerDateRange, ledgerGraphMode]);

  // Financial summary from real fee calculations & ledger
  const financialMetrics = useMemo(() => {
    let studentBilled = 0;
    let studentCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;

    const defaultersList: {
      student: Student;
      totalFee: number;
      totalPaid: number;
      remainingDue: number;
      priority: 'High' | 'Medium' | 'Low';
    }[] = [];

    const ledgers = loadAllLedgerItems();
    const payments = listPayments();
    students.forEach(s => {
      const def = getStudentFeeDefaults(s, ledgers, payments);
      const { totalFee, totalPaid, remainingDue } = def;

      studentBilled += totalFee;
      studentCollected += totalPaid;
      totalOutstanding += remainingDue;

      if (remainingDue > 0) {
        let priority: 'High' | 'Medium' | 'Low' = 'Low';
        if (remainingDue >= 10000) {
          priority = 'High';
          totalOverdue += remainingDue;
        } else if (remainingDue >= 5000) {
          priority = 'Medium';
        }

        defaultersList.push({
          student: s,
          totalFee,
          totalPaid,
          remainingDue,
          priority
        });
      }
    });

    // Fees Collected / Total Billed count ONLY real student fee charges
    // and payments (owner directive 2026-11-08): money added directly in
    // the Ledger as "Incoming" (the opposite of an expense) is school
    // income, but it is NOT a fee payment, so it must never inflate the
    // fee figures — previously it was added into both totals here. Ledger
    // income still appears in the Ledger module and in the ledger
    // income/expense graph above, where it belongs.
    const totalCollected = studentCollected;
    const totalBilled = studentBilled;

    // Sort defaulters by outstanding amount descending
    defaultersList.sort((a, b) => b.remainingDue - a.remainingDue);

    const collectionRate = totalBilled > 0 ? Math.min(100, (totalCollected / totalBilled) * 100) : 0;

    return {
      totalBilled,
      totalCollected,
      totalOutstanding,
      totalOverdue,
      collectionRate,
      defaultersList
    };
  }, [students, feeVersion]);

  // Filtered Defaulters
  const displayedDefaulters = useMemo(() => {
    if (defaulterFilter === 'high') {
      return financialMetrics.defaultersList.filter(d => d.priority === 'High');
    }
    if (defaulterFilter === 'medium') {
      return financialMetrics.defaultersList.filter(d => d.priority === 'Medium' || d.priority === 'High');
    }
    return financialMetrics.defaultersList.slice(0, 7);
  }, [financialMetrics.defaultersList, defaulterFilter]);

  // Real-time Attendance metrics calculated strictly from actual allAttendance records
  const attendanceMetrics = useMemo(() => {
    const targetType = attendanceTarget === 'students' ? 'student' : 'staff';
    const dates = Object.keys(allAttendance).sort();
    let totalPresent = 0;
    let totalMarked = 0;

    dates.forEach(date => {
      const records = allAttendance[date] || [];
      records.forEach(rec => {
        if (rec.type === targetType && rec.status !== 'not_marked') {
          totalMarked++;
          if (rec.status === 'present' || rec.status === 'late') {
            totalPresent++;
          }
        }
      });
    });

    const averageRate = totalMarked > 0 ? Number(((totalPresent / totalMarked) * 100).toFixed(1)) : 0;

    // Find latest date with marked records for targetType (or today)
    const todayIso = new Date().toISOString().slice(0, 10);
    let activeTodayDate = todayIso;
    if (!allAttendance[activeTodayDate] || !allAttendance[activeTodayDate].some(r => r.type === targetType && r.status !== 'not_marked')) {
      const markedDates = dates.filter(d => (allAttendance[d] || []).some(r => r.type === targetType && r.status !== 'not_marked'));
      if (markedDates.length > 0) {
        activeTodayDate = markedDates[markedDates.length - 1];
      }
    }

    const todayRecords = (allAttendance[activeTodayDate] || []).filter(r => r.type === targetType && r.status !== 'not_marked');
    const todayPresent = todayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    const todayAbsent = todayRecords.filter(r => r.status === 'absent').length;
    const todayRate = todayRecords.length > 0
      ? Number(((todayPresent / todayRecords.length) * 100).toFixed(1))
      : 0;

    return {
      averageRate,
      todayRate,
      todayPresent,
      todayAbsent
    };
  }, [allAttendance, attendanceTarget]);

  // Real-time Monthly Attendance Percentages (12 months calculated strictly from allAttendance)
  const monthlyAttendanceData = useMemo(() => {
    const targetType = attendanceTarget === 'students' ? 'student' : 'staff';
    const monthsDef = [
      { id: 'm1', prefix: '2025-10', month: "Oct '25", shortMonth: 'Oct' },
      { id: 'm2', prefix: '2025-11', month: "Nov '25", shortMonth: 'Nov' },
      { id: 'm3', prefix: '2025-12', month: "Dec '25", shortMonth: 'Dec' },
      { id: 'm4', prefix: '2026-01', month: "Jan '26", shortMonth: 'Jan' },
      { id: 'm5', prefix: '2026-02', month: "Feb '26", shortMonth: 'Feb' },
      { id: 'm6', prefix: '2026-03', month: "Mar '26", shortMonth: 'Mar' },
      { id: 'm7', prefix: '2026-04', month: "Apr '26", shortMonth: 'Apr' },
      { id: 'm8', prefix: '2026-05', month: "May '26", shortMonth: 'May' },
      { id: 'm9', prefix: '2026-06', month: "Jun '26", shortMonth: 'Jun' },
      { id: 'm10', prefix: '2026-07', month: "Jul '26", shortMonth: 'Jul' },
      { id: 'm11', prefix: '2026-08', month: "Aug '26", shortMonth: 'Aug' },
      { id: 'm12', prefix: '2026-09', month: "Sep '26", shortMonth: 'Sep' },
      { id: 'm13', prefix: '2026-10', month: "Oct '26", shortMonth: 'Oct 26' }
    ];

    const dates = Object.keys(allAttendance);

    return monthsDef.map((m) => {
      let monthPresent = 0;
      let monthMarked = 0;

      dates.forEach(dateKey => {
        if (dateKey.startsWith(m.prefix)) {
          const records = allAttendance[dateKey] || [];
          records.forEach(rec => {
            if (rec.type === targetType && rec.status !== 'not_marked') {
              monthMarked++;
              if (rec.status === 'present' || rec.status === 'late') {
                monthPresent++;
              }
            }
          });
        }
      });

      const rate = monthMarked > 0 ? Number(((monthPresent / monthMarked) * 100).toFixed(1)) : 0;

      return {
        id: m.id,
        month: m.month,
        shortMonth: m.shortMonth,
        rate,
        markedCount: monthMarked
      };
    });
  }, [allAttendance, attendanceTarget]);

  // Summary statistics for monthly attendance (Total, Average, Peak, Today's Rate)
  const monthlyAttendanceSummary = useMemo(() => {
    const total = attendanceTarget === 'students' ? students.length : staff.length;
    const monthsWithRecords = monthlyAttendanceData.filter(d => d.markedCount > 0);
    if (monthsWithRecords.length === 0) {
      return { 
        average: 0, 
        peak: 0, 
        total
      };
    }
    const sum = monthsWithRecords.reduce((acc, curr) => acc + curr.rate, 0);
    const avg = Number((sum / monthsWithRecords.length).toFixed(1));
    const peak = Math.max(...monthsWithRecords.map(d => d.rate));
    return { average: avg, peak, total };
  }, [monthlyAttendanceData, attendanceTarget, students.length, staff.length]);


  // Needs Attention items
  const attentionItems = useMemo(() => {
    const items = [];

    // 1. Fee Defaulters
    const highDefaulters = financialMetrics.defaultersList.filter(d => d.priority === 'High');
    if (highDefaulters.length > 0) {
      items.push({
        id: 'att-defaulters',
        title: `${highDefaulters.length} Fee Defaulters`,
        description: `Overdue balances exceeding Rs. 10,000 requiring immediate reminders`,
        severity: 'high' as const,
        actionLabel: 'Review Dues',
        onAction: () => onNavigateModule('fees')
      });
    }

    // 2. Pending Inquiries
    const pendingInquiries = inquiries.filter(i => i.status === 'Pending Review');
    if (pendingInquiries.length > 0) {
      items.push({
        id: 'att-inquiries',
        title: `${pendingInquiries.length} Pending Inquiries`,
        description: `Prospective admission applicants awaiting initial review and scheduling`,
        severity: 'medium' as const,
        actionLabel: 'Evaluate',
        onAction: () => {
          setSelectedInquiry(pendingInquiries[0]);
        }
      });
    }

    // 3. Attendance Not Marked Check
    const todayKey = new Date().toISOString().slice(0, 10);
    const missingAttendanceClasses = classes.filter(c => {
      // Fix P0-4: "today" means today only. If no attendance is recorded for
      // today, the class honestly counts as pending below — another day's
      // records are never substituted for today's.
      const classAttendance = (allAttendance[todayKey] || []).filter(r => r.class === c.name && r.status !== 'not_marked');
      return classAttendance.length === 0;
    });

    if (missingAttendanceClasses.length > 0) {
      items.push({
        id: 'att-attendance',
        title: `Attendance Pending`,
        description: `${missingAttendanceClasses.length} class sections have not finalized roll calls for today`,
        severity: 'medium' as const,
        actionLabel: 'Mark Now',
        onAction: () => onNavigateModule('attendance')
      });
    }

    // 4. Accrued Staff Salaries Pending Disbursal
    if (staffMetrics.unpaidStaff.length > 0) {
      items.push({
        id: 'att-staff-salary',
        title: `${staffMetrics.unpaidStaff.length} Staff Salaries Owed`,
        description: `Rs. ${staffMetrics.totalSalaryDue.toLocaleString()} accrued across ${staffMetrics.totalOwedMonthsCount} owed month(s) ready for payout`,
        severity: 'high' as const,
        actionLabel: 'Pay Staff',
        onAction: () => {
          if (onOpenPayStaff) onOpenPayStaff();
          else onNavigateModule('staff');
        }
      });
    }

    // 5. Exams awaiting result publishing
    const pendingExams = exams.filter(e => !e.resultsCount || e.resultsCount < 5);
    if (pendingExams.length > 0) {
      items.push({
        id: 'att-exams',
        title: `${pendingExams.length} Exams Awaiting Results`,
        description: `Submitted examination mark sheets ready for verification & report generation`,
        severity: 'low' as const,
        actionLabel: 'Review Marks',
        onAction: () => onNavigateModule('exam')
      });
    }

    return items;
  }, [financialMetrics.defaultersList, inquiries, classes, allAttendance, exams, staffMetrics, onOpenPayStaff, onNavigateModule]);

  // =========================================================================
  // 3. INTERACTIVE CHART DATA GENERATION
  // =========================================================================

  // Active center display for Ledger Radial Chart (Profit / Expense / Income)
  const activeLedgerRadialData = useMemo(() => {
    const current = hoveredRadialStrip || 'profit';
    if (current === 'profit') {
      return {
        label: 'Profit',
        amount: ledgerGraphData.totalBalance,
        color: '#10b981',
        lacStr: formatLac(ledgerGraphData.totalBalance)
      };
    }
    if (current === 'expense') {
      return {
        label: 'Expense',
        amount: ledgerGraphData.totalExpense,
        color: '#f97316',
        lacStr: formatLac(ledgerGraphData.totalExpense)
      };
    }
    return {
      label: 'Income',
      amount: ledgerGraphData.totalIncome,
      color: '#eab308',
      lacStr: formatLac(ledgerGraphData.totalIncome)
    };
  }, [hoveredRadialStrip, ledgerGraphData]);

  // Collection Status Doughnut Slices (Selected stripe is wider, overall narrower, bigger radius, no overlap)
  const donutData = useMemo(() => {
    const collected = financialMetrics.totalCollected;
    const due = financialMetrics.totalOutstanding;
    const total = collected + due;

    const collectedPct = total > 0 ? (collected / total) * 100 : 0;
    const duePct = total > 0 ? (due / total) * 100 : 0;

    const radius = 62;
    const baseStrokeWidth = 15;
    const selectedStrokeWidth = 23;
    const circumference = 2 * Math.PI * radius;

    const gapDistance = (selectedStrokeWidth / 2) + (baseStrokeWidth / 2) + 2;
    const totalGap = 2 * gapDistance;
    const availableCircumference = Math.max(0, circumference - totalGap);
    const strokeCollected = total > 0 ? Math.max(8, (collectedPct / 100) * availableCircumference) : 0;
    const strokeDue = total > 0 ? Math.max(8, availableCircumference - strokeCollected) : 0;

    const offsetCollected = -(gapDistance / 2);
    const offsetDue = -((gapDistance / 2) + strokeCollected + gapDistance);

    return {
      total,
      circumference,
      radius,
      baseStrokeWidth,
      selectedStrokeWidth,
      collected,
      due,
      collectedPct,
      duePct,
      slices: [
        {
          id: 'collected' as const,
          label: 'Collected Fees',
          amount: collected,
          pct: collectedPct,
          color: '#38bdf8',
          strokeDash: `${strokeCollected} ${circumference}`,
          strokeOffset: offsetCollected
        },
        {
          id: 'due' as const,
          label: 'Current Due',
          amount: due,
          pct: duePct,
          color: '#f59e0b',
          strokeDash: `${strokeDue} ${circumference}`,
          strokeOffset: offsetDue
        }
      ]
    };
  }, [financialMetrics]);

  // Attendance Trend SVG Curve calculations (0% to 100% real-time scale)
  const attendanceCurveData = useMemo(() => {
    const width = 1200;
    const height = 180;
    const paddingX = 50;
    const paddingY = 25;
    const usableHeight = height - 2 * paddingY; // 130px

    // Full real-time range from 0% to 100%
    const minRate = 0;
    const maxRate = 100;

    const points = monthlyAttendanceData.map((d, index) => {
      const x = paddingX + (index / (monthlyAttendanceData.length - 1)) * (width - 2 * paddingX);
      const clampedRate = Math.max(minRate, Math.min(maxRate, d.rate));
      const y = height - paddingY - ((clampedRate - minRate) / (maxRate - minRate)) * usableHeight;
      return { x, y, data: d };
    });

    // Catmull-Rom or cubic bezier path
    let pathD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
    }

    const areaD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
      : '';

    // Clean Y-axis percentage ticks (100%, 75%, 50%, 25%, 0%)
    const ticks = [100, 75, 50, 25, 0];
    const yTicks = ticks.map((val) => {
      const y = paddingY + ((100 - val) / 100) * usableHeight;
      return { val, y, label: `${val}%` };
    });

    return {
      points,
      pathD,
      areaD,
      yTicks,
      width,
      height
    };
  }, [monthlyAttendanceData]);

  // Mouse drag & wheel scrolling handlers for attendance chart
  const handleAttendanceMouseDown = (e: React.MouseEvent) => {
    if (!attendanceScrollContainerRef.current) return;
    setIsDraggingAttendanceGraph(true);
    setDragStartAttendanceX(e.pageX - attendanceScrollContainerRef.current.offsetLeft);
    setDragStartAttendanceScrollLeft(attendanceScrollContainerRef.current.scrollLeft);
  };

  const handleAttendanceMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingAttendanceGraph || !attendanceScrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - attendanceScrollContainerRef.current.offsetLeft;
    const walk = (x - dragStartAttendanceX) * 1.5;
    attendanceScrollContainerRef.current.scrollLeft = dragStartAttendanceScrollLeft - walk;
  };

  const handleAttendanceMouseUp = () => {
    setIsDraggingAttendanceGraph(false);
  };

  const handleAttendanceWheel = (e: React.WheelEvent) => {
    if (attendanceScrollContainerRef.current) {
      if (Math.abs(e.deltaX) > 0) {
        attendanceScrollContainerRef.current.scrollLeft += e.deltaX;
      } else if (Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        attendanceScrollContainerRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const handleAttendanceTouchStart = (e: React.TouchEvent) => {
    if (!attendanceScrollContainerRef.current) return;
    setIsDraggingAttendanceGraph(true);
    setDragStartAttendanceX(e.touches[0].pageX - attendanceScrollContainerRef.current.offsetLeft);
    setDragStartAttendanceScrollLeft(attendanceScrollContainerRef.current.scrollLeft);
  };

  const handleAttendanceTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingAttendanceGraph || !attendanceScrollContainerRef.current) return;
    const x = e.touches[0].pageX - attendanceScrollContainerRef.current.offsetLeft;
    const walk = (x - dragStartAttendanceX) * 1.5;
    attendanceScrollContainerRef.current.scrollLeft = dragStartAttendanceScrollLeft - walk;
  };

  const handleAttendanceTouchEnd = () => {
    setIsDraggingAttendanceGraph(false);
  };

  // =========================================================================
  // 4. ACTION HANDLERS
  // =========================================================================

  // Handle Fine Addition
  const handleAddFine = (studentId: string, fineAmount: number, reason: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    addCharge(student, { type: 'Fine', reason, amount: fineAmount });
    setFeeVersion(v => v + 1);
    setIsAddFineModalOpen(false);
    onShowToast?.(`Fine of Rs. ${fineAmount.toLocaleString()} added to ${student.name}'s fee dues`, 'success');
  };

  // Handle Announcement
  const handleSendAnnouncement = (newAnnouncement: Omit<Announcement, 'id' | 'date' | 'rawDate'>) => {
    addAnnouncement(newAnnouncement);
    setAnnouncements(getStoredAnnouncements());
    setIsSendAnnouncementModalOpen(false);
    onShowToast?.(`Announcement broadcasted to ${newAnnouncement.audience} successfully!`, 'success');
  };

  // Handle Inquiries
  const handleUpdateInquiry = (id: string, newStatus: StudentInquiry['status']) => {
    const updated = updateInquiryStatus(id, newStatus);
    setInquiries(updated);
    if (selectedInquiry?.id === id) {
      setSelectedInquiry({ ...selectedInquiry, status: newStatus });
    }
    onShowToast?.(`Application status updated to "${newStatus}"`, 'info');
  };

  return (
    <div className="w-full space-y-5 pb-16 text-slate-100 font-sans selection:bg-blue-600 selection:text-white" id="schoolex-overview-dashboard">
      {/* ========================================================================= */}
      {/* TOP HEADER                                                                */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-edge-13">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Overview</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
              Academic Session 2025–2026
            </span>
          </div>
        </div>

        {/* Refresh Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reloadData}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-surface-14 border border-edge-13 hover:border-slate-600 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh dashboard data"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SUMMARY CARDS (4 Institutional Cards - Clean Data Display Only)         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-surface-14 border border-edge-13 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Students</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">{studentMetrics.total.toLocaleString()}</div>
          </div>
        </div>

        {/* Total Families */}
        <div className="bg-surface-14 border border-edge-13 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Families</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">{families.length.toLocaleString()}</div>
          </div>
        </div>

        {/* Total Staff */}
        <div className="bg-surface-14 border border-edge-13 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Staff</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">{staffMetrics.total.toLocaleString()}</div>
          </div>
        </div>

        {/* New Students */}
        <div className="bg-surface-14 border border-edge-13 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Students</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">{studentMetrics.newCount.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FINANCIAL SUMMARY (3 Cards Side by Side - Clean Data Display Only)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fees Collected */}
        <div className="bg-surface-14 border border-edge-13 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Banknote className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-300">Fees Collected</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {financialMetrics.collectionRate.toFixed(1)}% Rate
            </span>
          </div>

          <div className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Rs. {financialMetrics.totalCollected.toLocaleString()}
          </div>

          <div className="mt-3 w-full bg-edge-13 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(financialMetrics.collectionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Outstanding Fees */}
        <div className="bg-surface-14 border border-edge-13 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-300">Outstanding Fees</span>
            </div>
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {financialMetrics.defaultersList.length} Defaulters
            </span>
          </div>

          <div className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Rs. {financialMetrics.totalOutstanding.toLocaleString()}
          </div>

          <div className="mt-3 w-full bg-edge-13 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min((financialMetrics.totalOutstanding / (financialMetrics.totalBilled || 1)) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Staff Payments Due */}
        <div className="bg-surface-14 border border-edge-13 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-300">Staff Payments Due</span>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              staffMetrics.unpaidStaff.length > 0 
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' 
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>
              {staffMetrics.unpaidStaff.length > 0 ? `${staffMetrics.unpaidStaff.length} Unpaid` : 'All Disbursed'}
            </span>
          </div>

          <div className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Rs. {staffMetrics.totalSalaryDue.toLocaleString()}
          </div>

          <div className="mt-3 w-full bg-edge-13 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-rose-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${staffMetrics.total ? (staffMetrics.unpaidStaff.length / staffMetrics.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. QUICK ACTIONS (6 Core Institutional Actions)                           */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 3. QUICK ACTIONS (6 Core Institutional Actions)                           */}
      {/* ========================================================================= */}
      <div className="bg-surface-14 border border-edge-13 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Quick Actions</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Add Student */}
          <button
            type="button"
            onClick={onOpenAddStudent}
            id="quick-btn-add-student"
            className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-surface-30 hover:bg-[#1b263d] border border-[#23334e] hover:border-blue-500 text-slate-200 hover:text-white transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white">Add Student</span>
          </button>

          {/* 2. Add Staff */}
          <button
            type="button"
            onClick={onOpenAddStaff}
            id="quick-btn-add-staff"
            className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-surface-30 hover:bg-[#1b263d] border border-[#23334e] hover:border-purple-500 text-slate-200 hover:text-white transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white">Add Staff</span>
          </button>

          {/* 3. Pay Staff */}
          <button
            type="button"
            onClick={() => {
              if (onOpenPayStaff) onOpenPayStaff();
              else onNavigateModule('staff');
            }}
            id="quick-btn-pay-staff"
            className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-surface-30 hover:bg-[#1b263d] border border-[#23334e] hover:border-emerald-500 text-slate-200 hover:text-white transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Banknote className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white">Pay Staff</span>
          </button>

          {/* 4. Add Fine */}
          <button
            type="button"
            onClick={() => setIsAddFineModalOpen(true)}
            id="quick-btn-add-fine"
            className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-surface-30 hover:bg-[#1b263d] border border-[#23334e] hover:border-amber-500 text-slate-200 hover:text-white transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white">Add Fine</span>
          </button>

          {/* 5. Send Announcement */}
          <button
            type="button"
            onClick={() => setIsSendAnnouncementModalOpen(true)}
            id="quick-btn-send-announcement"
            className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-surface-30 hover:bg-[#1b263d] border border-[#23334e] hover:border-sky-500 text-slate-200 hover:text-white transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Send className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white">Announcement</span>
          </button>

          {/* 6. Add Income/Expense */}
          <button
            type="button"
            onClick={() => {
              setRecordModalType('Incoming');
              setIsRecordModalOpen(true);
            }}
            id="quick-btn-income-expense"
            className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-surface-30 hover:bg-[#1b263d] border border-[#23334e] hover:border-cyan-500 text-slate-200 hover:text-white transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-9 h-9 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white">Income / Expense</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LEDGER & FINANCIAL ANALYTICS (Real-Time Synced with Ledger Module)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Real-Time Ledger Financial Graph (7 cols - Synced with Ledger Module) */}
        <div 
          className="lg:col-span-7 bg-surface-14 border border-edge-13 rounded-xl p-5 flex flex-col justify-between shadow-lg"
          id="overview-ledger-graph-card"
        >
          <div>
            {/* Top Header Row: Title, Total Balance, Record Button & Open Ledger */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <span>Total Ledger Balance</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Live Ledger Sync
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono mt-1">
                  {formatPKR(ledgerGraphData.totalBalance)}
                </h2>
              </div>

              {/* Action Controls: Date Range Dropdown, Record Income/Expense & Open Ledger */}
              <div className="flex items-center flex-wrap gap-2">
                {/* Date Range Selector Dropdown (Synced with Ledger) */}
                <div className="relative" ref={ledgerDateRangeRef}>
                  <button
                    type="button"
                    onClick={() => setIsLedgerDateRangeOpen(!isLedgerDateRangeOpen)}
                    className="px-3 py-1.5 rounded-lg bg-surface-35 hover:bg-[#1d2c45] border border-[#23344d] text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                    id="btn-overview-ledger-date-range"
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>{LEDGER_DATE_RANGE_LABELS[ledgerDateRange]}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {isLedgerDateRangeOpen && (
                    <div className="absolute right-0 mt-1.5 w-48 bg-[#0e1625] border border-[#20324d] rounded-xl shadow-2xl py-1.5 z-40 text-xs">
                      {(['current_month', 'last_month', 'last_year', 'five_years', 'all_time'] as LedgerDateRangeOption[]).map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setLedgerDateRange(opt);
                            setIsLedgerDateRangeOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 hover:bg-[#182538] transition-colors cursor-pointer ${
                            ledgerDateRange === opt ? 'text-blue-400 font-bold bg-surface-33' : 'text-slate-300'
                          }`}
                        >
                          {LEDGER_DATE_RANGE_LABELS[opt]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Record Income/Expense Button */}
                <button
                  type="button"
                  onClick={() => {
                    setRecordModalType(ledgerGraphMode === 'expenses' ? 'Outgoing' : 'Incoming');
                    setIsRecordModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  id="btn-overview-record-ledger"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Record Entry</span>
                </button>

                {/* Open Ledger Module */}
                <button
                  type="button"
                  onClick={() => onNavigateModule('ledger')}
                  className="text-xs font-semibold text-blue-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-[#182338] border border-edge-39 hover:border-blue-500 cursor-pointer transition-colors"
                >
                  Open Ledger
                </button>
              </div>
            </div>

            {/* Two Switchable Cards: Income & Expenses (Synced with Ledger Graph Mode) */}
            <div className="grid grid-cols-2 gap-3.5 mt-4">
              {/* Income Card */}
              <button
                type="button"
                onClick={() => setLedgerGraphMode('income')}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  ledgerGraphMode === 'income'
                    ? 'bg-[#142236] border-blue-500/60 ring-1 ring-blue-500/40 shadow-md shadow-blue-900/20'
                    : 'bg-surface-20 border-[#1d2a3e] hover:bg-[#162234] hover:border-slate-700'
                }`}
                id="btn-overview-graph-income"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="truncate">
                  <div className="text-[11px] text-slate-400 font-medium">Ledger Income</div>
                  <div className="text-sm sm:text-base font-black text-white font-mono truncate">
                    {formatPKR(ledgerGraphData.totalIncome)}
                  </div>
                </div>
              </button>

              {/* Expenses Card */}
              <button
                type="button"
                onClick={() => setLedgerGraphMode('expenses')}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  ledgerGraphMode === 'expenses'
                    ? 'bg-[#291b1b] border-amber-500/60 ring-1 ring-amber-500/40 shadow-md shadow-amber-950/20'
                    : 'bg-surface-20 border-[#1d2a3e] hover:bg-[#162234] hover:border-slate-700'
                }`}
                id="btn-overview-graph-expenses"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="truncate">
                  <div className="text-[11px] text-slate-400 font-medium">Ledger Expenses</div>
                  <div className="text-sm sm:text-base font-black text-white font-mono truncate">
                    {formatPKR(ledgerGraphData.totalExpense)}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Real-Time Ledger Area & Smooth Line Graph */}
          <div className="mt-5 pt-2">
            <div className="relative h-48 w-full select-none" id="overview-chart-ledger-timeline">
              <svg
                className="w-full h-full overflow-visible"
                viewBox="0 0 600 160"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="overviewIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="overviewExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines & Dynamic Y Labels */}
                {ledgerGraphData.yAxisLevels.map((val, idx) => {
                  const y = 15 + idx * 33.75;
                  return (
                    <g key={idx}>
                      <line
                        x1="45"
                        y1={y}
                        x2="595"
                        y2={y}
                        stroke="#182333"
                        strokeWidth="1"
                        strokeDasharray={idx === 4 ? 'none' : '3,3'}
                      />
                      <text
                        x="4"
                        y={y + 3}
                        fill="#64748b"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {formatLedgerYAxisLabel(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Dynamic Bezier Path & Data Points from Real Ledger Transactions */}
                {(() => {
                  const timeline = ledgerGraphData.graphTimelineData;
                  if (timeline.length === 0) return null;

                  const maxVal = ledgerGraphData.dynamicMaxY || 100000;
                  const leftPad = 52;
                  const rightPad = 590;
                  const topPad = 15;
                  const bottomPad = 150;
                  const widthSpan = rightPad - leftPad;
                  const heightSpan = bottomPad - topPad;

                  const points = timeline.map((d, index) => {
                    const x = timeline.length === 1
                      ? leftPad + widthSpan / 2
                      : leftPad + (index / (timeline.length - 1)) * widthSpan;
                    const normalized = maxVal > 0 ? Math.min(d.activeVal / maxVal, 1) : 0;
                    const y = bottomPad - (normalized * heightSpan);
                    return { x, y, ...d };
                  });

                  let pathD = `M ${points[0].x} ${points[0].y}`;
                  if (points.length === 1) {
                    pathD = `M ${leftPad} ${points[0].y} L ${rightPad} ${points[0].y}`;
                  } else {
                    for (let i = 0; i < points.length - 1; i++) {
                      const p0 = points[i];
                      const p1 = points[i + 1];
                      const cpX = (p0.x + p1.x) / 2;
                      pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
                    }
                  }

                  const areaD = points.length === 1
                    ? `M ${leftPad} ${points[0].y} L ${rightPad} ${points[0].y} L ${rightPad} ${bottomPad} L ${leftPad} ${bottomPad} Z`
                    : `${pathD} L ${points[points.length - 1].x} ${bottomPad} L ${points[0].x} ${bottomPad} Z`;

                  const lineColor = ledgerGraphMode === 'income' ? '#06b6d4' : '#f97316';
                  const areaFill = ledgerGraphMode === 'income' ? 'url(#overviewIncomeGrad)' : 'url(#overviewExpenseGrad)';

                  return (
                    <g>
                      <path d={areaD} fill={areaFill} />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={lineColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />
                      {points.map((p, idx) => (
                        <g
                          key={idx}
                          className="cursor-pointer"
                          onMouseEnter={() =>
                            setHoveredLedgerPoint({
                              x: p.x,
                              y: p.y,
                              date: p.date,
                              amount: p.activeVal,
                              income: p.income,
                              expense: p.expense
                            })
                          }
                          onMouseLeave={() => setHoveredLedgerPoint(null)}
                        >
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredLedgerPoint?.date === p.date ? 5.5 : 3.5}
                            fill="#101726"
                            stroke={lineColor}
                            strokeWidth="2"
                            className="transition-all"
                          />
                        </g>
                      ))}
                    </g>
                  );
                })()}
              </svg>

              {/* Hover Tooltip Popup */}
              {hoveredLedgerPoint && (
                <div
                  className="absolute pointer-events-none px-3 py-2 rounded-xl bg-[#0b121e] border border-[#24354f] text-xs shadow-2xl z-30 transform -translate-x-1/2 -translate-y-full mb-2 min-w-[165px]"
                  style={{
                    left: `${(hoveredLedgerPoint.x / 600) * 100}%`,
                    top: `${Math.max(12, (hoveredLedgerPoint.y / 160) * 100)}%`
                  }}
                >
                  <div className="text-slate-300 font-bold border-b border-edge-13 pb-1 mb-1">
                    {hoveredLedgerPoint.date}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-slate-400">Income:</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {formatPKR(hoveredLedgerPoint.income)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px] mt-0.5">
                    <span className="text-slate-400">Expense:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatPKR(hoveredLedgerPoint.expense)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic X-Axis Date Labels */}
            <div className="flex justify-between pl-11 pr-2 pt-2 text-[10px] text-slate-500 font-mono">
              {(() => {
                const timeline = ledgerGraphData.graphTimelineData;
                const total = timeline.length;
                if (total <= 8) {
                  return timeline.map(d => (
                    <span key={d.rawDate} className="hover:text-slate-300 transition-colors whitespace-nowrap">
                      {d.date}
                    </span>
                  ));
                }
                const step = (total - 1) / 6;
                const indices = [0, 1, 2, 3, 4, 5, 6].map(i => Math.round(i * step));
                const uniqueIndices = Array.from(new Set(indices));
                return uniqueIndices.map(idx => (
                  <span key={timeline[idx].rawDate} className="hover:text-slate-300 transition-colors whitespace-nowrap">
                    {timeline[idx].date}
                  </span>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Right: Ledger Profit Radial & Fee Collection Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-surface-14 border border-edge-13 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-white">
                {rightChartView === 'ledger-radial' ? 'Total Profit & Cashflow' : 'Fee Collection Status'}
              </h3>

              {/* Switch between Ledger Profit Radial & Fee Collection Doughnut */}
              <div className="flex items-center bg-surface-30 border border-[#22314a] rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setRightChartView('ledger-radial')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors cursor-pointer ${
                    rightChartView === 'ledger-radial'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ledger Profit
                </button>
                <button
                  type="button"
                  onClick={() => setRightChartView('fee-donut')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors cursor-pointer ${
                    rightChartView === 'fee-donut'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fee Status
                </button>
              </div>
            </div>

            {rightChartView === 'ledger-radial' ? (
              <>
                {/* Concentric Circular Rings matching Ledger Module */}
                <div className="py-2 flex flex-col items-center justify-center relative my-auto">
                  <div className="relative w-52 h-52 flex items-center justify-center select-none">
                    <svg
                      className="w-full h-full transform -rotate-90 overflow-visible"
                      viewBox="0 0 220 220"
                    >
                      {(() => {
                        const maxMetric = Math.max(
                          ledgerGraphData.totalIncome,
                          ledgerGraphData.totalExpense,
                          Math.abs(ledgerGraphData.totalBalance),
                          1
                        );
                        const hasAnyData = ledgerGraphData.totalIncome > 0 || ledgerGraphData.totalExpense > 0;
                        const profitRatio = hasAnyData
                          ? Math.max(0.05, Math.min(1, Math.max(0, ledgerGraphData.totalBalance) / maxMetric))
                          : 0;
                        const expenseRatio = hasAnyData
                          ? Math.max(0.05, Math.min(1, ledgerGraphData.totalExpense / maxMetric))
                          : 0;
                        const incomeRatio = hasAnyData
                          ? Math.max(0.05, Math.min(1, ledgerGraphData.totalIncome / maxMetric))
                          : 0;

                        const profitOffset = 534 - profitRatio * 534;
                        const expenseOffset = 427 - expenseRatio * 427;
                        const incomeOffset = 320 - incomeRatio * 320;

                        return (
                          <>
                            <circle cx="110" cy="110" r="85" fill="none" stroke="#162536" strokeWidth="11" />
                            {profitRatio > 0 && (
                              <circle
                                cx="110"
                                cy="110"
                                r="85"
                                fill="none"
                                stroke="#10b981"
                                strokeWidth={hoveredRadialStrip === 'profit' ? '14' : '11'}
                                strokeDasharray="534"
                                strokeDashoffset={profitOffset}
                                strokeLinecap="round"
                                className="transition-all duration-300 cursor-pointer"
                                onMouseEnter={() => setHoveredRadialStrip('profit')}
                                onMouseLeave={() => setHoveredRadialStrip(null)}
                              />
                            )}

                            <circle cx="110" cy="110" r="68" fill="none" stroke="#162536" strokeWidth="11" />
                            {expenseRatio > 0 && (
                              <circle
                                cx="110"
                                cy="110"
                                r="68"
                                fill="none"
                                stroke="#f97316"
                                strokeWidth={hoveredRadialStrip === 'expense' ? '14' : '11'}
                                strokeDasharray="427"
                                strokeDashoffset={expenseOffset}
                                strokeLinecap="round"
                                className="transition-all duration-300 cursor-pointer"
                                onMouseEnter={() => setHoveredRadialStrip('expense')}
                                onMouseLeave={() => setHoveredRadialStrip(null)}
                              />
                            )}

                            <circle cx="110" cy="110" r="51" fill="none" stroke="#162536" strokeWidth="11" />
                            {incomeRatio > 0 && (
                              <circle
                                cx="110"
                                cy="110"
                                r="51"
                                fill="none"
                                stroke="#eab308"
                                strokeWidth={hoveredRadialStrip === 'income' ? '14' : '11'}
                                strokeDasharray="320"
                                strokeDashoffset={incomeOffset}
                                strokeLinecap="round"
                                className="transition-all duration-300 cursor-pointer"
                                onMouseEnter={() => setHoveredRadialStrip('income')}
                                onMouseLeave={() => setHoveredRadialStrip(null)}
                              />
                            )}
                          </>
                        );
                      })()}
                    </svg>

                    <div className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-[#0a0f1a] border border-[#1b2a40] flex flex-col items-center justify-center text-center p-1 pointer-events-none shadow-inner">
                      <span
                        className="text-[11px] font-semibold transition-colors duration-150"
                        style={{ color: activeLedgerRadialData.color }}
                      >
                        {activeLedgerRadialData.label}
                      </span>
                      <span className="text-sm font-black text-white font-mono tracking-tight mt-0.5">
                        {activeLedgerRadialData.lacStr}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono scale-90">
                        {formatPKR(activeLedgerRadialData.amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Legend Cards for Profit, Expense, Income */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#182436] text-xs">
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredRadialStrip('profit')}
                    onMouseLeave={() => setHoveredRadialStrip(null)}
                    className="p-2 rounded-lg bg-surface-23 border border-edge-20 hover:border-emerald-500/50 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-[11px] text-slate-300 font-semibold">Profit</span>
                    </div>
                    <div className="font-mono text-[11px] font-bold text-white mt-1 truncate">
                      {formatPKR(ledgerGraphData.totalBalance)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onMouseEnter={() => setHoveredRadialStrip('expense')}
                    onMouseLeave={() => setHoveredRadialStrip(null)}
                    className="p-2 rounded-lg bg-surface-23 border border-edge-20 hover:border-amber-500/50 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#f97316]" />
                      <span className="text-[11px] text-slate-300 font-semibold">Expense</span>
                    </div>
                    <div className="font-mono text-[11px] font-bold text-white mt-1 truncate">
                      {formatPKR(ledgerGraphData.totalExpense)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onMouseEnter={() => setHoveredRadialStrip('income')}
                    onMouseLeave={() => setHoveredRadialStrip(null)}
                    className="p-2 rounded-lg bg-surface-23 border border-edge-20 hover:border-yellow-500/50 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                      <span className="text-[11px] text-slate-300 font-semibold">Income</span>
                    </div>
                    <div className="font-mono text-[11px] font-bold text-white mt-1 truncate">
                      {formatPKR(ledgerGraphData.totalIncome)}
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Doughnut Chart for Collected vs Current Due */}
                <div className="relative flex items-center justify-center my-3">
                  <svg className="w-52 h-52 -rotate-90 transform overflow-visible" viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      r={donutData.radius}
                      fill="transparent"
                      stroke="#162032"
                      strokeWidth={donutData.baseStrokeWidth}
                    />
                    {donutData.total > 0 &&
                      donutData.slices.map(slice => {
                        const isSelected = selectedDonutOption === slice.id;
                        return (
                          <circle
                            key={slice.id}
                            cx="80"
                            cy="80"
                            r={donutData.radius}
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth={isSelected ? donutData.selectedStrokeWidth : donutData.baseStrokeWidth}
                            strokeDasharray={slice.strokeDash}
                            strokeDashoffset={slice.strokeOffset}
                            strokeLinecap="round"
                            className="transition-all duration-300 cursor-pointer"
                            style={{ opacity: isSelected ? 1 : 0.75 }}
                            onClick={() => setSelectedDonutOption(slice.id as 'collected' | 'due')}
                          />
                        );
                      })}
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    {selectedDonutOption === 'collected' ? (
                      <>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Collected
                        </span>
                        <span className="text-2xl font-black text-sky-400 tracking-tight">
                          {donutData.collectedPct.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-slate-300 font-medium">
                          Rs. {donutData.collected.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Current Due
                        </span>
                        <span className="text-2xl font-black text-amber-400 tracking-tight">
                          {donutData.duePct.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-slate-300 font-medium">
                          Rs. {donutData.due.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedDonutOption('collected')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedDonutOption === 'collected'
                        ? 'bg-sky-500/10 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30'
                        : 'bg-surface-23 border-edge-20 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] shrink-0" />
                      <span className="font-semibold text-xs">Collected</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-white mt-0.5">
                      Rs. {donutData.collected.toLocaleString()}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDonutOption('due')}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedDonutOption === 'due'
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/30'
                        : 'bg-surface-23 border-edge-20 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-warning shrink-0" />
                      <span className="font-semibold text-xs">Current Due</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-white mt-0.5">
                      Rs. {donutData.due.toLocaleString()}
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. FEE DEFAULTERS TABLE/LIST                                              */}
      {/* ========================================================================= */}
      <div className="bg-surface-14 border border-edge-13 rounded-xl p-4" id="section-fee-defaulters">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Fee Defaulters</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                  {financialMetrics.defaultersList.length} Total
                </span>
              </h2>
            </div>
          </div>

          {/* Filter and View All Link */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-30 border border-[#22314a] rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDefaulterFilter('all')}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  defaulterFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDefaulterFilter('high')}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  defaulterFilter === 'high' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                High Priority (&gt;10K)
              </button>
              <button
                type="button"
                onClick={() => setDefaulterFilter('medium')}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  defaulterFilter === 'medium' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Medium (&gt;5K)
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigateModule('fees')}
              className="text-xs font-semibold text-blue-400 hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#182338] border border-edge-39 hover:border-blue-500 cursor-pointer transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Defaulters Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-edge-13 text-slate-400 text-[11px] uppercase tracking-wider bg-[#131b2e]/50">
                <th className="py-2.5 px-3 font-semibold">Student Name & ID</th>
                <th className="py-2.5 px-3 font-semibold">Class / Section</th>
                <th className="py-2.5 px-3 font-semibold">Guardian / Family</th>
                <th className="py-2.5 px-3 font-semibold">Total Fee</th>
                <th className="py-2.5 px-3 font-semibold">Outstanding Due</th>
                <th className="py-2.5 px-3 font-semibold text-center">Priority</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge-13/70">
              {displayedDefaulters.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No fee defaulters found matching the selected filter.
                  </td>
                </tr>
              ) : (
                displayedDefaulters.map(item => {
                  const s = item.student;
                  const avatarColor = getAvatarColor(s.name);
                  const initials = getInitials(s.name);

                  return (
                    <tr 
                      key={s.id}
                      onClick={() => {
                        if (onPayStudentFee) onPayStudentFee(s);
                        else onNavigateModule('fees');
                      }}
                      className="hover:bg-[#182338]/80 cursor-pointer transition-colors group"
                    >
                      {/* Student info */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full ${avatarColor} text-white font-bold text-[11px] flex items-center justify-center shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-blue-300 transition-colors">
                              {s.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {s.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-2.5 px-3 font-medium text-slate-200">
                        {s.class} <span className="text-slate-500">({s.section})</span>
                      </td>

                      {/* Family */}
                      <td className="py-2.5 px-3 text-slate-300">
                        <div>{s.family || 'Guardian'}</div>
                        <div className="text-[10px] text-slate-500">{s.phone || '-'}</div>
                      </td>

                      {/* Total fee */}
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        Rs. {item.totalFee.toLocaleString()}
                      </td>

                      {/* Outstanding Due */}
                      <td className="py-2.5 px-3 font-bold text-rose-400 font-mono">
                        Rs. {item.remainingDue.toLocaleString()}
                      </td>

                      {/* Priority Status Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.priority === 'High'
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                            : item.priority === 'Medium'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                        }`}>
                          {item.priority}
                        </span>
                      </td>

                      {/* Action: Pay Button */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onPayStudentFee) {
                              onPayStudentFee(s);
                            } else {
                              onNavigateModule('fees');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                          id={`btn-overview-pay-${s.id}`}
                        >
                          Pay
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. ATTENDANCE TREND & 7. RECENT INQUIRIES                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Attendance Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-surface-14 border border-edge-13 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Attendance Trend</h3>
              </div>

              {/* Student vs Staff toggle & View All */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-surface-30 border border-[#22314a] rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAttendanceTarget('students')}
                    className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                      attendanceTarget === 'students' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Students
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceTarget('staff')}
                    className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                      attendanceTarget === 'staff' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Staff
                  </button>
                </div>
              </div>
            </div>

            {/* Attendance Key Metrics Summary: Total, Average, Peak, Today's Rate */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 bg-[#0d1424] p-2.5 rounded-lg border border-[#1b263b]">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                <div className="text-sm sm:text-base font-bold text-white mt-0.5">
                  {attendanceTarget === 'students' ? `${students.length} Students` : `${staff.length} Staff`}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Average</span>
                <div className="text-sm sm:text-base font-bold text-sky-400 mt-0.5">{monthlyAttendanceSummary.average}%</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Peak</span>
                <div className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5">{monthlyAttendanceSummary.peak}%</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Today's Rate</span>
                <div className="text-sm sm:text-base font-bold text-emerald-300 mt-0.5">{attendanceMetrics.todayRate}%</div>
              </div>
            </div>

            {/* Draggable Monthly Attendance Graph with Pinned Y-Axis Rail */}
            <div className="flex items-stretch gap-1.5">
              {/* Pinned left Y-Axis values rail */}
              <div className="w-10 shrink-0 flex flex-col justify-between py-2 text-[10px] font-mono font-semibold text-slate-400 select-none border-r border-edge-13/60 pr-1 text-right">
                {attendanceCurveData.yTicks.map(t => (
                  <span key={t.val}>{t.label}</span>
                ))}
              </div>

              {/* Horizontal Scrollable Graph Container (Bar Hidden, Drag Left & Right) */}
              <div
                ref={attendanceScrollContainerRef}
                onMouseDown={handleAttendanceMouseDown}
                onMouseMove={handleAttendanceMouseMove}
                onMouseUp={handleAttendanceMouseUp}
                onMouseLeave={handleAttendanceMouseUp}
                onWheel={handleAttendanceWheel}
                onTouchStart={handleAttendanceTouchStart}
                onTouchMove={handleAttendanceTouchMove}
                onTouchEnd={handleAttendanceTouchEnd}
                className={`relative flex-1 min-w-0 overflow-x-auto select-none rounded-xl bg-[#0d1424] border border-[#1b263b] p-3 ${
                  isDraggingAttendanceGraph ? 'cursor-grabbing' : 'cursor-grab'
                } [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
              >
                {/* Inner container: 240% width so that 5 months are in view within 100% viewport, draggable */}
                <div className="w-[240%] min-w-[850px] relative">
                  <div className="relative w-full h-44 select-none">
                    <svg
                      className="w-full h-full overflow-visible"
                      viewBox={`0 0 ${attendanceCurveData.width} ${attendanceCurveData.height}`}
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="attendanceTrendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal reference grid lines with Y-axis percentage labels */}
                      {attendanceCurveData.yTicks.map((t) => (
                        <g key={t.val}>
                          <line
                            x1="30"
                            y1={t.y}
                            x2={attendanceCurveData.width - 20}
                            y2={t.y}
                            stroke="#1e293b"
                            strokeDasharray={t.val === 0 ? undefined : "3 3"}
                          />
                          <text
                            x="35"
                            y={t.y - 4}
                            fill="#64748b"
                            fontSize="10"
                            fontWeight="600"
                            fontFamily="monospace"
                          >
                            {t.label}
                          </text>
                        </g>
                      ))}

                      {/* Vertical guideline markers for each month */}
                      {attendanceCurveData.points.map((pt, idx) => (
                        <line
                          key={`v-att-${idx}`}
                          x1={pt.x}
                          y1="25"
                          x2={pt.x}
                          y2="155"
                          stroke="#1e293b"
                          strokeDasharray="2 2"
                          strokeOpacity="0.6"
                        />
                      ))}

                      {/* Area Gradient Fill */}
                      <path d={attendanceCurveData.areaD} fill="url(#attendanceTrendGradient)" />

                      {/* Curved Stroke Line */}
                      <path
                        d={attendanceCurveData.pathD}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Data Points */}
                      {attendanceCurveData.points.map((pt, idx) => {
                        const isHovered = activeAttendanceHoverIndex === idx;
                        return (
                          <g key={idx}>
                            {isHovered && (
                              <line
                                x1={pt.x}
                                y1="20"
                                x2={pt.x}
                                y2="155"
                                stroke="#10b981"
                                strokeWidth="1.5"
                                strokeDasharray="2 2"
                              />
                            )}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isHovered ? 6.5 : 4.5}
                              fill={isHovered ? '#10b981' : '#0b0f19'}
                              stroke="#10b981"
                              strokeWidth={isHovered ? 3 : 2}
                              className="transition-all cursor-pointer"
                              onMouseEnter={() => setActiveAttendanceHoverIndex(idx)}
                              onMouseLeave={() => setActiveAttendanceHoverIndex(null)}
                              onClick={() => setActiveAttendanceHoverIndex(idx)}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {/* Floating Dynamic Tooltip */}
                    {activeAttendanceHoverIndex !== null && attendanceCurveData.points[activeAttendanceHoverIndex] && (
                      <div
                        className="absolute pointer-events-none z-30 bg-[#070b14] border border-[#233554] shadow-2xl rounded-xl p-3 text-xs transform -translate-x-1/2 -translate-y-full mb-3 min-w-[160px]"
                        style={{
                          left: `${(attendanceCurveData.points[activeAttendanceHoverIndex].x / attendanceCurveData.width) * 100}%`,
                          top: `${Math.max(10, (attendanceCurveData.points[activeAttendanceHoverIndex].y / attendanceCurveData.height) * 100)}%`
                        }}
                      >
                        <div className="font-bold text-white flex items-center justify-between gap-3 border-b border-edge-13 pb-1.5">
                          <span className="text-slate-100">{attendanceCurveData.points[activeAttendanceHoverIndex].data.month}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold text-emerald-400 bg-emerald-500/10">
                            {attendanceCurveData.points[activeAttendanceHoverIndex].data.rate}%
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Attendance Rate:</span>
                            <span className="font-extrabold text-emerald-400">
                              {attendanceCurveData.points[activeAttendanceHoverIndex].data.rate}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-edge-13/60">
                            <span>Status:</span>
                            <span className={attendanceCurveData.points[activeAttendanceHoverIndex].data.rate >= 95 ? "font-semibold text-emerald-400" : "font-semibold text-amber-400"}>
                              {attendanceCurveData.points[activeAttendanceHoverIndex].data.rate >= 95 ? 'Target Met (≥95%)' : 'Needs Attention'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* X-axis labels: All 12 months with attendance badges */}
                  <div className="flex items-center justify-between px-3 text-[11px] text-slate-400 mt-2">
                    {monthlyAttendanceData.map((d, i) => {
                      const isSelected = activeAttendanceHoverIndex === i;
                      return (
                        <div
                          key={d.id}
                          className={`flex flex-col items-center cursor-pointer transition-colors p-1 rounded-md ${
                            isSelected ? 'text-white font-bold bg-[#172338]' : 'hover:text-slate-200'
                          }`}
                          onClick={() => setActiveAttendanceHoverIndex(i)}
                        >
                          <span className="text-xs font-semibold">{d.shortMonth}</span>
                          <span className="text-[10px] font-mono mt-0.5 text-emerald-400 font-bold">
                            {d.rate}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Recent Inquiries / Admissions (5 cols) */}
        <div className="lg:col-span-5 bg-surface-14 border border-edge-13 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Recent Inquiries</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                  {inquiries.length} New
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddInquiryModalOpen(true)}
                  className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateModule('students')}
                  className="text-xs font-semibold text-blue-400 hover:text-white px-2.5 py-1 rounded-lg bg-[#182338] border border-edge-39 hover:border-blue-500 cursor-pointer transition-colors"
                >
                  View All
                </button>
              </div>
            </div>

            {/* Inquiries List */}
            <div className="space-y-2 mt-2">
              {inquiries.slice(0, 4).map(inq => (
                <div
                  key={inq.id}
                  onClick={() => setSelectedInquiry(inq)}
                  className="p-2.5 rounded-lg bg-surface-23 hover:bg-[#1a253a] border border-edge-20 hover:border-blue-500/50 cursor-pointer transition-all group flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs group-hover:text-blue-300 transition-colors truncate">
                      {inq.applicantName}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Applying for: <strong className="text-slate-200">{inq.appliedClass}</strong></span>
                      <span>•</span>
                      <span>{inq.date}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      inq.status === 'Approved'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : inq.status === 'Interview Scheduled'
                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                        : inq.status === 'Pending Review'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                    }`}>
                      {inq.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-edge-13 flex items-center justify-between text-xs text-slate-400">
            <span>
              {inquiries.filter(i => i.status === 'Pending Review').length} awaiting review
            </span>
            <span>{inquiries.length} applications logged</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 8. NEEDS ATTENTION                                                        */}
      {/* ========================================================================= */}
      <div className="bg-surface-14 border border-edge-13 rounded-xl p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Needs Immediate Attention</h3>
              <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {attentionItems.length} Alerts
              </span>
            </div>

          </div>

          {/* Alert List: Interactive Sub-boxes that redirect to specific management pages */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
            {attentionItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={item.onAction}
                className="p-3.5 rounded-xl bg-surface-23 hover:bg-[#182338] border border-edge-20 hover:border-blue-500/60 flex items-center justify-between gap-3 transition-all cursor-pointer text-left group shadow-sm hover:shadow-md active:scale-[0.99] w-full"
                title={`Click to open ${item.title}`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                    item.severity === 'high' ? 'bg-rose-500 animate-pulse' : item.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-white group-hover:text-blue-300 transition-colors flex items-center gap-1.5">
                      <span>{item.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {item.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    item.severity === 'high' 
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' 
                      : item.severity === 'medium' 
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                      : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  }`}>
                    {item.severity}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-edge-13 flex items-center justify-between text-xs text-slate-400">
          <span>All institutional checkpoints monitored</span>
          <span className="text-emerald-400 font-medium">Status Normal</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD INCOME / EXPENSE TRANSACTION                              */}
      {/* ========================================================================= */}
      {isRecordModalOpen && (
        <RecordTransactionModal
          isOpen={isRecordModalOpen}
          type={recordModalType}
          onClose={() => setIsRecordModalOpen(false)}
          onSubmit={(txData) => {
            addLedgerTransaction(txData);
            setLedgerTransactions(getLedgerTransactions());
            setIsRecordModalOpen(false);
            onShowToast?.(`Recorded ${recordModalType} voucher for Rs. ${txData.amount.toLocaleString()}`, 'success');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD STUDENT FINE MODAL                                           */}
      {/* ========================================================================= */}
      {isAddFineModalOpen && (
        <AddFineModal
          students={students}
          isOpen={isAddFineModalOpen}
          onClose={() => setIsAddFineModalOpen(false)}
          onSave={handleAddFine}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SEND ANNOUNCEMENT MODAL                                          */}
      {/* ========================================================================= */}
      {isSendAnnouncementModalOpen && (
        <SendAnnouncementModal
          isOpen={isSendAnnouncementModalOpen}
          onClose={() => setIsSendAnnouncementModalOpen(false)}
          onSend={handleSendAnnouncement}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INQUIRY DETAILS & ACTIONS MODAL                                  */}
      {/* ========================================================================= */}
      {selectedInquiry && (
        <InquiryDetailsModal
          inquiry={selectedInquiry}
          isOpen={!!selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
          onUpdateStatus={handleUpdateInquiry}
          onConvertToStudent={() => {
            setSelectedInquiry(null);
            onOpenAddStudent();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADD NEW INQUIRY MODAL                                            */}
      {/* ========================================================================= */}
      {isAddInquiryModalOpen && (
        <AddInquiryModal
          classes={classes}
          isOpen={isAddInquiryModalOpen}
          onClose={() => setIsAddInquiryModalOpen(false)}
          onSave={(inqData) => {
            const added = addInquiry(inqData);
            setInquiries(getStoredInquiries());
            setIsAddInquiryModalOpen(false);
            onShowToast?.(`Logged admission inquiry for ${added.applicantName}`, 'success');
          }}
        />
      )}

    </div>
  );
};

// =========================================================================
// SUB-MODAL COMPONENTS
// =========================================================================

// 1. Add Fine Modal
interface AddFineModalProps {
  students: Student[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (studentId: string, amount: number, reason: string) => void;
}

const AddFineModal: React.FC<AddFineModalProps> = ({ students, isOpen, onClose, onSave }) => {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || '');
  const [fineType, setFineType] = useState('Late Fee Fine');
  const [customReason, setCustomReason] = useState('');
  const [amount, setAmount] = useState<number>(500);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || amount <= 0) return;
    const finalReason = fineType === 'Other' ? (customReason || 'Disciplinary Fine') : fineType;
    onSave(selectedStudentId, amount, finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface-14 border border-edge-31 rounded-xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
        <div className="p-4 border-b border-edge-13 flex items-center justify-between bg-surface-30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">Issue Student Fine / Surcharge</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Select Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white font-medium focus:outline-hidden focus:border-blue-500"
            >
              {students.length === 0 ? (
                <option value="">-- No students available in system --</option>
              ) : (
                students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id}) - {s.class} ({s.section})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Fine Category</label>
            <select
              value={fineType}
              onChange={(e) => setFineType(e.target.value)}
              className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white font-medium focus:outline-hidden focus:border-blue-500"
            >
              <option value="Late Fee Fine">Late Fee Surcharge</option>
              <option value="Library Overdue Book">Library Overdue Book</option>
              <option value="Uniform / Dress Code">Uniform / Dress Code Violation</option>
              <option value="Discipline / Behavior">Campus Discipline Violation</option>
              <option value="Property Damage">School Property Damage</option>
              <option value="Other">Other Penalty Reason</option>
            </select>
          </div>

          {fineType === 'Other' && (
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Specify Reason</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="e.g. Broken laboratory glassware"
                className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Fine Amount (PKR)</label>
            <input
              type="number"
              min="100"
              step="50"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-edge-13">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-surface-41 text-slate-300 hover:text-white cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-amber-600/20"
            >
              Add Fine to Dues
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. Send Announcement Modal
interface SendAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (announcement: Omit<Announcement, 'id' | 'date' | 'rawDate'>) => void;
}

const SendAnnouncementModal: React.FC<SendAnnouncementModalProps> = ({ isOpen, onClose, onSend }) => {
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<'All' | 'Parents' | 'Staff' | 'Students'>('All');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Normal'>('Normal');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('Principal Office');
  const [channels, setChannels] = useState<('WhatsApp' | 'SMS' | 'Mobile App')[]>(['WhatsApp', 'Mobile App']);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSend({
      title,
      audience,
      priority,
      content,
      author,
      channels
    });
  };

  const toggleChannel = (ch: 'WhatsApp' | 'SMS' | 'Mobile App') => {
    if (channels.includes(ch)) {
      setChannels(channels.filter(c => c !== ch));
    } else {
      setChannels([...channels, ch]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface-14 border border-edge-31 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100">
        <div className="p-4 border-b border-edge-13 flex items-center justify-between bg-surface-30">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white text-sm">Broadcast Institutional Announcement</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Announcement Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Schedule for Sports Gala / Parent-Teacher Conference"
              className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Target Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as any)}
                className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
              >
                <option value="All">All School (Parents, Staff & Students)</option>
                <option value="Parents">Guardians & Parents Only</option>
                <option value="Staff">Faculty & Staff Members Only</option>
                <option value="Students">Enrolled Students</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Urgency Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
              >
                <option value="Normal">Normal Notice</option>
                <option value="High">High Priority</option>
                <option value="Urgent">Urgent / Alert</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Broadcast Channels</label>
            <div className="flex items-center gap-2">
              {(['WhatsApp', 'Mobile App', 'SMS'] as const).map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    channels.includes(ch)
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-surface-41 border-edge-41 text-slate-400'
                  }`}
                >
                  {channels.includes(ch) ? '✓ ' : '+ '}{ch}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Notice Content</label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter official institutional notice text..."
              className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-edge-13">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-surface-41 text-slate-300 hover:text-white cursor-pointer"
            >
              Discard
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-sky-600/20 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast Now</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. Inquiry Details Modal
interface InquiryDetailsModalProps {
  inquiry: StudentInquiry;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: StudentInquiry['status']) => void;
  onConvertToStudent: () => void;
}

const InquiryDetailsModal: React.FC<InquiryDetailsModalProps> = ({
  inquiry,
  isOpen,
  onClose,
  onUpdateStatus,
  onConvertToStudent
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface-14 border border-edge-31 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100">
        <div className="p-4 border-b border-edge-13 flex items-center justify-between bg-surface-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Admission Applicant Profile</h3>
              <p className="text-[10px] text-slate-400 font-mono">Inquiry ID: {inquiry.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3 bg-surface-23 p-3 rounded-lg border border-edge-20">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Applicant Name</span>
              <div className="text-sm font-bold text-white mt-0.5">{inquiry.applicantName}</div>
              <div className="text-[11px] text-slate-400">{inquiry.gender}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Applied Class</span>
              <div className="text-sm font-bold text-blue-400 mt-0.5">{inquiry.appliedClass}</div>
              <div className="text-[10px] text-slate-400">Date: {inquiry.date}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Guardian Details</span>
              <div className="font-semibold text-white mt-0.5">{inquiry.guardianName}</div>
              <div className="text-slate-400">{inquiry.guardianPhone}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Entrance Test Score</span>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">
                {inquiry.testScore ? `${inquiry.testScore}% Obtained` : 'Evaluation Pending'}
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Admission Remarks & Notes</span>
            <div className="p-2.5 rounded-lg bg-surface-23 border border-edge-20 text-slate-300 text-xs mt-1">
              {inquiry.notes || 'No administrative notes attached to this application file.'}
            </div>
          </div>

          {/* Status Change Buttons */}
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1.5">Update Workflow Status</span>
            <div className="flex flex-wrap gap-1.5">
              {(['Pending Review', 'Interview Scheduled', 'Approved', 'Waitlisted', 'Rejected'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onUpdateStatus(inquiry.id, st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border ${
                    inquiry.status === st
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-surface-41 border-edge-41 text-slate-300 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-edge-13 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-surface-41 text-slate-300 hover:text-white cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onConvertToStudent}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Convert to Enrolled Student</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. Add Inquiry Modal
interface AddInquiryModalProps {
  classes: ClassInfo[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (inq: Omit<StudentInquiry, 'id' | 'date' | 'rawDate'>) => void;
}

const AddInquiryModal: React.FC<AddInquiryModalProps> = ({ classes, isOpen, onClose, onSave }) => {
  const [applicantName, setApplicantName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [appliedClass, setAppliedClass] = useState(classes[0]?.name || '');
  const [priority, setPriority] = useState<'High' | 'Normal'>('Normal');
  const [testScore, setTestScore] = useState<string>('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !guardianName.trim() || !appliedClass.trim()) return;

    onSave({
      applicantName,
      gender,
      guardianName,
      guardianPhone: guardianPhone || '+92 300 0000000',
      appliedClass,
      priority,
      status: 'Pending Review',
      testScore: testScore ? Number(testScore) : undefined,
      notes
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface-14 border border-edge-31 rounded-xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
        <div className="p-4 border-b border-edge-13 flex items-center justify-between bg-surface-30">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-sm">New Admission Inquiry</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Applicant Name</label>
            <input
              type="text"
              required
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="e.g. Aayan Tariq"
              className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Applied Class</label>
              <select
                value={appliedClass}
                onChange={(e) => setAppliedClass(e.target.value)}
                className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
              >
                {classes.length === 0 ? (
                  <option value="">-- No classes available --</option>
                ) : (
                  classes.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Guardian Name</label>
              <input
                type="text"
                required
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Father / Guardian"
                className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Phone Number</label>
              <input
                type="text"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Notes / Referral</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Previous school, transfer certificate status"
              className="w-full bg-surface-41 border border-edge-41 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-edge-13">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-surface-41 text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-blue-600/20"
            >
              Save Inquiry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
