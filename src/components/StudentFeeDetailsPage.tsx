import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Printer, 
  BellRing, 
  Eye, 
  FileText, 
  CheckCircle2, 
  CreditCard, 
  X,
  Phone, 
  MapPin,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  History,
  AlertCircle,
  Clock,
  Calendar,
  Plus,
  Coins
} from 'lucide-react';
import { Student, ClassInfo, normalizeMethod } from '../types';
import { 
  StudentFeeItem, 
  StudentNote, 
  ensureStudentLedgerGenerated, 
  loadAllLedgerItems, 
  updateStudentLedgerItems,
  getStudentNotes,
  saveStudentNote,
  toggleArchiveNote,
  getStudentCreditBalance,
  setStudentCreditBalance
} from '../utils/studentFeeLedgerHelper';
import { 
  formatPKR, 
  createWhatsAppFeeAlertUrl, 
  FamilyFeeSummary
} from '../utils/feeHelper';
import { getBankSettings } from '../utils/settingsHelper';
import { localISODate } from '../utils/dates';
import { recordPayment, addCharge, creditOwner, getCreditForStudents } from '../utils/paymentStore';
import { FeeChallanModal } from './FeeChallanModal';
import { FeeCardModal } from './FeeCardModal';
import { FeeInvoicePage } from './FeeInvoicePage';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { 
  FeeInvoiceData, 
  FeeInvoiceItem, 
  FeeInvoiceStudentGroup 
} from '../utils/feeInvoicePdfGenerator';

export interface FeePaymentSuccessResult {
  studentPayments: {
    studentId: string;
    amountPaid: number;
    itemsPaidCount: number;
  }[];
  totalAmount: number;
  paymentMethod: string;
}

export interface StudentChargeResult {
  studentId: string;
  amount: number;
  type: string;
  reason: string;
}

interface StudentFeeDetailsPageProps {
  family?: FamilyFeeSummary;
  students?: Student[];
  initialSelectedStudentId?: string;
  student?: Student; // Fallback single student
  classes: ClassInfo[];
  allStudents?: Student[];
  onBack: () => void;
  onBreadcrumbOverview?: () => void;
  onSelectStudentProfile: (student: Student) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onPaymentSuccess?: (result: FeePaymentSuccessResult) => void;
  onAddCharge?: (result: StudentChargeResult) => void;
  onNavigateToInvoice?: (invoice: FeeInvoiceData) => void;
  onNavigateToClasses?: () => void;
}

