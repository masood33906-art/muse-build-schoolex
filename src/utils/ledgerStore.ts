import { PaymentMethod } from '../types';
import { loadJSON, saveJSON, mustSave } from './storage';

export interface LedgerDocument {
  name: string;
  type: 'Invoice' | 'Receipt' | 'Document';
  fileId?: string;
  fileData?: string; // legacy base64 fallback
  uploadDate?: string;
}

export interface LedgerTransaction {
  id: string;
  date: string; // e.g. '16 Sep 2026' or '2026-09-16'
  rawDate: string; // '2026-09-16' for filtering
  time: string; // e.g. '05:09 PM'
  timestamp: number;
  amount: number;
  createdBy: string; // e.g. 'Demo school'
  paymentType: PaymentMethod;
  type: 'Incoming' | 'Outgoing' | 'System';
  category?: string; // e.g. 'Monthly Fee', 'Admission Fee', 'Security', 'Fund', 'Electricity Bill', 'Staff Salary'
  reason: string; // Description / Reason
  note?: string;
  document?: LedgerDocument;
}

export const LEDGER_STORAGE_KEY = 'schoollee_ledger_transactions_v2';
export const LEDGER_TX_KEY = 'schoollee_ledger_transactions_clean_v1';

// Helper to format currency in PKR
export function formatPKR(amount: number): string {
  return `${amount.toLocaleString('en-PK')} PKR`;
}

// Helper to format in Lac / Millions for radial chart
export function formatLac(amount: number): string {
  if (amount >= 100000) {
    const lac = amount / 100000;
    return `${lac.toFixed(2)} Lac`;
  }
  return formatPKR(amount);
}

