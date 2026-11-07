import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Info, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Download,
  Filter,
  ReceiptText
} from 'lucide-react';
import { 
  LedgerTransaction, 
  getLedgerTransactions, 
  saveLedgerTransactions, 
  addLedgerTransaction,
  formatPKR,
  formatLac,
  LedgerDateRangeOption,
  LedgerGraphMode,
  getLedgerGraphSettings,
  saveLedgerGraphSettings,
  computeLedgerGraphData,
  formatLedgerYAxisLabel
} from '../utils/ledgerStore';
import { RecordTransactionModal } from './RecordTransactionModal';
import { LedgerDocumentModal } from './LedgerDocumentModal';
import { BreadcrumbTrail } from './BreadcrumbTrail';

type PipelineType = 'All' | 'Incoming' | 'Outgoing' | 'System';
type DateRangeOption = LedgerDateRangeOption;

interface LedgerModuleProps {
  onBackToOverview?: () => void;
  onBreadcrumbOverview?: () => void;
  onShowToast?: (msg: string) => void;
}

export const LedgerModule: React.FC<LedgerModuleProps> = ({
  onBackToOverview,
  onBreadcrumbOverview,
  onShowToast
}) => {
  // Master transactions state
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(() => getLedgerTransactions());

  // Listen to external updates
  useEffect(() => {
    const handleUpdate = () => {
      setTransactions(getLedgerTransactions());
    };
    const handleGraphSettingsUpdate = () => {
      const settings = getLedgerGraphSettings();
      setGraphModeState(settings.graphMode);
      setDateRangeState(settings.dateRange);
    };
    window.addEventListener('ledgerTransactionsUpdated', handleUpdate);
    window.addEventListener('ledgerGraphSettingsUpdated', handleGraphSettingsUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('ledgerTransactionsUpdated', handleUpdate);
      window.removeEventListener('ledgerGraphSettingsUpdated', handleGraphSettingsUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // 1st Container Graph Mode: 'income' | 'expenses' (synced with Overview)
  const [graphMode, setGraphModeState] = useState<LedgerGraphMode>(() => getLedgerGraphSettings().graphMode);
  const setGraphMode = (mode: LedgerGraphMode) => {
    setGraphModeState(mode);
    saveLedgerGraphSettings({ graphMode: mode });
  };
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; date: string; amount: number } | null>(null);

  // 2nd Container Date Range Dropdown (synced with Overview)
  const [dateRange, setDateRangeState] = useState<DateRangeOption>(() => getLedgerGraphSettings().dateRange);
  const setDateRange = (range: DateRangeOption) => {
    setDateRangeState(range);
    saveLedgerGraphSettings({ dateRange: range });
  };
  const [isDateRangeOpen, setIsDateRangeOpen] = useState<boolean>(false);
  const dateRangeRef = useRef<HTMLDivElement>(null);

  // 2nd Container Radial Chart Hover State: 'profit' | 'expense' | 'income' | null
  // By default, center displays Profit. When cursor hovers over a strip, it updates accordingly!
  const [hoveredStrip, setHoveredStrip] = useState<'profit' | 'expense' | 'income' | null>(null);

  // 3rd Container Pipeline & Filters
  const [pipeline, setPipeline] = useState<PipelineType>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('all');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [recordModalInitialType, setRecordModalInitialType] = useState<'Incoming' | 'Outgoing'>('Incoming');
  const [selectedDocTransaction, setSelectedDocTransaction] = useState<LedgerTransaction | null>(null);

  // Pagination for table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 12;

  // Close date range dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateRangeRef.current && !dateRangeRef.current.contains(event.target as Node)) {
        setIsDateRangeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unified real-time Ledger calculations & timeline data (shared with Overview)
  const {
    rangeTransactions,
    totalIncome,
    totalExpense,
    totalBalance,
    graphTimelineData,
    dynamicMaxY,
    yAxisLevels
  } = useMemo(() => {
    return computeLedgerGraphData(transactions, dateRange, graphMode);
  }, [transactions, dateRange, graphMode]);

  const formatYAxisLabel = formatLedgerYAxisLabel;

  // Counts for pipeline tabs
  const pipelineCounts = useMemo(() => {
    const all = transactions.length;
    const incoming = transactions.filter(t => t.type === 'Incoming').length;
    const outgoing = transactions.filter(t => t.type === 'Outgoing').length;
    const system = transactions.filter(t => t.type === 'System').length;
    return { all, incoming, outgoing, system };
  }, [transactions]);

  // Unique lists for filters
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.createdBy) set.add(t.createdBy); });
    return Array.from(set);
  }, [transactions]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set);
  }, [transactions]);

  // Filtered transactions for Table
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Pipeline filter
      if (pipeline !== 'All' && t.type !== pipeline) {
        return false;
      }

      // User filter
      if (selectedUser !== 'all' && t.createdBy !== selectedUser) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }

      // Payment Type filter
      if (selectedPaymentType !== 'all' && t.paymentType !== selectedPaymentType) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchReason = t.reason.toLowerCase().includes(q);
        const matchCat = (t.category || '').toLowerCase().includes(q);
        const matchUser = t.createdBy.toLowerCase().includes(q);
        const matchNote = (t.note || '').toLowerCase().includes(q);
        const matchAmt = t.amount.toString().includes(q);
        const matchDate = t.date.toLowerCase().includes(q);
        const matchPay = t.paymentType.toLowerCase().includes(q);
        if (!matchReason && !matchCat && !matchUser && !matchNote && !matchAmt && !matchDate && !matchPay) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, pipeline, selectedUser, selectedCategory, selectedPaymentType, searchQuery]);

  // Paginated transactions
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const displayedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  // Add new transaction handler
  const handleCreateTransaction = (data: Omit<LedgerTransaction, 'id' | 'timestamp'>) => {
    const created = addLedgerTransaction(data);
    setTransactions(getLedgerTransactions());
    onShowToast?.(`Successfully recorded ${data.type.toLowerCase()}: ${formatPKR(data.amount)}`);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Time', 'Amount', 'Created By', 'Payment Type', 'Type', 'Category', 'Reason', 'Note', 'Document'];
    const rows = filteredTransactions.map(t => [
      `"${t.date}"`,
      `"${t.time}"`,
      `"${t.amount}"`,
      `"${t.createdBy}"`,
      `"${t.paymentType}"`,
      `"${t.type}"`,
      `"${t.category || '-'}"`,
      `"${t.reason.replace(/"/g, '""')}"`,
      `"${(t.note || '-').replace(/"/g, '""')}"`,
      `"${t.document ? t.document.name : 'No Receipt'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `School_Ledger_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast?.('Exported ledger data to CSV');
  };

  // Center display data for 2nd Container radial chart
  const activeRadialData = useMemo(() => {
    const current = hoveredStrip || 'profit';
    if (current === 'profit') {
      return {
        label: 'Profit',
        amount: totalBalance,
        color: '#10b981',
        lacStr: formatLac(totalBalance)
      };
    }
    if (current === 'expense') {
      return {
        label: 'Expense',
        amount: totalExpense,
        color: '#f97316',
        lacStr: formatLac(totalExpense)
      };
    }
    return {
      label: 'Income',
      amount: totalIncome,
      color: '#eab308',
      lacStr: formatLac(totalIncome)
    };
  }, [hoveredStrip, totalBalance, totalExpense, totalIncome]);

  // Helper date range labels — computed from the selected range and today's
  // date (Fix P0-4: previously fixed Sep-2026 strings were shown no matter
  // what the real range or date was). These now describe exactly the ranges
  // computeLedgerGraphData filters by.
  const labelNow = new Date();
  const fmtFullDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtMonthYear = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const firstOfThisMonth = new Date(labelNow.getFullYear(), labelNow.getMonth(), 1);
  const firstOfLastMonth = new Date(labelNow.getFullYear(), labelNow.getMonth() - 1, 1);
  const dateRangeLabels: Record<DateRangeOption, string> = {
    current_month: `${fmtFullDate(firstOfThisMonth)} – ${fmtFullDate(labelNow)}`,
    last_month: `Last Month (${fmtMonthYear(firstOfLastMonth)})`,
    last_year: `Last Year (${labelNow.getFullYear() - 1})`,
    five_years: `Past 5 Years (${labelNow.getFullYear() - 4} – ${labelNow.getFullYear()})`,
    all_time: 'All Time'
  };

  return (
    <div className="w-full space-y-5 text-slate-100 animate-in fade-in duration-200" id="ledger-module-root">
      {/* Top Header Bar with Breadcrumb and Export button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Ledger</span>
              <span 
                className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-600 text-[10px] text-slate-400 cursor-help"
                title="Consolidated institutional financial ledger tracking income, expenses, and net profit."
              >
                <Info className="w-2.5 h-2.5" />
              </span>
            </h1>
          </div>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Fees', onClick: onBackToOverview },
              { label: 'Ledger' }
            ]}
          />
        </div>

        {/* Export Button matching image top right */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 rounded-xl bg-[#121c2b] hover:bg-[#1a283e] border border-[#20324d] text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            id="btn-export-ledger"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* TOP ROW: 1ST CONTAINER & 2ND CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ========================================================= */}
        {/* 1ST CONTAINER: TOTAL BALANCE, RECORD BUTTONS & AREA GRAPH */}
        {/* ========================================================= */}
        <div 
          className="lg:col-span-7 bg-surface-13 border border-edge-16 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
          id="container-1-total-balance"
        >
          {/* Top Section */}
          <div>
            {/* Header with Title and Record Buttons */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <span>Total balance</span>
                <span 
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-600 text-[9px] text-slate-400 cursor-help"
                  title="Net liquid balance = Total Collected Income minus Recorded Expenses"
                >
                  <Info className="w-2 h-2" />
                </span>
              </div>

              {/* Merged Record Income/Expense Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecordModalInitialType(graphMode === 'expenses' ? 'Outgoing' : 'Incoming');
                    setIsRecordModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition-all cursor-pointer active:scale-95"
                  id="btn-record-income-expense"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Record Income/Expense</span>
                </button>
              </div>
            </div>

            {/* Big Total Balance Number */}
            <div className="mt-2">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
                {formatPKR(totalBalance)}
              </h2>
            </div>

            {/* Two Main Switchable Cards: Income & Expenses */}
            <div className="grid grid-cols-2 gap-3.5 mt-5">
              {/* Income Button / Card */}
              <button
                type="button"
                onClick={() => setGraphMode('income')}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  graphMode === 'income'
                    ? 'bg-[#142236] border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg shadow-blue-900/20'
                    : 'bg-surface-20 border-[#1d2a3e] hover:bg-[#162234] hover:border-slate-700'
                }`}
                id="btn-switch-graph-income"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="truncate">
                  <div className="text-[11px] text-slate-400 font-medium">Income</div>
                  <div className="text-sm sm:text-base font-black text-white font-mono truncate">
                    {formatPKR(totalIncome)}
                  </div>
                </div>
              </button>

              {/* Expenses Button / Card */}
              <button
                type="button"
                onClick={() => setGraphMode('expenses')}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  graphMode === 'expenses'
                    ? 'bg-[#291b1b] border-amber-500/60 ring-1 ring-amber-500/40 shadow-lg shadow-amber-950/20'
                    : 'bg-surface-20 border-[#1d2a3e] hover:bg-[#162234] hover:border-slate-700'
                }`}
                id="btn-switch-graph-expenses"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="truncate">
                  <div className="text-[11px] text-slate-400 font-medium">Expenses</div>
                  <div className="text-sm sm:text-base font-black text-white font-mono truncate">
                    {formatPKR(totalExpense)}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Interactive Graph Display based on selection */}
          <div className="mt-6 pt-2">
            <div className="relative h-48 w-full select-none" id="chart-income-expense-timeline">
              {/* SVG Area & Smooth Line Chart */}
              <svg 
                className="w-full h-full overflow-visible" 
                viewBox="0 0 600 160" 
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Cyan / Blue Gradient for Income */}
                  <linearGradient id="incomeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Amber / Orange Gradient for Expense */}
                  <linearGradient id="expenseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid lines & dynamic Y labels */}
                {yAxisLevels.map((val, idx) => {
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
                        strokeDasharray={idx === 4 ? "none" : "3,3"} 
                      />
                      <text 
                        x="4" 
                        y={y + 3} 
                        fill="#64748b" 
                        fontSize="9" 
                        fontFamily="monospace"
                      >
                        {formatYAxisLabel(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Calculate SVG path points dynamically */}
                {(() => {
                  if (graphTimelineData.length === 0) return null;

                  const maxVal = dynamicMaxY || 100000;
                  const leftPad = 52;
                  const rightPad = 590;
                  const topPad = 15;
                  const bottomPad = 150;
                  const widthSpan = rightPad - leftPad;
                  const heightSpan = bottomPad - topPad;

                  const points = graphTimelineData.map((d, index) => {
                    const x = graphTimelineData.length === 1
                      ? leftPad + widthSpan / 2
                      : leftPad + (index / (graphTimelineData.length - 1)) * widthSpan;
                    const normalized = maxVal > 0 ? Math.min(d.activeVal / maxVal, 1) : 0;
                    const y = bottomPad - (normalized * heightSpan);
                    return { x, y, ...d };
                  });

                  // Build smooth bezier path string
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

                  const lineColor = graphMode === 'income' ? '#06b6d4' : '#f97316';
                  const areaFill = graphMode === 'income' ? 'url(#incomeAreaGrad)' : 'url(#expenseAreaGrad)';

                  return (
                    <g>
                      {/* Area fill */}
                      <path d={areaD} fill={areaFill} />

                      {/* Smooth line */}
                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke={lineColor} 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        className="transition-all duration-300"
                      />

                      {/* Interactive Data Point Dots */}
                      {points.map((p, idx) => (
                        <g 
                          key={idx}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ x: p.x, y: p.y, date: p.date, amount: p.activeVal })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          <circle 
                            cx={p.x} 
                            cy={p.y} 
                            r={hoveredPoint?.date === p.date ? 5.5 : 3.5} 
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
              {hoveredPoint && (
                <div 
                  className="absolute pointer-events-none px-2.5 py-1.5 rounded-lg bg-[#0b121e] border border-[#24354f] text-[11px] shadow-2xl z-30 transform -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in zoom-in-95"
                  style={{
                    left: `${(hoveredPoint.x / 600) * 100}%`,
                    top: `${(hoveredPoint.y / 160) * 100}%`
                  }}
                >
                  <div className="text-slate-400 font-medium">{hoveredPoint.date}</div>
                  <div className="font-mono font-bold text-white">
                    {formatPKR(hoveredPoint.amount)}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic X-axis Date Labels */}
            <div className="flex justify-between pl-11 pr-2 pt-2 text-[10px] text-slate-500 font-mono">
              {(() => {
                const total = graphTimelineData.length;
                if (total <= 8) {
                  return graphTimelineData.map(d => (
                    <span key={d.date} className="hover:text-slate-300 transition-colors whitespace-nowrap">
                      {d.date}
                    </span>
                  ));
                }
                const step = (total - 1) / 6;
                const indices = [0, 1, 2, 3, 4, 5, 6].map(i => Math.round(i * step));
                const uniqueIndices = Array.from(new Set(indices));
                return uniqueIndices.map(idx => (
                  <span key={graphTimelineData[idx].date} className="hover:text-slate-300 transition-colors whitespace-nowrap">
                    {graphTimelineData[idx].date}
                  </span>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2ND CONTAINER: TOTAL PROFIT RADIAL CHART WITH STRIP HOVER */}
        {/* ========================================================= */}
        <div 
          className="lg:col-span-5 bg-surface-13 border border-edge-16 rounded-2xl p-5 shadow-xl flex flex-col justify-between relative"
          id="container-2-total-profit"
        >
          {/* Header Row: Total Profit Title & Date Range Dropdown */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Total Profit
            </h3>

            {/* Date Range Selector Dropdown */}
            <div className="relative" ref={dateRangeRef}>
              <button
                type="button"
                onClick={() => setIsDateRangeOpen(!isDateRangeOpen)}
                className="px-3 py-1.5 rounded-xl bg-surface-35 hover:bg-[#1d2c45] border border-[#23344d] text-xs text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                id="btn-date-range-dropdown"
              >
                <span>{dateRangeLabels[dateRange]}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isDateRangeOpen && (
                <div 
                  className="absolute right-0 mt-1.5 w-56 bg-[#0e1625] border border-[#20324d] rounded-xl shadow-2xl py-1.5 z-40 text-xs animate-in fade-in zoom-in-95"
                  id="dropdown-menu-ranges"
                >
                  <button
                    type="button"
                    onClick={() => { setDateRange('current_month'); setIsDateRangeOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-[#182538] transition-colors cursor-pointer ${
                      dateRange === 'current_month' ? 'text-blue-400 font-bold bg-surface-33' : 'text-slate-300'
                    }`}
                  >
                    {dateRangeLabels.current_month} (This Month)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateRange('last_month'); setIsDateRangeOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-[#182538] transition-colors cursor-pointer ${
                      dateRange === 'last_month' ? 'text-blue-400 font-bold bg-surface-33' : 'text-slate-300'
                    }`}
                  >
                    Last Month
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateRange('last_year'); setIsDateRangeOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-[#182538] transition-colors cursor-pointer ${
                      dateRange === 'last_year' ? 'text-blue-400 font-bold bg-surface-33' : 'text-slate-300'
                    }`}
                  >
                    Last Year
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateRange('five_years'); setIsDateRangeOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-[#182538] transition-colors cursor-pointer ${
                      dateRange === 'five_years' ? 'text-blue-400 font-bold bg-surface-33' : 'text-slate-300'
                    }`}
                  >
                    5 Years
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateRange('all_time'); setIsDateRangeOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-[#182538] transition-colors cursor-pointer ${
                      dateRange === 'all_time' ? 'text-blue-400 font-bold bg-surface-33' : 'text-slate-300'
                    }`}
                  >
                    All the way from starting time
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Concentric Circular Rings / Radial Donut Chart */}
          <div className="py-4 flex flex-col items-center justify-center relative my-auto">
            <div className="relative w-56 h-56 flex items-center justify-center select-none">
              <svg 
                className="w-full h-full transform -rotate-90 overflow-visible" 
                viewBox="0 0 220 220"
              >
                {(() => {
                  const maxMetric = Math.max(totalIncome, totalExpense, Math.abs(totalBalance), 1);
                  const hasAnyData = totalIncome > 0 || totalExpense > 0;
                  const profitRatio = hasAnyData ? Math.max(0.05, Math.min(1, Math.max(0, totalBalance) / maxMetric)) : 0;
                  const expenseRatio = hasAnyData ? Math.max(0.05, Math.min(1, totalExpense / maxMetric)) : 0;
                  const incomeRatio = hasAnyData ? Math.max(0.05, Math.min(1, totalIncome / maxMetric)) : 0;

                  const profitOffset = 534 - profitRatio * 534;
                  const expenseOffset = 427 - expenseRatio * 427;
                  const incomeOffset = 320 - incomeRatio * 320;

                  return (
                    <>
                      {/* 1. Outer Ring: PROFIT (Green #10b981) */}
                      {/* Radius: 85 -> Circumference: 2 * PI * 85 = 534 */}
                      <circle
                        cx="110"
                        cy="110"
                        r="85"
                        fill="none"
                        stroke="#162536"
                        strokeWidth="11"
                      />
                      {profitRatio > 0 && (
                        <circle
                          cx="110"
                          cy="110"
                          r="85"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth={hoveredStrip === 'profit' ? "14" : "11"}
                          strokeDasharray="534"
                          strokeDashoffset={profitOffset}
                          strokeLinecap="round"
                          className="transition-all duration-300 cursor-pointer"
                          onMouseEnter={() => setHoveredStrip('profit')}
                          onMouseLeave={() => setHoveredStrip(null)}
                        />
                      )}

                      {/* 2. Middle Ring: EXPENSE (Orange #f97316) */}
                      {/* Radius: 68 -> Circumference: 2 * PI * 68 = 427 */}
                      <circle
                        cx="110"
                        cy="110"
                        r="68"
                        fill="none"
                        stroke="#162536"
                        strokeWidth="11"
                      />
                      {expenseRatio > 0 && (
                        <circle
                          cx="110"
                          cy="110"
                          r="68"
                          fill="none"
                          stroke="#f97316"
                          strokeWidth={hoveredStrip === 'expense' ? "14" : "11"}
                          strokeDasharray="427"
                          strokeDashoffset={expenseOffset}
                          strokeLinecap="round"
                          className="transition-all duration-300 cursor-pointer"
                          onMouseEnter={() => setHoveredStrip('expense')}
                          onMouseLeave={() => setHoveredStrip(null)}
                        />
                      )}

                      {/* 3. Inner Ring: INCOME (Yellow #eab308) */}
                      {/* Radius: 51 -> Circumference: 2 * PI * 51 = 320 */}
                      <circle
                        cx="110"
                        cy="110"
                        r="51"
                        fill="none"
                        stroke="#162536"
                        strokeWidth="11"
                      />
                      {incomeRatio > 0 && (
                        <circle
                          cx="110"
                          cy="110"
                          r="51"
                          fill="none"
                          stroke="#eab308"
                          strokeWidth={hoveredStrip === 'income' ? "14" : "11"}
                          strokeDasharray="320"
                          strokeDashoffset={incomeOffset}
                          strokeLinecap="round"
                          className="transition-all duration-300 cursor-pointer"
                          onMouseEnter={() => setHoveredStrip('income')}
                          onMouseLeave={() => setHoveredStrip(null)}
                        />
                      )}
                    </>
                  );
                })()}
              </svg>

              {/* Dynamic Center Display: Default Profit, updates on strip hover */}
              <div 
                className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-[#0a0f1a] border border-[#1b2a40] flex flex-col items-center justify-center text-center p-1 pointer-events-none shadow-inner transition-all"
              >
                <span 
                  className="text-[11px] font-semibold transition-colors duration-150"
                  style={{ color: activeRadialData.color }}
                >
                  {activeRadialData.label}
                </span>
                <span className="text-sm font-black text-white font-mono tracking-tight mt-0.5">
                  {activeRadialData.lacStr}
                </span>
                <span className="text-[9px] text-slate-400 font-mono scale-90">
                  {formatPKR(activeRadialData.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Indicators in the Bottom */}
          <div className="flex items-center justify-center gap-5 pt-3 border-t border-[#182436] text-xs">
            <button
              type="button"
              onMouseEnter={() => setHoveredStrip('profit')}
              onMouseLeave={() => setHoveredStrip(null)}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-success" />
              <span className="font-medium">Profit</span>
            </button>

            <button
              type="button"
              onMouseEnter={() => setHoveredStrip('expense')}
              onMouseLeave={() => setHoveredStrip(null)}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
              <span className="font-medium">Expense</span>
            </button>

            <button
              type="button"
              onMouseEnter={() => setHoveredStrip('income')}
              onMouseLeave={() => setHoveredStrip(null)}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
              <span className="font-medium">Income</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3RD CONTAINER: PIPELINE TABS, FILTERS & ATTRIBUTES TABLE   */}
      {/* ========================================================= */}
      <div 
        className="bg-surface-13 border border-edge-16 rounded-2xl p-5 shadow-xl space-y-4"
        id="container-3-ledger-entries-table"
      >
        {/* Top Controls: Pipeline Tabs & Filter Selectors */}
        <div className="flex flex-col gap-3">
          {/* Pipeline Tabs Row: < All (78)  Incoming (71)  Outgoing (7)  System (0) > */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 text-xs px-1 select-none">&lt;</span>

              {/* All Tab */}
              <button
                type="button"
                onClick={() => { setPipeline('All'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  pipeline === 'All'
                    ? 'bg-edge-11 text-white border border-[#2d405e] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-27'
                }`}
                id="tab-pipeline-all"
              >
                <span>All</span>
                <span className="px-1.5 py-0.2 rounded-md bg-[#0a101b] text-[10px] font-mono text-slate-300">
                  {pipelineCounts.all}
                </span>
              </button>

              {/* Incoming Tab */}
              <button
                type="button"
                onClick={() => { setPipeline('Incoming'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  pipeline === 'Incoming'
                    ? 'bg-[#122b22] text-emerald-300 border border-[#1d4737] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-27'
                }`}
                id="tab-pipeline-incoming"
              >
                <span>Incoming</span>
                <span className="px-1.5 py-0.2 rounded-md bg-[#091712] text-[10px] font-mono text-emerald-400">
                  {pipelineCounts.incoming}
                </span>
              </button>

              {/* Outgoing Tab */}
              <button
                type="button"
                onClick={() => { setPipeline('Outgoing'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  pipeline === 'Outgoing'
                    ? 'bg-[#2b1818] text-rose-300 border border-[#4a2424] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-27'
                }`}
                id="tab-pipeline-outgoing"
              >
                <span>Outgoing</span>
                <span className="px-1.5 py-0.2 rounded-md bg-[#170a0a] text-[10px] font-mono text-rose-400">
                  {pipelineCounts.outgoing}
                </span>
              </button>

              {/* System Tab */}
              <button
                type="button"
                onClick={() => { setPipeline('System'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  pipeline === 'System'
                    ? 'bg-[#152336] text-cyan-300 border border-[#213957] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-27'
                }`}
                id="tab-pipeline-system"
              >
                <span>System</span>
                <span className="px-1.5 py-0.2 rounded-md bg-[#09111c] text-[10px] font-mono text-cyan-400">
                  {pipelineCounts.system}
                </span>
              </button>

              <span className="text-slate-600 text-xs px-1 select-none">&gt;</span>
            </div>
          </div>

          {/* Filters Bar: Search Box, User Filter, Category Filter, Payment Methods */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Search box */}
            <div className="sm:col-span-6 relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search by reason, category, user, note, amount..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-surface-4 border border-[#1e2e45] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                id="input-ledger-search"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* User Dropdown */}
            <div className="sm:col-span-2">
              <select
                value={selectedUser}
                onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 rounded-xl bg-surface-4 border border-[#1e2e45] text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                id="select-filter-user"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Category Dropdown */}
            <div className="sm:col-span-2">
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 rounded-xl bg-surface-4 border border-[#1e2e45] text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                id="select-filter-category"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Payment Methods Dropdown */}
            <div className="sm:col-span-2">
              <select
                value={selectedPaymentType}
                onChange={(e) => { setSelectedPaymentType(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 rounded-xl bg-surface-4 border border-[#1e2e45] text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                id="select-filter-payment"
              >
                <option value="all">All Payments</option>
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        {/* User requirement: "bellow from it an attributes fro each entry such as date with slightly pade time, amount, created by, payment type, type, category, reason, note and document. do not include the action attribute(ingore it)." */}
        <div className="overflow-x-auto rounded-xl border border-edge-11 bg-surface-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0e1625] text-slate-400 font-semibold border-b border-edge-11">
              <tr>
                <th className="py-3 px-3.5 whitespace-nowrap">Date</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Amount</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Created By</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Payment Type</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Type</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Category</th>
                <th className="py-3 px-3.5 whitespace-nowrap min-w-[200px]">Reason</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Note</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#152236]">
              {displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No transactions match your current filters.
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx) => (
                  <tr 
                    key={tx.id} 
                    className="hover:bg-[#0f1929] transition-colors"
                  >
                    {/* 1. Date with slightly faded time underneath */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                      <div className="font-medium text-slate-200">{tx.date}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{tx.time}</div>
                    </td>

                    {/* 2. Amount */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-white align-middle">
                      {formatPKR(tx.amount)}
                    </td>

                    {/* 3. Created By */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-300 align-middle">
                      {tx.createdBy}
                    </td>

                    {/* 4. Payment Type */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        tx.paymentType === 'Cash' 
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : tx.paymentType === 'Online'
                          ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                          : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      }`}>
                        {tx.paymentType}
                      </span>
                    </td>

                    {/* 5. Type (Incoming / Outgoing / System) */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        tx.type === 'Incoming'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : tx.type === 'Outgoing'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-cyan-500/10 text-cyan-400'
                      }`}>
                        {tx.type}
                      </span>
                    </td>

                    {/* 6. Category */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-400 align-middle">
                      {tx.category || '-'}
                    </td>

                    {/* 7. Reason */}
                    <td className="py-3 px-3.5 text-slate-200 font-medium align-middle">
                      <span className="line-clamp-1" title={tx.reason}>
                        {tx.reason}
                      </span>
                    </td>

                    {/* 8. Note */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-400 text-[11px] align-middle">
                      {tx.note ? (
                        <span className="line-clamp-1 max-w-[120px]" title={tx.note}>
                          {tx.note}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 9. Document */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                      {tx.document ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDocTransaction(tx)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#142236] hover:bg-[#1a2d48] border border-[#223755] text-[11px] font-medium text-slate-200 hover:text-white transition-all cursor-pointer"
                          title={`View ${tx.document.name}`}
                        >
                          <FileText className="w-3 h-3 text-blue-400" />
                          <span>Invoice</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          No Receipt
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 pt-2">
          <div>
            Showing <span className="font-semibold text-white">{displayedTransactions.length}</span> of{' '}
            <span className="font-semibold text-white">{filteredTransactions.length}</span> entries
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-surface-20 hover:bg-[#1a263c] border border-[#1f304c] text-slate-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-mono text-white text-xs">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-surface-20 hover:bg-[#1a263c] border border-[#1f304c] text-slate-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Record Income / Record Expense Modal */}
      {isRecordModalOpen && (
        <RecordTransactionModal
          isOpen={true}
          initialType={recordModalInitialType}
          onClose={() => setIsRecordModalOpen(false)}
          onSubmit={handleCreateTransaction}
        />
      )}

      {/* Document / Invoice Viewer Modal */}
      {selectedDocTransaction && (
        <LedgerDocumentModal
          isOpen={true}
          transaction={selectedDocTransaction}
          onClose={() => setSelectedDocTransaction(null)}
        />
      )}
    </div>
  );
};