export const StudentFeeDetailsPage: React.FC<StudentFeeDetailsPageProps> = ({
  family,
  students: propStudents,
  initialSelectedStudentId,
  student: fallbackStudent,
  classes,
  allStudents,
  onBack,
  onBreadcrumbOverview,
  onSelectStudentProfile,
  onShowToast,
  onPaymentSuccess,
  onAddCharge,
  onNavigateToInvoice,
  onNavigateToClasses
}) => {
  // Local invoice redirection state
  const [internalInvoice, setInternalInvoice] = useState<FeeInvoiceData | null>(null);

  // Helper to compare IDs flexibly (ignoring hyphens, special chars, and case)
  const isMatchingId = (id1?: string, id2?: string) => {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    const clean1 = id1.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const clean2 = id2.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return clean1 === clean2;
  };

  // Deduplicate students within the family to prevent any duplicate student containers
  const deduplicateStudents = (list: Student[]): Student[] => {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const result: Student[] = [];

    for (const s of list) {
      const cleanId = (s.id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanName = (s.name || '').trim().toLowerCase();
      const cleanClass = (s.class || '').trim().toLowerCase();
      const cleanSec = (s.section || '').trim().toLowerCase();

      // Unify identical IDs e.g. S-0080 vs S0080
      if (cleanId && seenIds.has(cleanId)) {
        continue;
      }

      // Check if student with same name in same class/section already exists
      const nameKey = `${cleanName}__${cleanClass}__${cleanSec}`;
      if (cleanName && seenNames.has(nameKey)) {
        continue;
      }

      if (cleanId) seenIds.add(cleanId);
      if (cleanName) seenNames.add(nameKey);
      result.push(s);
    }

    return result;
  };

  // Resolve list of students belonging to this family (strictly deduplicated)
  const familyStudents: Student[] = useMemo(() => {
    const rawList = (propStudents && propStudents.length > 0)
      ? propStudents
      : (family?.students && family.students.length > 0)
        ? family.students
        : (fallbackStudent ? [fallbackStudent] : []);

    let combined = [...rawList];

    if (allStudents && allStudents.length > 0) {
      const famId = family?.familyId || rawList[0]?.familyId;
      const famName = family?.familyName || rawList[0]?.family;

      const cleanFamId = famId ? famId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
      const cleanFamName = famName ? famName.trim().toLowerCase() : '';

      const matchedSiblings = allStudents.filter(s => {
        const sCleanId = (s.familyId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (cleanFamId && sCleanId && cleanFamId === sCleanId) return true;
        if (cleanFamName && s.family && s.family.trim().toLowerCase() === cleanFamName) return true;
        return rawList.some(r => isMatchingId(r.id, s.id));
      });

      if (matchedSiblings.length > 0) {
        combined = [...rawList, ...matchedSiblings];
      }
    }

    return deduplicateStudents(combined);
  }, [propStudents, family, fallbackStudent, allStudents]);

  const primaryStudent = familyStudents[0] || fallbackStudent;

  // Fee Card Modal state
  const [isFeeCardModalOpen, setIsFeeCardModalOpen] = useState(false);
  const [feeCardTargetStudentId, setFeeCardTargetStudentId] = useState<string | undefined>(undefined);

  // Load monthly ledger items per student
  const [itemsByStudent, setItemsByStudent] = useState<Record<string, StudentFeeItem[]>>(() => {
    const all = loadAllLedgerItems();
    const map: Record<string, StudentFeeItem[]> = {};
    familyStudents.forEach(st => {
      const items = ensureStudentLedgerGenerated(st, classes, all);
      map[st.id] = items;
      const clean = st.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      map[clean] = items;
    });
    return map;
  });

  // Pay amount per item: initialized to the payable remaining due for every item
  const [payAmounts, setPayAmounts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    const all = loadAllLedgerItems();
    familyStudents.forEach(st => {
      const studentItems = ensureStudentLedgerGenerated(st, classes, all);
      studentItems.forEach(i => {
        map[i.id] = Math.max(0, i.total - i.paidAmount);
      });
    });
    return map;
  });

  // Helper to determine if a student is initially selected for payment
  const isStudentSelectedForPayment = (st: Student) => {
    // If entered through family entry pay (initialSelectedStudentId is undefined/empty):
    // ALL students in the family must be selected by default!
    if (!initialSelectedStudentId) return true;

    // If entered through student entry:
    // ONLY select this specific student!
    if (isMatchingId(st.id, initialSelectedStudentId)) return true;
    if (st.name && initialSelectedStudentId.trim().toLowerCase() === st.name.trim().toLowerCase()) return true;
    return false;
  };

  // Selection state across all items in all student containers:
  // - If entered through family entry pay:
  //   Automatically select all boxes (all payable items) of ALL students in the family!
  // - If entered through student entry:
  //   Automatically select all boxes (all payable items) OF THAT STUDENT, and leave other family students unselected!
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    const all = loadAllLedgerItems();

    familyStudents.forEach(st => {
      const studentItems = ensureStudentLedgerGenerated(st, classes, all);
      const isTargetStudent = isStudentSelectedForPayment(st);

      if (isTargetStudent) {
        const payableItems = studentItems.filter(i => (i.total - i.paidAmount) > 0);
        const itemsToSelect = payableItems.length > 0 ? payableItems : studentItems;
        itemsToSelect.forEach(i => {
          set.add(i.id);
        });
      }
    });

    return set;
  });

  // Raw input strings for smooth typing and backspacing
  const [rawPayInputs, setRawPayInputs] = useState<Record<string, string>>({});

  // View Toggles
  const [showAdvanceFee, setShowAdvanceFee] = useState<boolean>(false);
  const [showSuppressedChallans, setShowSuppressedChallans] = useState<boolean>(false);

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Online Transfer' | 'Bank Deposit' | 'JazzCash' | 'EasyPaisa'>('Cash');
  const [paymentDate, setPaymentDate] = useState<string>(() => localISODate());
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [useCredit, setUseCredit] = useState<boolean>(false);
  const [cashReceivedOverride, setCashReceivedOverride] = useState<string>('');

  // Credit Balance State (for the family / primary student)
  const [creditBalance, setCreditBalance] = useState<number>(() => {
    const famCredit = getCreditForStudents(familyStudents);
    if (famCredit > 0) return famCredit;
    return primaryStudent ? getStudentCreditBalance(primaryStudent.id) : 0;
  });
  const [isAddBalanceModalOpen, setIsAddBalanceModalOpen] = useState<boolean>(false);
  const [addBalanceAmount, setAddBalanceAmount] = useState<string>('');

  // Notes State
  const [notes, setNotes] = useState<StudentNote[]>(() => {
    return primaryStudent ? getStudentNotes(primaryStudent.id) : [];
  });
  const [notesTab, setNotesTab] = useState<'active' | 'archived'>('active');
  const [newNoteText, setNewNoteText] = useState<string>('');

  // Challan Modal State
  const [isChallanModalOpen, setIsChallanModalOpen] = useState<boolean>(false);
  const [createdChallansList, setCreatedChallansList] = useState<{
    id: string;
    challanNo: string;
    date: string;
    amount: number;
    month: string;
  }[]>([]);

  // Collapsed / Expanded rows state (empty by default: all student rows collapsed)
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());

  // Active tab per student ('unpaid' | 'paid'), default is 'unpaid'
  const [activeTabByStudent, setActiveTabByStudent] = useState<Record<string, 'unpaid' | 'paid'>>({});

  // Paid history display limit per student (defaults to 10 records)
  const [paidHistoryLimits, setPaidHistoryLimits] = useState<Record<string, number>>({});

  // Charge Modal state for a specific student (adding fine, fund, fee charges)
  const [chargeModal, setChargeModal] = useState<{
    isOpen: boolean;
    student: Student | null;
    amount: string;
    type: 'Fine' | 'Fund' | 'Admission' | 'Security' | 'Monthly Fee' | 'Other';
    reason: string;
    month: string;
    note: string;
  }>({
    isOpen: false,
    student: null,
    amount: '',
    type: 'Fine',
    reason: '',
    month: 'April 2026',
    note: ''
  });

  // Calculate dynamic final total fee based on checked items and pay amounts
  const finalFee = useMemo(() => {
    let sum = 0;
    (Object.values(itemsByStudent) as StudentFeeItem[][]).forEach(studentItems => {
      studentItems.forEach(item => {
        if (selectedItemIds.has(item.id)) {
          const maxPayable = Math.max(0, item.total - item.paidAmount);
          const val = payAmounts[item.id] !== undefined 
            ? payAmounts[item.id] 
            : maxPayable;
          sum += Math.min(Math.max(0, val), maxPayable);
        }
      });
    });
    return sum;
  }, [itemsByStudent, selectedItemIds, payAmounts]);

  // Total, Paid, and Remaining Due per student and for the whole family
  const studentTotals = useMemo(() => {
    const totalMap: Record<string, number> = {};
    const paidMap: Record<string, number> = {};
    const dueMap: Record<string, number> = {};

    (Object.entries(itemsByStudent) as [string, StudentFeeItem[]][]).forEach(([sId, items]) => {
      const tot = items.reduce((sum, i) => sum + i.total, 0);
      const pd = items.reduce((sum, i) => sum + i.paidAmount, 0);
      const due = items.reduce((sum, i) => sum + Math.max(0, i.total - i.paidAmount), 0);
      totalMap[sId] = tot;
      paidMap[sId] = pd;
      dueMap[sId] = due;

      const clean = sId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      totalMap[clean] = tot;
      paidMap[clean] = pd;
      dueMap[clean] = due;
    });

    return { totalMap, paidMap, dueMap };
  }, [itemsByStudent]);

  // Family aggregate totals (Due Remaining, Total, Paid)
  const familyTotals = useMemo(() => {
    let grandTotal = 0;
    let grandPaid = 0;
    let grandDue = 0;

    familyStudents.forEach(st => {
      const clean = st.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const tot = studentTotals.totalMap[st.id] ?? studentTotals.totalMap[clean] ?? 0;
      const pd = studentTotals.paidMap[st.id] ?? studentTotals.paidMap[clean] ?? 0;
      const due = studentTotals.dueMap[st.id] ?? studentTotals.dueMap[clean] ?? 0;

      grandTotal += tot;
      grandPaid += pd;
      grandDue += due;
    });

    // Fallback if grandDue is 0 but family had a remaining due passed via props
    if (grandDue === 0 && family && (family.totalDue > 0 || (family as any).remainingDue > 0)) {
      grandDue = family.totalDue || (family as any).remainingDue || 0;
      grandPaid = family.totalPaid || 0;
      grandTotal = grandPaid + grandDue;
    }

    return { grandTotal, grandPaid, grandDue };
  }, [familyStudents, studentTotals, family]);

  // Handle single item checkbox toggle
  const handleToggleItem = (id: string) => {
    const next = new Set(selectedItemIds);
    const willBeChecked = !next.has(id);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);

    // If item was checked, make sure its payAmount is positive and matches payable due
    if (willBeChecked) {
      let targetItem: StudentFeeItem | undefined;
      for (const list of Object.values(itemsByStudent) as StudentFeeItem[][]) {
        targetItem = list.find(i => i.id === id);
        if (targetItem) break;
      }
      if (targetItem) {
        const remaining = Math.max(0, targetItem.total - targetItem.paidAmount);
        setPayAmounts(prev => {
          if (prev[id] === undefined || prev[id] <= 0) {
            return { ...prev, [id]: remaining };
          }
          return prev;
        });
        setRawPayInputs(prev => {
          if (!prev[id] || prev[id] === '0') {
            const copy = { ...prev };
            delete copy[id];
            return copy;
          }
          return prev;
        });
      }
    }
  };

  // Toggle all items for a specific student
  const handleToggleStudentAll = (studentId: string) => {
    const studentItems = itemsByStudent[studentId] || [];
    // Only toggle items that have a balance due (payable items)
    const payableItems = studentItems.filter(i => (i.total - i.paidAmount) > 0);
    const targetItems = payableItems.length > 0 ? payableItems : studentItems;

    const allChecked = targetItems.length > 0 && targetItems.every(i => selectedItemIds.has(i.id));

    const next = new Set(selectedItemIds);
    const nextPayAmounts = { ...payAmounts };
    const nextRawPay = { ...rawPayInputs };

    if (allChecked) {
      // Uncheck all items for this student
      studentItems.forEach(i => {
        next.delete(i.id);
      });
    } else {
      // Check all payable items for this student and ensure payAmounts has their balance
      targetItems.forEach(i => {
        next.add(i.id);
        const remaining = Math.max(0, i.total - i.paidAmount);
        if (nextPayAmounts[i.id] === undefined || nextPayAmounts[i.id] <= 0) {
          nextPayAmounts[i.id] = remaining;
        }
        delete nextRawPay[i.id];
      });
    }

    setSelectedItemIds(next);
    setPayAmounts(nextPayAmounts);
    setRawPayInputs(nextRawPay);
  };

  // Handle pay amount input change (capped to max of total for that month)
  const handlePayAmountChange = (studentId: string, itemId: string, rawValue: string) => {
    const studentItems = itemsByStudent[studentId] || [];
    const item = studentItems.find(i => i.id === itemId);
    const maxPayable = item ? Math.max(0, item.total - item.paidAmount) : 0;

    if (rawValue.trim() === '') {
      setRawPayInputs(prev => ({ ...prev, [itemId]: '' }));
      setPayAmounts(prev => ({ ...prev, [itemId]: 0 }));
      return;
    }

    let num = parseInt(rawValue, 10);
    if (isNaN(num)) {
      setRawPayInputs(prev => ({ ...prev, [itemId]: '' }));
      setPayAmounts(prev => ({ ...prev, [itemId]: 0 }));
      return;
    }

    // Price pay amount can't be more than the total of that month; automatically sets to max
    let clamped = num;
    if (clamped > maxPayable) {
      clamped = maxPayable;
    } else if (clamped < 0) {
      clamped = 0;
    }

    setRawPayInputs(prev => ({ ...prev, [itemId]: clamped.toString() }));
    setPayAmounts(prev => ({
      ...prev,
      [itemId]: clamped
    }));
  };

  // Toggle student row expansion
  const toggleStudentExpand = (studentId: string) => {
    setExpandedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  // Switch tab for a student
  const setStudentTab = (studentId: string, tab: 'unpaid' | 'paid') => {
    setActiveTabByStudent(prev => ({
      ...prev,
      [studentId]: tab
    }));
  };

  // Open Charge Modal for a student
  const openChargeModal = (st: Student) => {
    setChargeModal({
      isOpen: true,
      student: st,
      amount: '',
      type: 'Fine',
      reason: '',
      month: 'April 2026',
      note: ''
    });
  };

  // Record charge against the student affecting student and family financial summary
  const handleRecordCharge = (e: React.FormEvent) => {
    e.preventDefault();
    const st = chargeModal.student;
    if (!st) return;

    const numAmount = parseInt(chargeModal.amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      onShowToast('Please enter a valid charge amount greater than 0', 'error');
      return;
    }

    const trimmedReason = chargeModal.reason.trim();
    if (!trimmedReason) {
      onShowToast('Please enter a charge reason or description', 'error');
      return;
    }

    const cleanId = st.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const monthLower = chargeModal.month.toLowerCase();
    const monthKey = monthLower.includes('may') ? '2026-05'
      : monthLower.includes('june') ? '2026-06'
      : monthLower.includes('july') ? '2026-07'
      : monthLower.includes('august') ? '2026-08'
      : monthLower.includes('september') ? '2026-09'
      : '2026-04';

    const newChargeItem = addCharge(st, {
      type: chargeModal.type,
      reason: trimmedReason,
      amount: numAmount,
      monthKey
    });

    const refreshedAll = loadAllLedgerItems();
    const updatedItems = refreshedAll[st.id] || [];

    const nextItemsByStudent = {
      ...itemsByStudent,
      [st.id]: updatedItems,
      [cleanId]: updatedItems
    };

    setItemsByStudent(nextItemsByStudent);

    // Auto-select and initialize pay amount for the new charge item
    setSelectedItemIds(prev => new Set(prev).add(newChargeItem.id));
    setPayAmounts(prev => ({
      ...prev,
      [newChargeItem.id]: numAmount
    }));

    // Save student note for audit tracking
    const noteObj: StudentNote = {
      id: `NOTE-${Date.now()}`,
      studentId: st.id,
      familyId: family?.familyId || st.familyId || 'F0000',
      author: 'Accounts Office',
      note: `Applied charge of ${formatPKR(numAmount)} for "${trimmedReason}" (${chargeModal.type}) to ${chargeModal.month}.${chargeModal.note ? ' Note: ' + chargeModal.note.trim() : ''}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      isArchived: false
    };
    const updatedNotes = saveStudentNote(st.id, noteObj);
    setNotes(updatedNotes);

    // Notify parent component (FeesModule) so global state and summaries stay in sync
    if (onAddCharge) {
      onAddCharge({
        studentId: st.id,
        amount: numAmount,
        type: chargeModal.type,
        reason: trimmedReason
      });
    }

    onShowToast(`Charge of ${formatPKR(numAmount)} added against ${st.name}!`, 'success');
    setChargeModal({
      isOpen: false,
      student: null,
      amount: '',
      type: 'Fine',
      reason: '',
      month: 'April 2026',
      note: ''
    });
  };

  // Handle "Mark as Paid"
  const handleMarkAsPaid = () => {
    if (selectedItemIds.size === 0) {
      onShowToast('Please select at least one fee item to mark as paid', 'error');
      return;
    }

    if (finalFee <= 0) {
      onShowToast('Total payment amount must be greater than zero', 'error');
      return;
    }

    const manualAllocations: { studentId: string; itemId: string; amount: number }[] = [];
    familyStudents.forEach(st => {
      const studentItems = itemsByStudent[st.id] || [];
      studentItems.forEach(item => {
        if (selectedItemIds.has(item.id)) {
          const paying = payAmounts[item.id] !== undefined
            ? payAmounts[item.id]
            : Math.max(0, item.total - item.paidAmount);
          if (paying > 0) {
            manualAllocations.push({ studentId: st.id, itemId: item.id, amount: paying });
          }
        }
      });
    });

    const creditApplied = useCredit ? Math.min(creditBalance, finalFee) : 0;
    const defaultCash = Math.max(0, finalFee - creditApplied);
    const cashAmount = cashReceivedOverride.trim() !== ''
      ? Math.max(0, Number(cashReceivedOverride) || 0)
      : defaultCash;

    const payment = recordPayment({
      students: familyStudents,
      amount: cashAmount,
      method: normalizeMethod(paymentMethod),
      date: paymentDate,
      note: paymentNote.trim() || undefined,
      createdBy: 'Accounts Office',
      useCredit,
      manualAllocations
    });

    // Reload updated ledger items and credit balance from single source of truth
    const refreshedAll = loadAllLedgerItems();
    const newItemsByStudent: Record<string, StudentFeeItem[]> = { ...itemsByStudent };
    familyStudents.forEach(st => {
      const items = refreshedAll[st.id] || [];
      newItemsByStudent[st.id] = items;
      const clean = st.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      newItemsByStudent[clean] = items;
    });
    setItemsByStudent(newItemsByStudent);
    setCreditBalance(getCreditForStudents(familyStudents));
    setUseCredit(false);
    setCashReceivedOverride('');

    const studentPaymentsList: { studentId: string; amountPaid: number; itemsPaidCount: number }[] = [];
    familyStudents.forEach(st => {
      const stAllocations = payment.allocations.filter(a => a.studentId === st.id);
      const amountPaid = stAllocations.reduce((sum, a) => sum + a.amount, 0);
      if (amountPaid > 0) {
        studentPaymentsList.push({
          studentId: st.id,
          amountPaid,
          itemsPaidCount: stAllocations.length
        });
      }
    });

    // Save payment note if provided
    if (paymentNote.trim() && primaryStudent) {
      const noteObj: StudentNote = {
        id: `NOTE-${Date.now()}`,
        studentId: primaryStudent.id,
        familyId: family?.familyId || primaryStudent.familyId || 'F0000',
        author: 'Accounts Office',
        note: `Paid ${formatPKR(cashAmount)} via ${paymentMethod} on ${paymentDate} (${payment.receiptNo}). Note: ${paymentNote.trim()}`,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        isArchived: false
      };
      const updatedNotes = saveStudentNote(primaryStudent.id, noteObj);
      setNotes(updatedNotes);
      setPaymentNote('');
    }

    // Build invoice record for redirection and printable slips
    const paidStudentsList: FeeInvoiceStudentGroup[] = [];
    let calculatedSubtotal = 0;
    let calculatedPaid = 0;

    familyStudents.forEach(st => {
      const studentItems = newItemsByStudent[st.id] || [];
      const paidItems: FeeInvoiceItem[] = [];
      let stSubtotal = 0;
      let stPaid = 0;

      studentItems.forEach(item => {
        const alloc = payment.allocations.find(a => a.itemId === item.id);
        const paying = alloc ? alloc.amount : 0;
        if (paying > 0) {
          let purposeName = item.reason || item.type;
          if (item.type === 'Fund') {
            purposeName = item.reason.startsWith('Fund') ? item.reason : `Fund - (${item.reason})`;
          } else if (item.type === 'Admission') {
            purposeName = 'Admission Fee';
          } else if (item.type === 'Security') {
            purposeName = 'Security Fee';
          } else if (item.type === 'Monthly Fee') {
            purposeName = 'Monthly Fee';
          } else if (item.type === 'Fine') {
            purposeName = 'Fine';
          }

          const itemClass = (item.type === 'Admission' || item.type === 'Security') 
            ? '-' 
            : (st.class || 'Class 4');

          paidItems.push({
            id: item.id,
            studentId: st.id,
            studentName: st.name,
            studentRollNo: st.rollNo || st.id,
            purpose: purposeName,
            month: item.month,
            className: itemClass,
            discount: 0,
            discountDisplay: '-',
            fee: item.total,
            feeDisplay: `${item.total.toLocaleString()} PKR`,
            paidAmount: paying
          });

          stSubtotal += item.total;
          stPaid += paying;
        }
      });

      if (paidItems.length > 0) {
        paidStudentsList.push({
          studentId: st.id,
          studentName: st.name,
          studentRollNo: st.rollNo || st.id,
          className: st.class || 'Class 4',
          items: paidItems,
          studentSubtotal: stSubtotal,
          studentPaid: stPaid
        });
        calculatedSubtotal += stSubtotal;
        calculatedPaid += stPaid;
      }
    });

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const invoiceNumber = payment.receiptNo;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDateOnly = `${pad(now.getDate())} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeString = `${pad(hours)}:${pad(now.getMinutes())} ${ampm}`;
    const formattedDateTime = `${formattedDateOnly} ${timeString}`;

    const invoiceData: FeeInvoiceData = {
      invoiceNumber,
      paymentDate: formattedDateTime,
      formattedDateOnly,
      paymentMethod,
      status: 'Paid',
      school: {
        name: 'Demo School Schooliee Pakistan',
        address: 'Faisalabad, Punjab, Pakistan',
        phone: '03356226026',
        email: 'demo-school@schooliee.com'
      },
      invoiceTo: {
        guardianName: family?.familyName || primaryStudent?.family || 'Shahid Abbasi',
        familyId: family?.familyId || primaryStudent?.familyId || 'F-0094',
        phone: family?.phone || primaryStudent?.phone || '+923987423088',
        address: primaryStudent?.address || '305 Manor Drive, Karachi'
      },
      students: paidStudentsList,
      subtotal: calculatedSubtotal > 0 ? calculatedSubtotal : finalFee,
      paidAmount: calculatedPaid > 0 ? calculatedPaid : finalFee,
      note: paymentNote.trim() || undefined
    };

    if (onPaymentSuccess) {
      onPaymentSuccess({
        studentPayments: studentPaymentsList,
        totalAmount: cashAmount,
        paymentMethod
      });
    }

    onShowToast(`Successfully received ${formatPKR(cashAmount)} via ${paymentMethod} (${payment.receiptNo})! Redirecting to invoice...`, 'success');

    if (onNavigateToInvoice) {
      onNavigateToInvoice(invoiceData);
    } else {
      setInternalInvoice(invoiceData);
    }
  };

  // Handle Add Balance
  const handleConfirmAddBalance = () => {
    const amt = parseInt(addBalanceAmount, 10);
    if (isNaN(amt) || amt <= 0 || !primaryStudent) {
      onShowToast('Please enter a valid balance amount', 'error');
      return;
    }
    const nextBalance = creditBalance + amt;
    setCreditBalance(nextBalance);
    const owner = creditOwner(familyStudents);
    setStudentCreditBalance(owner, nextBalance);
    setIsAddBalanceModalOpen(false);
    setAddBalanceAmount('');
    onShowToast(`Added ${formatPKR(amt)} to credit balance`, 'success');
  };

  // Handle Add Note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !primaryStudent) return;

    const noteObj: StudentNote = {
      id: `NOTE-${Date.now()}`,
      studentId: primaryStudent.id,
      familyId: family?.familyId || primaryStudent.familyId || 'F0000',
      author: 'Admin',
      note: newNoteText.trim(),
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      isArchived: false
    };

    const updated = saveStudentNote(primaryStudent.id, noteObj);
    setNotes(updated);
    setNewNoteText('');
    onShowToast('Note saved successfully', 'success');
  };

  // Guardian profile details
  const guardianName = family?.familyName || primaryStudent?.family || 'Family Head';
  const guardianCode = guardianName
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'FH';

  const guardianPhone = family?.phone || primaryStudent?.phone || primaryStudent?.whatsapp || '+923987423088';
  const guardianAddress = primaryStudent?.address || 'Main Campus Area, Pakistan';

  const displayedNotes = notes.filter(n => notesTab === 'active' ? !n.isArchived : n.isArchived);

  // If local invoice is active, render the dedicated FeeInvoicePage
  if (internalInvoice) {
    return (
      <FeeInvoicePage
        invoiceData={internalInvoice}
        onBackToFamily={() => setInternalInvoice(null)}
        onBackToFees={onBack}
        onShowToast={onShowToast}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f18] text-slate-100 font-sans pb-16" id="family-student-fee-details-page">
      {/* Top Breadcrumb & Page Header */}
      <div className="border-b border-[#182335] bg-[#0c1320]/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <BreadcrumbTrail
              items={[
                { label: 'Overview', onClick: onBreadcrumbOverview },
                { label: 'Fees', onClick: onBack },
                { label: 'Fee Details' }
              ]}
              className="mb-1"
            />
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              Fee Details
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {familyStudents.length} Student{familyStudents.length > 1 ? 's' : ''} in Family
              </span>
            </h1>
          </div>

          {/* Top Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setIsChallanModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#141d2d] hover:bg-[#1a263a] border border-[#21324a] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              id="btn-print-fee-details"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Print Challan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFeeCardTargetStudentId(primaryStudent?.id);
                setIsFeeCardModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              id="btn-generate-fee-card-details"
            >
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>Generate Fee Card</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!primaryStudent) return;
                const names = familyStudents.map(s => s.name);
                const url = createWhatsAppFeeAlertUrl(
                  guardianPhone,
                  guardianName,
                  names,
                  finalFee > 0 ? finalFee : 5000,
                  family?.familyId || primaryStudent.familyId || 'F0000'
                );
                window.open(url, '_blank');
              }}
              className="px-3.5 py-2 rounded-xl bg-[#141d2d] hover:bg-[#1a263a] border border-[#21324a] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              id="btn-send-reminder"
            >
              <BellRing className="w-4 h-4 text-amber-400" />
              <span>Send Reminder</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Guardian / Parent Identity Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0f1726] border border-[#1d2b40] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 border border-cyan-400/40 text-white font-extrabold text-xl flex items-center justify-center shadow-lg shadow-cyan-600/25 shrink-0">
              {guardianCode}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {guardianName}
                </h2>
                {primaryStudent && (
                  <Eye 
                    className="w-4 h-4 text-blue-400 hover:text-blue-300 cursor-pointer" 
                    title="View Student Profile"
                    onClick={() => onSelectStudentProfile(primaryStudent)}
                  />
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Family ID: {family?.familyId || primaryStudent?.familyId || 'F-0000'}
              </p>
            </div>
          </div>

          {/* Contact Details & Family Financial Summary */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-[#1b283d] text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 text-slate-300">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-slate-200">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{guardianPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{guardianAddress}</span>
                </div>
              </div>
            </div>

            {/* Family Financial Breakdown: Total, Paid, Due Remaining */}
            <div className="flex items-center gap-2 sm:gap-3 bg-[#0a0f19] border border-[#1b293d] rounded-xl px-3 py-2 shadow-inner">
              <div className="text-right px-2 border-r border-[#19263a]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total
                </span>
                <span className="text-xs sm:text-sm font-bold text-cyan-400 font-mono">
                  {formatPKR(familyTotals.grandTotal)}
                </span>
              </div>
              <div className="text-right px-2 border-r border-[#19263a]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Paid
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                  {formatPKR(familyTotals.grandPaid)}
                </span>
              </div>
              <div className="text-right px-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Due Remaining
                </span>
                <span className="text-xs sm:text-sm font-black text-rose-400 font-mono">
                  {formatPKR(familyTotals.grandDue)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: Left 8 cols (Student Containers), Right 4 cols (Payment Panel & Notes) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ================= LEFT COLUMN: CONTAINER FOR EACH STUDENT ================= */}
          <div className="lg:col-span-8 space-y-6">
            {familyStudents.length === 0 ? (
              <div className="p-8 text-center bg-[#0f1726] rounded-2xl border border-[#1d2b40] text-slate-400 text-xs">
                No student accounts found for this family.
              </div>
            ) : (
              familyStudents.map((st) => {
                const cleanId = st.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const studentItems = itemsByStudent[st.id] || itemsByStudent[cleanId] || [];
                
                // Outstanding fee items (unpaid or partially paid)
                const outstandingItems = studentItems.filter(i => (i.total - i.paidAmount) > 0);
                
                // Paid fee history items (any item where a payment was made)
                const paidHistoryItems = studentItems.filter(i => i.paidAmount > 0);

                const isExpanded = expandedStudentIds.has(st.id);
                const activeTab = activeTabByStudent[st.id] || 'unpaid';

                const studentFeeTotal = studentTotals.totalMap[st.id] ?? studentTotals.totalMap[cleanId] ?? 0;
                const studentFeePaid = studentTotals.paidMap[st.id] ?? studentTotals.paidMap[cleanId] ?? 0;
                const studentFeeDue = studentTotals.dueMap[st.id] ?? studentTotals.dueMap[cleanId] ?? 0;

                const currentLimit = paidHistoryLimits[st.id] || 10;
                const displayedPaidHistory = paidHistoryItems.slice(0, currentLimit);

                const allOutstandingChecked = outstandingItems.length > 0 && outstandingItems.every(i => selectedItemIds.has(i.id));
                const checkedOutstandingCount = outstandingItems.filter(i => selectedItemIds.has(i.id)).length;

                return (
                  <div 
                    key={st.id} 
                    className="rounded-2xl bg-[#0f1726] border border-[#1d2b40] overflow-hidden shadow-sm transition-all"
                    id={`fee-student-container-${st.id}`}
                  >
                    {/* Collapsed-by-default Student Row Header */}
                    <div 
                      onClick={() => toggleStudentExpand(st.id)}
                      className="p-4 bg-[#131d2f] hover:bg-[#162237] border-b border-[#1b273b] flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none transition-colors"
                    >
                      {/* Left: Chevron + Avatar + Student Details */}
                      <div className="flex items-center gap-3">
                        <div className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-blue-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center shrink-0 text-sm">
                          {st.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStudentProfile(st);
                              }}
                              className="font-bold text-white hover:text-blue-400 text-sm transition-colors text-left cursor-pointer"
                            >
                              {st.name}
                            </button>
                            <span className="text-[11px] font-mono text-slate-400">
                              ({st.rollNo || st.id})
                            </span>
                            <Eye 
                              className="w-3.5 h-3.5 text-blue-400 hover:text-blue-300 cursor-pointer" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStudentProfile(st);
                              }}
                              title="View Student Profile"
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 block">
                            Class: <strong className="text-slate-300">{st.class}</strong> ({st.section || 'A'})
                          </span>
                        </div>
                      </div>

                      {/* Right: Total Paid, Remaining Due, Add Payment Button */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {/* Total Paid */}
                        <div className="text-right px-3 py-1.5 bg-[#090f19] rounded-xl border border-[#1b2a3f]">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                            Total Paid
                          </span>
                          <span className="text-xs font-bold text-emerald-400 font-mono">
                            {formatPKR(studentFeePaid)}
                          </span>
                        </div>

                        {/* Remaining Due */}
                        <div className="text-right px-3 py-1.5 bg-[#090f19] rounded-xl border border-[#1b2a3f]">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                            Remaining Due
                          </span>
                          <span className={`text-xs font-black font-mono ${studentFeeDue > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {formatPKR(studentFeeDue)}
                          </span>
                        </div>

                        {/* Charge Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openChargeModal(st);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/25 flex items-center gap-1.5 cursor-pointer shrink-0"
                          id={`btn-charge-${st.id}`}
                          title={`Add charge against ${st.name}`}
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Charge</span>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content with Two Tabs: Unpaid (Default) & Paid History */}
                    {isExpanded && (
                      <div className="border-t border-[#1b273b] bg-[#0c1422] p-4 space-y-4">
                        {/* Tab Switcher */}
                        <div className="flex items-center justify-between gap-3 border-b border-[#1b273b] pb-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            {/* Tab 1: Unpaid (Default) */}
                            <button
                              type="button"
                              onClick={() => setStudentTab(st.id, 'unpaid')}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                activeTab === 'unpaid'
                                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                  : 'bg-[#131d2e] text-slate-300 hover:bg-[#1a283f] hover:text-white'
                              }`}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Unpaid</span>
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                activeTab === 'unpaid' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {outstandingItems.length}
                              </span>
                            </button>

                            {/* Tab 2: Paid History */}
                            <button
                              type="button"
                              onClick={() => setStudentTab(st.id, 'paid')}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                activeTab === 'paid'
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                  : 'bg-[#131d2e] text-slate-300 hover:bg-[#1a283f] hover:text-white'
                              }`}
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>Paid History</span>
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                activeTab === 'paid' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {paidHistoryItems.length}
                              </span>
                            </button>
                          </div>

                          {/* Unpaid Tab: Quick Select All */}
                          {activeTab === 'unpaid' && outstandingItems.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleToggleStudentAll(st.id)}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                allOutstandingChecked
                                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                                  : 'bg-[#182335] border-[#22334e] text-slate-300 hover:bg-[#1f2d44]'
                              }`}
                            >
                              {allOutstandingChecked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span>
                                {allOutstandingChecked ? 'All Selected' : `Select All (${checkedOutstandingCount}/${outstandingItems.length})`}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Tab 1 Content: Unpaid Fees */}
                        {activeTab === 'unpaid' && (
                          <div>
                            {outstandingItems.length === 0 ? (
                              (() => {
                                const clsObj = classes.find(c => c.name.trim().toLowerCase() === (st.class || '').trim().toLowerCase());
                                const hasNoClassFee = studentItems.length === 0 && (Number(clsObj?.fee) || 0) <= 0;
                                if (hasNoClassFee) {
                                  return (
                                    <div className="py-8 px-4 text-center rounded-xl bg-[#090f19] border border-amber-500/30 space-y-2">
                                      <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                                      <p className="text-xs font-semibold text-amber-300">
                                        Set the class fee for {st.class || 'this class'} to start billing
                                      </p>
                                      {onNavigateToClasses && (
                                        <button
                                          type="button"
                                          onClick={onNavigateToClasses}
                                          className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5"
                                        >
                                          <span>Go to Classes</span>
                                        </button>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="py-8 px-4 text-center rounded-xl bg-[#090f19] border border-[#19263a] space-y-2">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                                    <p className="text-xs font-semibold text-slate-200">No Outstanding Fees</p>
                                    <p className="text-[11px] text-slate-400">
                                      All admission fees, fund charges, and monthly fees for {st.name} have been fully cleared!
                                    </p>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-[#1b273b] bg-[#090f19]">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-[#1b273b] bg-[#111928] text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                                      <th className="py-2.5 px-3 w-8">
                                        <input
                                          type="checkbox"
                                          checked={allOutstandingChecked}
                                          onChange={() => handleToggleStudentAll(st.id)}
                                          className="rounded bg-[#0a0f18] border-[#22334e] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                                        />
                                      </th>
                                      <th className="py-2.5 px-3">Month</th>
                                      <th className="py-2.5 px-3">Type</th>
                                      <th className="py-2.5 px-3">Reason</th>
                                      <th className="py-2.5 px-3">Total</th>
                                      <th className="py-2.5 px-3">Paid</th>
                                      <th className="py-2.5 px-3">Remaining Due</th>
                                      <th className="py-2.5 px-3 w-36">Pay Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#172233]">
                                    {outstandingItems.map((item) => {
                                      const isChecked = selectedItemIds.has(item.id);
                                      const maxPayable = Math.max(0, item.total - item.paidAmount);
                                      const currentPayVal = payAmounts[item.id] !== undefined 
                                        ? payAmounts[item.id] 
                                        : maxPayable;
                                      const payDisplayValue = rawPayInputs[item.id] !== undefined
                                        ? rawPayInputs[item.id]
                                        : (currentPayVal === 0 ? '' : currentPayVal.toString());

                                      return (
                                        <tr 
                                          key={item.id} 
                                          className={`hover:bg-[#131d2c] transition-colors ${
                                            isChecked ? 'bg-[#0f1725]' : 'opacity-70'
                                          }`}
                                        >
                                          {/* Checkbox */}
                                          <td className="py-2.5 px-3">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleItem(item.id)}
                                              className="rounded bg-[#0a0f18] border-[#22334e] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                                            />
                                          </td>

                                          {/* Month */}
                                          <td className="py-2.5 px-3 text-slate-200 font-medium whitespace-nowrap">
                                            {item.month}
                                          </td>

                                          {/* Type */}
                                          <td className="py-2.5 px-3">
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-900/30 text-blue-300 border border-blue-700/40">
                                              {item.type}
                                            </span>
                                          </td>

                                          {/* Reason */}
                                          <td className="py-2.5 px-3 text-slate-300">
                                            {item.reason}
                                          </td>

                                          {/* Total */}
                                          <td className="py-2.5 px-3 font-bold text-slate-300 whitespace-nowrap font-mono">
                                            {formatPKR(item.total)}
                                          </td>

                                          {/* Paid */}
                                          <td className="py-2.5 px-3 font-semibold text-emerald-400 whitespace-nowrap font-mono">
                                            {formatPKR(item.paidAmount)}
                                          </td>

                                          {/* Remaining Due */}
                                          <td className="py-2.5 px-3 font-black text-rose-400 whitespace-nowrap font-mono">
                                            {formatPKR(maxPayable)}
                                          </td>

                                          {/* Pay Amount input */}
                                          <td className="py-2.5 px-3">
                                            <input
                                              type="number"
                                              min={0}
                                              max={maxPayable}
                                              value={payDisplayValue}
                                              onChange={(e) => handlePayAmountChange(st.id, item.id, e.target.value)}
                                              onBlur={() => {
                                                setRawPayInputs(prev => {
                                                  const copy = { ...prev };
                                                  delete copy[item.id];
                                                  return copy;
                                                });
                                              }}
                                              placeholder="0"
                                              disabled={!isChecked}
                                              className="w-full px-3 py-1.5 rounded-lg bg-[#0b101a] border border-[#21334c] text-white focus:outline-none focus:border-blue-500 text-xs font-mono font-semibold text-right disabled:opacity-40 disabled:cursor-not-allowed"
                                              title={`Max payable for this item is ${formatPKR(maxPayable)}`}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 2 Content: Paid History */}
                        {activeTab === 'paid' && (
                          <div>
                            {paidHistoryItems.length === 0 ? (
                              <div className="py-8 px-4 text-center rounded-xl bg-[#090f19] border border-[#19263a] space-y-2">
                                <History className="w-8 h-8 text-slate-500 mx-auto" />
                                <p className="text-xs font-semibold text-slate-300">No Payment History</p>
                                <p className="text-[11px] text-slate-500">
                                  No fee payments have been recorded for {st.name} yet.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="overflow-x-auto rounded-xl border border-[#1b273b] bg-[#090f19]">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="border-b border-[#1b273b] bg-[#111928] text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                                        <th className="py-2.5 px-3">Month</th>
                                        <th className="py-2.5 px-3">Fee Type</th>
                                        <th className="py-2.5 px-3">Description / Reason</th>
                                        <th className="py-2.5 px-3 text-right">Original Total</th>
                                        <th className="py-2.5 px-3 text-right">Amount Paid</th>
                                        <th className="py-2.5 px-3 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#172233]">
                                      {displayedPaidHistory.map((item) => {
                                        const isFullyPaid = item.paidAmount >= item.total;
                                        return (
                                          <tr key={item.id} className="hover:bg-[#131d2c] transition-colors">
                                            <td className="py-2.5 px-3 text-slate-200 font-medium whitespace-nowrap">
                                              {item.month}
                                            </td>
                                            <td className="py-2.5 px-3">
                                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                                                {item.type}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-300">
                                              {item.reason}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                                              {formatPKR(item.total)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                              {formatPKR(item.paidAmount)}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                              {isFullyPaid ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                  <CheckCircle2 className="w-3 h-3" />
                                                  <span>Paid</span>
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                  <Clock className="w-3 h-3" />
                                                  <span>Partially Paid</span>
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Pagination / View More Controls */}
                                {paidHistoryItems.length > 10 && (
                                  <div className="flex items-center justify-between text-xs text-slate-400 px-3 py-2 bg-[#090f19] rounded-lg border border-[#19263a] flex-wrap gap-2">
                                    <span>
                                      Showing {displayedPaidHistory.length} of {paidHistoryItems.length} paid records
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {displayedPaidHistory.length < paidHistoryItems.length ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPaidHistoryLimits(prev => ({
                                              ...prev,
                                              [st.id]: (prev[st.id] || 10) + 10
                                            }));
                                          }}
                                          className="px-2.5 py-1 rounded bg-[#162338] hover:bg-[#1d2f4c] text-blue-400 hover:text-blue-300 font-semibold text-xs transition-colors cursor-pointer"
                                        >
                                          View More (+{Math.min(10, paidHistoryItems.length - displayedPaidHistory.length)})
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPaidHistoryLimits(prev => ({
                                              ...prev,
                                              [st.id]: 10
                                            }));
                                          }}
                                          className="px-2.5 py-1 rounded bg-[#162338] hover:bg-[#1d2f4c] text-slate-400 hover:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                                        >
                                          Show Less (10)
                                        </button>
                                      )}
                                      {displayedPaidHistory.length < paidHistoryItems.length && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPaidHistoryLimits(prev => ({
                                              ...prev,
                                              [st.id]: paidHistoryItems.length
                                            }));
                                          }}
                                          className="px-2.5 py-1 rounded bg-[#162338] hover:bg-[#1d2f4c] text-slate-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                                        >
                                          Show All ({paidHistoryItems.length})
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ================= RIGHT COLUMN: AGGREGATE PAYMENT & NOTES ================= */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-4 self-start z-20">
            {/* Payment Panel: Sticks when scrolling */}
            <div className="rounded-2xl bg-[#0f1726] border border-[#1d2b40] p-5 shadow-xl space-y-5 max-h-[calc(100vh-2rem)] overflow-y-auto" id="sticky-payment-panel">
              {/* Credit Pill */}
              <div className="space-y-2 pb-3 border-b border-[#1b273b]">
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-slate-400">Credit Balance: </span>
                    <span className="font-bold text-white">{creditBalance.toLocaleString()} PKR</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddBalanceModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 text-[11px] font-bold transition-all cursor-pointer"
                  >
                    Add Balance
                  </button>
                </div>
                {creditBalance > 0 && (
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={useCredit}
                        onChange={(e) => setUseCredit(e.target.checked)}
                        className="rounded border-emerald-500/50 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold text-emerald-300">
                        Use available credit
                      </span>
                    </div>
                    {useCredit && (
                      <span className="text-[11px] font-bold text-emerald-400">
                        -{formatPKR(Math.min(creditBalance, finalFee))}
                      </span>
                    )}
                  </label>
                )}
              </div>

              {/* Summary Stats */}
              {(() => {
                const creditApplied = useCredit ? Math.min(creditBalance, finalFee) : 0;
                const defaultCash = Math.max(0, finalFee - creditApplied);
                const effectiveCash = cashReceivedOverride.trim() !== ''
                  ? Math.max(0, Number(cashReceivedOverride) || 0)
                  : defaultCash;
                const extraCredit = Math.max(0, effectiveCash - defaultCash);

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Selected Items:</span>
                      <span className="font-bold text-slate-200">{selectedItemIds.size} item(s)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Students Included:</span>
                      <span className="font-bold text-slate-200">
                        {familyStudents.filter(st => (itemsByStudent[st.id] || []).some(i => selectedItemIds.has(i.id))).length} / {familyStudents.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-[#1b273b]">
                      <span className="font-bold text-slate-200">Total Payable:</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        {formatPKR(defaultCash)}
                      </span>
                    </div>
                    <div className="pt-1">
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Cash Received (PKR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={cashReceivedOverride !== '' ? cashReceivedOverride : String(defaultCash)}
                        onChange={(e) => setCashReceivedOverride(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                      {extraCredit > 0 && (
                        <p className="mt-1 text-[11px] font-semibold text-emerald-400">
                          Rs {extraCredit.toLocaleString()} extra will be saved as credit
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'Online Transfer', 'Bank Deposit', 'JazzCash'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                        paymentMethod === m
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                          : 'bg-[#141e2f] border-[#22334e] text-slate-300 hover:bg-[#1a273e]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Payment Note (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Paid by father in cash at fee counter"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-xs focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>

              {/* Mark as Paid CTA Button */}
              <button
                type="button"
                onClick={handleMarkAsPaid}
                disabled={selectedItemIds.size === 0 || finalFee <= 0}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                id="btn-mark-as-paid"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark as Paid ({formatPKR(finalFee)})</span>
              </button>
            </div>

            {/* Notes Log Card */}
            <div className="rounded-2xl bg-[#0f1726] border border-[#1d2b40] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Notes &amp; Activity
                </h3>
                <div className="flex rounded-lg bg-[#141d2d] p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setNotesTab('active')}
                    className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                      notesTab === 'active' ? 'bg-[#22344f] text-white' : 'text-slate-400'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesTab('archived')}
                    className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                      notesTab === 'archived' ? 'bg-[#22344f] text-white' : 'text-slate-400'
                    }`}
                  >
                    Archived
                  </button>
                </div>
              </div>

              {/* Add Note Input Form */}
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add note..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#0b101a] border border-[#21334c] text-white text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Save
                </button>
              </form>

              {/* Displayed Notes List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {displayedNotes.length === 0 ? (
                  <p className="text-[11px] text-slate-500 text-center py-2">No notes recorded.</p>
                ) : (
                  displayedNotes.map(n => (
                    <div key={n.id} className="p-2 rounded-lg bg-[#121b2a] border border-[#1e2d42] text-[11px]">
                      <p className="text-slate-300">{n.note}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                        <span>{n.author} • {n.date}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Sticky Mark as Paid bar (Always sticks when scrolling on mobile/tablet) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-[#0a0f18]/95 backdrop-blur-md border-t border-[#1d2b40] z-40 shadow-2xl flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Total Payable</span>
          <span className="text-base font-black text-emerald-400 font-mono">{formatPKR(finalFee)}</span>
        </div>
        <button
          type="button"
          onClick={handleMarkAsPaid}
          disabled={selectedItemIds.size === 0 || finalFee <= 0}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Mark as Paid ({formatPKR(finalFee)})</span>
        </button>
      </div>

      {/* Add Balance Modal */}
      {isAddBalanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0f1725] border border-[#21334c] rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Add Credit Balance</h3>
            <p className="text-xs text-slate-400">
              Enter deposit amount to credit to this family&apos;s account.
            </p>
            <input
              type="number"
              value={addBalanceAmount}
              onChange={(e) => setAddBalanceAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full px-3.5 py-2 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddBalanceModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#192435] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddBalance}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
              >
                Deposit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Charge Modal */}
      {chargeModal.isOpen && chargeModal.student && (() => {
        const cSt = chargeModal.student;
        const cleanId = cSt.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cDue = studentTotals.dueMap[cSt.id] ?? studentTotals.dueMap[cleanId] ?? 0;
        const cPaid = studentTotals.paidMap[cSt.id] ?? studentTotals.paidMap[cleanId] ?? 0;
        const cTotal = studentTotals.totalMap[cSt.id] ?? studentTotals.totalMap[cleanId] ?? 0;
        const enteredAmt = parseInt(chargeModal.amount, 10) || 0;

        const quickPresets = [
          { type: 'Fine' as const, reason: 'Late Submission Fine', amount: 500 },
          { type: 'Fund' as const, reason: 'Sports Gala Fund', amount: 1000 },
          { type: 'Fund' as const, reason: 'Science & Computer Lab Fund', amount: 1200 },
          { type: 'Fine' as const, reason: 'Library Overdue Fine', amount: 300 },
          { type: 'Fund' as const, reason: 'Exam / Paper Charges', amount: 800 },
          { type: 'Fine' as const, reason: 'Disciplinary Fine', amount: 1000 }
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-[#0f1725] border border-[#21334c] rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#1d2b40]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-400 font-bold flex items-center justify-center text-sm">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Add Charge to Account</h3>
                    <p className="text-xs text-slate-400">
                      {cSt.name} ({cSt.rollNo || cSt.id}) • Class: {cSt.class} ({cSt.section || 'A'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChargeModal(prev => ({ ...prev, isOpen: false, student: null }))}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Student Financial Mini Summary */}
              <div className="p-3.5 rounded-xl bg-[#090f19] border border-[#19263a] grid grid-cols-4 gap-2 text-center">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Total Fee</span>
                  <span className="text-xs font-bold text-slate-200 font-mono">{formatPKR(cTotal)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Total Paid</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">{formatPKR(cPaid)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Current Due</span>
                  <span className={`text-xs font-black font-mono ${cDue > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {formatPKR(cDue)}
                  </span>
                </div>
                <div className="bg-amber-950/20 rounded-lg p-1 border border-amber-500/30">
                  <span className="text-[9px] uppercase font-bold text-amber-400 block tracking-wider">After Charge</span>
                  <span className="text-xs font-black text-amber-300 font-mono">
                    {formatPKR(cDue + enteredAmt)}
                  </span>
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-2">Quick Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {quickPresets.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setChargeModal(prev => ({
                          ...prev,
                          type: qp.type,
                          reason: qp.reason,
                          amount: qp.amount.toString()
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#141e2e] hover:bg-[#1b2a40] border border-[#22354e] hover:border-amber-500/50 text-slate-300 hover:text-white text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{qp.reason}</span>
                      <span className="font-mono text-amber-400 font-bold">({formatPKR(qp.amount)})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleRecordCharge} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Charge Type <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={chargeModal.type}
                      onChange={(e) => setChargeModal(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Fine">Fine (Late fee, disciplinary)</option>
                      <option value="Fund">Fund (Sports, Lab, Library, Exam)</option>
                      <option value="Monthly Fee">Monthly Tuition Fee</option>
                      <option value="Admission">Admission Fee</option>
                      <option value="Security">Security Deposit</option>
                      <option value="Other">Other / Custom Charge</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Billing Month
                    </label>
                    <select
                      value={chargeModal.month}
                      onChange={(e) => setChargeModal(prev => ({ ...prev, month: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="April 2026">April 2026</option>
                      <option value="May 2026">May 2026</option>
                      <option value="June 2026">June 2026</option>
                      <option value="July 2026">July 2026</option>
                      <option value="August 2026">August 2026</option>
                      <option value="September 2026">September 2026</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Reason / Charge Description <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={chargeModal.reason}
                    onChange={(e) => setChargeModal(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="e.g. Science Lab Maintenance, Library Replacement Book, Late Fee Fine"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Charge Amount (PKR) <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {[500, 1000, 1500, 2000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setChargeModal(prev => ({ ...prev, amount: amt.toString() }))}
                          className="px-1.5 py-0.5 rounded bg-[#162338] hover:bg-[#1d2f4a] text-[10px] text-amber-400 font-mono font-bold cursor-pointer transition-colors"
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number"
                    required
                    min={1}
                    value={chargeModal.amount}
                    onChange={(e) => setChargeModal(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount in PKR (e.g. 1000)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-sm font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Remarks / Internal Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={chargeModal.note}
                    onChange={(e) => setChargeModal(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="e.g. Authorized by Principal / Added per request"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0b101a] border border-[#21334c] text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1d2b40]">
                  <button
                    type="button"
                    onClick={() => setChargeModal(prev => ({ ...prev, isOpen: false, student: null }))}
                    className="px-4 py-2 rounded-xl bg-[#182335] hover:bg-[#202f48] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Apply Charge ({formatPKR(enteredAmt)})</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Challan Modal */}
      <FeeChallanModal
        isOpen={isChallanModalOpen}
        onClose={() => setIsChallanModalOpen(false)}
        name={primaryStudent ? primaryStudent.name : guardianName}
        idNumber={primaryStudent ? primaryStudent.id : (family?.familyId || 'F0001')}
        className={primaryStudent?.class || 'School'}
        section={primaryStudent?.section || 'A'}
        phone={guardianPhone}
        family={guardianName}
        totalFee={finalFee > 0 ? finalFee : 5000}
        totalPaid={0}
        remainingDue={finalFee > 0 ? finalFee : 5000}
      />

      {/* Fee Card Modal */}
      <FeeCardModal
        isOpen={isFeeCardModalOpen}
        onClose={() => {
          setIsFeeCardModalOpen(false);
          setFeeCardTargetStudentId(undefined);
        }}
        students={allStudents || familyStudents}
        classes={classes}
        initialSelectedStudentId={feeCardTargetStudentId}
        onShowToast={onShowToast}
      />
    </div>
  );
};