// Generate initial transactions
// Exactly 71 Incoming + 7 Outgoing = 78 total
// Total Income = 2,829,698 PKR
// Total Expenses = 2,085,090 PKR
// Balance / Profit = 744,608 PKR (7.45 Lac)
export function getInitialLedgerTransactions(): LedgerTransaction[] {
  const transactions: LedgerTransaction[] = [
    // --- 7 OUTGOING (Total = 2,085,090 PKR) ---
    {
      id: 'TX-OUT-001',
      date: '16 Sep 2026',
      rawDate: '2026-09-16',
      time: '05:09 PM',
      timestamp: new Date('2026-09-16T17:09:00').getTime(),
      amount: 2000000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Outgoing',
      category: '',
      reason: 'Expense: ELECTRICITY BILL',
      note: '',
      document: undefined // No Receipt
    },
    {
      id: 'TX-OUT-002',
      date: '14 Sep 2026',
      rawDate: '2026-09-14',
      time: '02:40 PM',
      timestamp: new Date('2026-09-14T14:40:00').getTime(),
      amount: 35000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Outgoing',
      category: 'Maintenance',
      reason: 'Expense: Plumbing & Washroom Maintenance',
      note: 'Urgent plumbing repair on 2nd floor',
      document: { name: 'Plumbing_Invoice_0914.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-OUT-003',
      date: '10 Sep 2026',
      rawDate: '2026-09-10',
      time: '03:10 PM',
      timestamp: new Date('2026-09-10T15:10:00').getTime(),
      amount: 20000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Outgoing',
      category: 'Supplies',
      reason: 'Expense: Exam Stationery & Answer Sheets',
      note: 'Mid-term printing materials',
      document: { name: 'Stationery_Receipt_10.pdf', type: 'Receipt' }
    },
    {
      id: 'TX-OUT-004',
      date: '08 Sep 2026',
      rawDate: '2026-09-08',
      time: '11:20 AM',
      timestamp: new Date('2026-09-08T11:20:00').getTime(),
      amount: 15090,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Outgoing',
      category: 'Refreshments',
      reason: 'Expense: Staff Refreshments & Water Supply',
      note: 'Monthly drinking water cans & guest refreshments',
      document: undefined // No Receipt
    },
    {
      id: 'TX-OUT-005',
      date: '05 Sep 2026',
      rawDate: '2026-09-05',
      time: '01:30 PM',
      timestamp: new Date('2026-09-05T13:30:00').getTime(),
      amount: 6000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Outgoing',
      category: 'Maintenance',
      reason: 'Expense: Air Conditioner Filter Cleaning',
      note: 'Server room & Admin AC service',
      document: { name: 'AC_Service_Receipt.pdf', type: 'Receipt' }
    },
    {
      id: 'TX-OUT-006',
      date: '04 Sep 2026',
      rawDate: '2026-09-04',
      time: '04:15 PM',
      timestamp: new Date('2026-09-04T16:15:00').getTime(),
      amount: 5000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Outgoing',
      category: 'Supplies',
      reason: 'Expense: First Aid & Medical Kit Refill',
      note: 'School clinic basic medical supplies',
      document: { name: 'Pharmacy_Invoice_04.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-OUT-007',
      date: '01 Sep 2026',
      rawDate: '2026-09-01',
      time: '10:00 AM',
      timestamp: new Date('2026-09-01T10:00:00').getTime(),
      amount: 4000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Outgoing',
      category: 'Utilities',
      reason: 'Expense: High-speed Fiber Internet Bill',
      note: 'Monthly campus broadband connection',
      document: { name: 'Internet_Bill_Sep.pdf', type: 'Invoice' }
    },

    // --- KEY INCOMING ENTRIES ---
    {
      id: 'TX-IN-001',
      date: '16 Sep 2026',
      rawDate: '2026-09-16',
      time: '05:01 PM',
      timestamp: new Date('2026-09-16T17:01:00').getTime(),
      amount: 96000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Payments (F0104, S0096)',
      note: 'Full term fee collected',
      document: { name: 'Fee_Receipt_F0104.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-002',
      date: '16 Sep 2026',
      rawDate: '2026-09-16',
      time: '04:03 PM',
      timestamp: new Date('2026-09-16T16:03:00').getTime(),
      amount: 12388,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Payment (F-0094, S-00119)',
      note: '',
      document: { name: 'Fee_Receipt_F0094.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-003',
      date: '16 Sep 2026',
      rawDate: '2026-09-16',
      time: '01:14 AM',
      timestamp: new Date('2026-09-16T01:14:00').getTime(),
      amount: 0,
      createdBy: 'Demo school',
      paymentType: 'Online',
      type: 'Incoming',
      category: 'Security',
      reason: 'Security Fee (F-0009, S0105)',
      note: 'Waived under concession scheme',
      document: { name: 'Concession_Form_S0105.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-004',
      date: '16 Sep 2026',
      rawDate: '2026-09-16',
      time: '01:14 AM',
      timestamp: new Date('2026-09-16T01:14:00').getTime(),
      amount: 0,
      createdBy: 'Demo school',
      paymentType: 'Online',
      type: 'Incoming',
      category: 'Fund',
      reason: 'Student Fund (F-0009, S0105)',
      note: 'Exempted for sibling scheme',
      document: { name: 'Exemption_Doc_S0105.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-005',
      date: '16 Sep 2026',
      rawDate: '2026-09-16',
      time: '01:14 AM',
      timestamp: new Date('2026-09-16T01:14:00').getTime(),
      amount: 32323,
      createdBy: 'Demo school',
      paymentType: 'Online',
      type: 'Incoming',
      category: 'Admission Fee',
      reason: 'Admission Fee (F-0009, S0105)',
      note: 'Paid via portal online gateway',
      document: { name: 'Admission_Challan_S0105.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-006',
      date: '15 Sep 2026',
      rawDate: '2026-09-15',
      time: '02:30 PM',
      timestamp: new Date('2026-09-15T14:30:00').getTime(),
      amount: 1600000,
      createdBy: 'Demo school',
      paymentType: 'Online',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Collections Batch Sep (Bank Link Transfer)',
      note: 'Centralised fee portal synchronization',
      document: { name: 'Batch_Settlement_Sep15.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-007',
      date: '15 Sep 2026',
      rawDate: '2026-09-15',
      time: '11:15 AM',
      timestamp: new Date('2026-09-15T11:15:00').getTime(),
      amount: 49100,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Payments (F0075, S-00128)',
      note: 'Family installment cleared in cash',
      document: { name: 'Receipt_F0075.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-008',
      date: '14 Sep 2026',
      rawDate: '2026-09-14',
      time: '10:45 AM',
      timestamp: new Date('2026-09-14T10:45:00').getTime(),
      amount: 45000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Payments (F0018, S-00034)',
      note: '',
      document: { name: 'Receipt_F0018.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-009',
      date: '12 Sep 2026',
      rawDate: '2026-09-12',
      time: '03:10 PM',
      timestamp: new Date('2026-09-12T15:10:00').getTime(),
      amount: 55000,
      createdBy: 'Demo school',
      paymentType: 'Bank Transfer',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Payments (F0022, S-00055)',
      note: 'Direct deposit Meezan Bank',
      document: { name: 'Bank_Receipt_F0022.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-010',
      date: '10 Sep 2026',
      rawDate: '2026-09-10',
      time: '01:25 PM',
      timestamp: new Date('2026-09-10T13:25:00').getTime(),
      amount: 110000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Collections Batch Sep 10 Counter',
      note: '',
      document: { name: 'Batch_Counter_10.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-011',
      date: '08 Sep 2026',
      rawDate: '2026-09-08',
      time: '09:40 AM',
      timestamp: new Date('2026-09-08T09:40:00').getTime(),
      amount: 78000,
      createdBy: 'Demo school',
      paymentType: 'Online',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Payments (F0041, S-00078)',
      note: 'Online 1Link transfer',
      document: { name: 'Receipt_F0041.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-012',
      date: '07 Sep 2026',
      rawDate: '2026-09-07',
      time: '04:15 PM',
      timestamp: new Date('2026-09-07T16:15:00').getTime(),
      amount: 180000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Collections Batch Sep 07 Desk',
      note: 'Evening counter collection',
      document: { name: 'Receipt_Sep07.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-013',
      date: '05 Sep 2026',
      rawDate: '2026-09-05',
      time: '11:00 AM',
      timestamp: new Date('2026-09-05T11:00:00').getTime(),
      amount: 85000,
      createdBy: 'Demo school',
      paymentType: 'Online',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Payments (F0055, S-00089)',
      note: '',
      document: { name: 'Receipt_F0055.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-014',
      date: '04 Sep 2026',
      rawDate: '2026-09-04',
      time: '02:00 PM',
      timestamp: new Date('2026-09-04T14:00:00').getTime(),
      amount: 110000,
      createdBy: 'Demo school',
      paymentType: 'Cash',
      type: 'Incoming',
      category: 'Monthly Fee',
      reason: 'Fee Collections Batch Sep 04',
      note: '',
      document: { name: 'Receipt_Sep04.pdf', type: 'Invoice' }
    },
    {
      id: 'TX-IN-015',
      date: '01 Sep 2026',
      rawDate: '2026-09-01',
      time: '09:00 AM',
      timestamp: new Date('2026-09-01T09:00:00').getTime(),
      amount: 100000,
      createdBy: 'Demo school',
      paymentType: 'Bank Transfer',
      type: 'Incoming',
      category: 'Admission Fee',
      reason: 'New Admissions Opening Balance Deposit',
      note: 'Fall Session registration intake',
      document: { name: 'Opening_Deposit_Sep01.pdf', type: 'Invoice' }
    }
  ];

  // Already 15 incoming totaling:
  // 96000 + 12388 + 0 + 0 + 32323 + 1600000 + 49100 + 45000 + 55000 + 110000 + 78000 + 180000 + 85000 + 110000 + 100000 = 2,552,811 PKR.
  // Target Total Income = 2,829,698 PKR.
  // Remaining to allocate over the remaining 56 incoming records = 2,829,698 - 2,552,811 = 276,887 PKR.
  // 276,887 / 56 ≈ 4,944 PKR average.
  
  const categoriesList = ['Monthly Fee', 'Admission Fee', 'Fund', 'Security', 'Exam Fee'];
  const paymentMethods: Array<LedgerTransaction['paymentType']> = ['Cash', 'Online', 'Bank Transfer', 'JazzCash', 'EasyPaisa'];
  const datesList = ['01 Sep', '04 Sep', '05 Sep', '07 Sep', '08 Sep', '10 Sep', '12 Sep', '14 Sep', '15 Sep', '16 Sep'];
  const rawDatesList = ['2026-09-01', '2026-09-04', '2026-09-05', '2026-09-07', '2026-09-08', '2026-09-10', '2026-09-12', '2026-09-14', '2026-09-15', '2026-09-16'];

  let remainingBudget = 276887;
  const neededCount = 71 - 15; // 56 items

  for (let i = 0; i < neededCount; i++) {
    const isLast = i === neededCount - 1;
    let itemAmt = 0;
    if (isLast) {
      itemAmt = remainingBudget;
    } else {
      itemAmt = Math.floor(remainingBudget / (neededCount - i)) + (i % 3 === 0 ? 500 : -250);
      if (itemAmt < 0) itemAmt = 2000;
      remainingBudget -= itemAmt;
    }

    const dateIdx = i % datesList.length;
    const dateStr = datesList[dateIdx] + ' 2026';
    const rawDateStr = rawDatesList[dateIdx];
    const cat = categoriesList[i % categoriesList.length];
    const pType = paymentMethods[i % paymentMethods.length];
    const hour = 9 + (i % 8);
    const minute = (i * 7) % 60;
    const timeStr = `${hour < 10 ? '0' : ''}${hour > 12 ? hour - 12 : hour}:${minute < 10 ? '0' : ''}${minute} ${hour >= 12 ? 'PM' : 'AM'}`;

    transactions.push({
      id: `TX-IN-${100 + i}`,
      date: dateStr,
      rawDate: rawDateStr,
      time: timeStr,
      timestamp: new Date(`${rawDateStr}T${hour < 10 ? '0' : ''}${hour}:${minute < 10 ? '0' : ''}${minute}:00`).getTime(),
      amount: itemAmt,
      createdBy: 'Demo school',
      paymentType: pType,
      type: 'Incoming',
      category: cat,
      reason: `Fee Payment (F-${(1000 + i).toString().slice(-4)}, S-${(2000 + i).toString().slice(-4)})`,
      note: i % 4 === 0 ? 'Verified and deposited' : '',
      document: i % 5 !== 0 ? { name: `Receipt_${100 + i}.pdf`, type: 'Invoice' } : undefined
    });
  }

  // Sort descending by timestamp
  return transactions.sort((a, b) => b.timestamp - a.timestamp);
}

// Read from localStorage or initialize empty (initial seed temporarily disabled)
export function getLedgerTransactions(): LedgerTransaction[] {
  return loadJSON<LedgerTransaction[]>(
    LEDGER_TX_KEY,
    [],
    Array.isArray as (v: unknown) => v is LedgerTransaction[]
  );
}

// Save all to localStorage
export function saveLedgerTransactions(items: LedgerTransaction[]): void {
  mustSave(LEDGER_TX_KEY, items);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledgerTransactionsUpdated', { detail: items }));
  }
}

// Add a single transaction
export function addLedgerTransaction(transaction: Omit<LedgerTransaction, 'id' | 'timestamp'>): LedgerTransaction {
  const all = getLedgerTransactions();
  const id = `TX-${transaction.type === 'Incoming' ? 'IN' : 'OUT'}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
  const timestamp = new Date(`${transaction.rawDate}T12:00:00`).getTime() || Date.now();
  
  const newItem: LedgerTransaction = {
    ...transaction,
    id,
    timestamp
  };

  const updated = [newItem, ...all];
  saveLedgerTransactions(updated);
  return newItem;
}

// Delete a single transaction by ID
export function deleteLedgerTransaction(id: string): LedgerTransaction[] {
  const all = getLedgerTransactions();
  const updated = all.filter(t => t.id !== id);
  saveLedgerTransactions(updated);
  return updated;
}

// Reset ledger to initial calibrated demo state
export function resetLedgerTransactions(): LedgerTransaction[] {
  const initial = getInitialLedgerTransactions();
  saveLedgerTransactions(initial);
  return initial;
}

// =========================================================================
// SHARED LEDGER GRAPH STATE & COMPUTATION (SYNCED BETWEEN LEDGER & OVERVIEW)
// =========================================================================
export type LedgerGraphMode = 'income' | 'expenses';
export type LedgerDateRangeOption = 'current_month' | 'last_month' | 'last_year' | 'five_years' | 'all_time';

export interface LedgerGraphSettings {
  graphMode: LedgerGraphMode;
  dateRange: LedgerDateRangeOption;
}

const LEDGER_GRAPH_SETTINGS_KEY = 'schoollee_ledger_graph_settings_v1';

export const LEDGER_DATE_RANGE_LABELS: Record<LedgerDateRangeOption, string> = {
  current_month: 'This Month',
  last_month: 'Last Month',
  // Fix P0-4: no fixed year in the label — "last year" is computed from the
  // current date wherever a dated label is needed (see LedgerModule).
  last_year: 'Last Year',
  five_years: 'Past 5 Years',
  all_time: 'All Time'
};

export function getLedgerGraphSettings(): LedgerGraphSettings {
  const parsed = loadJSON<Partial<LedgerGraphSettings>>(
    LEDGER_GRAPH_SETTINGS_KEY,
    { graphMode: 'income', dateRange: 'current_month' },
    (v): v is Partial<LedgerGraphSettings> => typeof v === 'object' && v !== null && !Array.isArray(v)
  );
  if (parsed && (parsed.graphMode === 'income' || parsed.graphMode === 'expenses')) {
    return {
      graphMode: parsed.graphMode,
      dateRange: parsed.dateRange || 'current_month'
    };
  }
  return {
    graphMode: 'income',
    dateRange: 'current_month'
  };
}

export function saveLedgerGraphSettings(partial: Partial<LedgerGraphSettings>): LedgerGraphSettings {
  const current = getLedgerGraphSettings();
  const updated: LedgerGraphSettings = {
    ...current,
    ...partial
  };
  if (saveJSON(LEDGER_GRAPH_SETTINGS_KEY, updated)) {
    window.dispatchEvent(new CustomEvent('ledgerGraphSettingsUpdated', { detail: updated }));
  }
  return updated;
}

export interface LedgerTimelinePoint {
  date: string;
  rawDate: string;
  income: number;
  expense: number;
  activeVal: number;
}

export function formatLedgerYAxisLabel(val: number): string {
  if (val === 0) return '0';
  if (val >= 1000000) {
    const m = val / 1000000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (val >= 1000) {
    const k = val / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(0)}k`;
  }
  return val.toString();
}

export function computeLedgerGraphData(
  transactions: LedgerTransaction[],
  dateRange: LedgerDateRangeOption,
  graphMode: LedgerGraphMode
): {
  rangeTransactions: LedgerTransaction[];
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  graphTimelineData: LedgerTimelinePoint[];
  dynamicMaxY: number;
  yAxisLevels: number[];
} {
  const now = new Date();
  const todayMonth = now.toISOString().slice(0, 7); // e.g. '2026-10'
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const rangeTransactions = transactions.filter(t => {
    const raw = t.rawDate || '';
    if (dateRange === 'all_time') return true;
    if (dateRange === 'current_month') {
      // Current calendar month only (Fix P0-4: previously this also matched
      // fixed '2026-09' records and the latest transaction month, silently
      // presenting other months' data as this month's).
      return raw.startsWith(todayMonth);
    }
    if (dateRange === 'last_month') {
      return raw.startsWith(prevMonthPrefix);
    }
    if (dateRange === 'last_year') {
      return raw.startsWith(String(now.getFullYear() - 1));
    }
    if (dateRange === 'five_years') {
      const year = parseInt(raw.slice(0, 4), 10);
      return year >= now.getFullYear() - 4 && year <= now.getFullYear();
    }
    return true;
  });

  const totalIncome = rangeTransactions
    .filter(t => t.type === 'Incoming')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = rangeTransactions
    .filter(t => t.type === 'Outgoing')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = totalIncome - totalExpense;

  const dateMap = new Map<string, { rawDate: string; label: string; income: number; expense: number }>();

  const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatRawDateLabel = (rawStr: string, fallbackDate?: string) => {
    if (fallbackDate) {
      const parts = fallbackDate.trim().split(' ');
      if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    }
    const parts = rawStr.split('-');
    if (parts.length === 3) {
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${parts[2]} ${monthShortNames[mIdx]}`;
      }
    }
    return rawStr;
  };

  rangeTransactions.forEach(t => {
    const raw = t.rawDate || todayMonth + '-01';
    const label = formatRawDateLabel(raw, t.date);

    if (!dateMap.has(raw)) {
      dateMap.set(raw, { rawDate: raw, label, income: 0, expense: 0 });
    }

    const entry = dateMap.get(raw)!;
    if (t.type === 'Incoming') {
      entry.income += t.amount;
    } else if (t.type === 'Outgoing') {
      entry.expense += t.amount;
    }
  });

  // If no transactions exist in range, show a clean 0-value baseline spread
  // across the CURRENT month (Fix P0-4: these anchors were fixed Sep-2026
  // dates, so an empty ledger graph was labelled with a past month's dates).
  if (dateMap.size === 0) {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    [1, 5, 10, 15, 20, 25, daysInMonth].forEach(day => {
      const raw = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(day)}`;
      dateMap.set(raw, { rawDate: raw, label: formatRawDateLabel(raw), income: 0, expense: 0 });
    });
  } else if (dateMap.size === 1) {
    // If only a single date has transactions, add a month-start 0 anchor so the graph renders a clear curve
    const onlyEntry = Array.from(dateMap.values())[0];
    const prefix = onlyEntry.rawDate.slice(0, 7);
    const startRaw = `${prefix}-01`;
    if (onlyEntry.rawDate !== startRaw) {
      dateMap.set(startRaw, {
        rawDate: startRaw,
        label: formatRawDateLabel(startRaw),
        income: 0,
        expense: 0
      });
    } else {
      const nextRaw = `${prefix}-02`;
      dateMap.set(nextRaw, {
        rawDate: nextRaw,
        label: formatRawDateLabel(nextRaw),
        income: onlyEntry.income,
        expense: onlyEntry.expense
      });
    }
  }

  const sorted = Array.from(dateMap.values()).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

  const graphTimelineData: LedgerTimelinePoint[] = sorted.map(d => ({
    date: d.label,
    rawDate: d.rawDate,
    income: d.income,
    expense: d.expense,
    activeVal: graphMode === 'income' ? d.income : d.expense
  }));

  const vals = graphTimelineData.map(d => d.activeVal);
  const maxVal = vals.length > 0 ? Math.max(...vals, 0) : 0;

  let niceMax = 100000;
  if (maxVal > 0) {
    const target = maxVal * 1.15;
    const exponent = Math.floor(Math.log10(target));
    const magnitude = Math.pow(10, exponent);
    const normalized = target / magnitude;
    let factor: number;
    if (normalized <= 1) factor = 1;
    else if (normalized <= 2) factor = 2;
    else if (normalized <= 2.5) factor = 2.5;
    else if (normalized <= 5) factor = 5;
    else factor = 10;
    niceMax = Math.max(1000, Math.round(factor * magnitude));
  }

  const yAxisLevels = [
    niceMax,
    Math.round(niceMax * 0.75),
    Math.round(niceMax * 0.5),
    Math.round(niceMax * 0.25),
    0
  ];

  return {
    rangeTransactions,
    totalIncome,
    totalExpense,
    totalBalance,
    graphTimelineData,
    dynamicMaxY: niceMax,
    yAxisLevels
  };
}

