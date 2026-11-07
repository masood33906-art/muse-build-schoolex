import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Check, Plus, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { LedgerTransaction, LedgerDocument } from '../utils/ledgerStore';

interface RecordTransactionModalProps {
  isOpen: boolean;
  type?: 'Incoming' | 'Outgoing';
  initialType?: 'Incoming' | 'Outgoing';
  onClose: () => void;
  onSubmit: (transaction: Omit<LedgerTransaction, 'id' | 'timestamp'>) => void;
}

const COMMON_INCOME_CATEGORIES = [
  'Monthly Fee',
  'Admission Fee',
  'Annual Charges',
  'Security Deposit',
  'Student Fund',
  'Uniform & Books',
  'Transport / Convey',
  'Donation & Grant',
  'Other Income'
];

const COMMON_EXPENSE_CATEGORIES = [
  'Electricity Bill',
  'Staff Salary',
  'School Maintenance',
  'Exam & Stationery',
  'Rent / Building Lease',
  'Internet & Phone',
  'Generator Fuel',
  'Events & Sports',
  'Marketing & Ads',
  'Other Expense'
];

export const RecordTransactionModal: React.FC<RecordTransactionModalProps> = ({
  isOpen,
  type,
  initialType,
  onClose,
  onSubmit
}) => {
  const [activeType, setActiveType] = useState<'Incoming' | 'Outgoing'>(() => initialType || type || 'Incoming');

  useEffect(() => {
    if (type) {
      setActiveType(type);
    } else if (initialType) {
      setActiveType(initialType);
    }
  }, [type, initialType, isOpen]);

  const isIncome = activeType === 'Incoming';

  // Form states
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [paymentType, setPaymentType] = useState<LedgerTransaction['paymentType']>('Cash');
  const [note, setNote] = useState<string>('');
  const [uploadedDoc, setUploadedDoc] = useState<LedgerDocument | null>(null);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Document size must be under 5 MB.');
      return;
    }

    try {
      const { nextSequential } = await import('../utils/ids');
      const { putFile } = await import('../utils/blobStore');
      const fileId = nextSequential('FILE');
      await putFile(fileId, file);
      setUploadedDoc({
        name: file.name,
        type: 'Invoice',
        fileId,
        uploadDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      });
      setError('');
    } catch {
      setError('Failed to store document.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    // Format date string for display (e.g. 17 Sep 2026)
    const dateObj = new Date(date + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const formattedTime = `${hours % 12 || 12}:${minutes < 10 ? '0' : ''}${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;

    onSubmit({
      date: formattedDate,
      rawDate: date,
      time: formattedTime,
      amount: numAmount,
      createdBy: 'Demo school',
      paymentType,
      type: isIncome ? 'Incoming' : 'Outgoing',
      category: category.trim() || undefined,
      reason: isIncome ? description.trim() : (description.startsWith('Expense:') ? description.trim() : `Expense: ${description.trim()}`),
      note: note.trim() || undefined,
      document: uploadedDoc || undefined
    });

    onClose();
  };

  const categories = isIncome ? COMMON_INCOME_CATEGORIES : COMMON_EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-[#0d1422] border border-[#1f304a] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col animate-in zoom-in-95 duration-150"
        id={`modal-record-${activeType.toLowerCase()}`}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-surface-20 border-b border-edge-11 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <span className={`w-2.5 h-2.5 rounded-full ${isIncome ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span>Record {isIncome ? 'Income' : 'Expense'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-43 transition-colors cursor-pointer"
            id="btn-close-record-transaction"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Segmented Switcher: Income vs Expense */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface-1 rounded-xl border border-edge-15">
            <button
              type="button"
              onClick={() => {
                setActiveType('Incoming');
                setError('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isIncome
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              id="btn-switch-modal-income"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Income</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveType('Outgoing');
                setError('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !isIncome
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              id="btn-switch-modal-expense"
            >
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Expense</span>
            </button>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Amount (Required) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Amount (PKR) *</span>
              <span className="text-[11px] text-slate-500 font-normal">Must be &gt; 0</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-1 border border-edge-29 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition-all"
                id="input-record-amount"
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-mono">
                PKR
              </span>
            </div>
          </div>

          {/* Description (Must) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Description / Reason *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isIncome ? "e.g. Tuition Fee Collection or Donation" : "e.g. ELECTRICITY BILL, Lab Maintenance"}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-1 border border-edge-29 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              id="input-record-description"
            />
          </div>

          {/* Category (Optional) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Category (Optional)</span>
              <span className="text-[10px] text-slate-500 font-normal">Select or type custom</span>
            </label>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-surface-1 border border-edge-29 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                id="select-record-category"
              >
                <option value="">None / Custom</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Or custom category"
                className="flex-1 px-3 py-2 rounded-xl bg-surface-1 border border-edge-29 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                id="input-record-custom-category"
              />
            </div>
          </div>

          {/* Date (Default Current) & Payment Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Date (Default Current)
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-1 border border-edge-29 text-xs text-white focus:outline-none focus:border-blue-500"
                id="input-record-date"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Payment Type
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-surface-1 border border-edge-29 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                id="select-record-payment-type"
              >
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Optional Note */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note, voucher reference, etc."
              className="w-full px-3.5 py-2 rounded-xl bg-surface-1 border border-edge-29 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              id="input-record-note"
            />
          </div>

          {/* Option to Upload Document / Invoice */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Upload Document (Invoice / Receipt)</span>
              <span className="text-[10px] text-slate-500">Optional</span>
            </label>

            {uploadedDoc ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-33 border border-[#233857] text-xs">
                <div className="flex items-center gap-2 text-white truncate max-w-[280px]">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">{uploadedDoc.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedDoc(null)}
                  className="text-slate-400 hover:text-rose-400 p-1 rounded transition-colors"
                  title="Remove uploaded document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-3 border border-dashed border-[#233857] hover:border-blue-500 rounded-xl bg-surface-4 cursor-pointer transition-colors group">
                <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-400 mb-1 transition-colors" />
                <span className="text-[11px] text-slate-400 group-hover:text-slate-200">
                  Click to select or drag invoice file (PDF or Image)
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="input-file-invoice"
                />
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#172337]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#141d2c] hover:bg-surface-44 border border-edge-35 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-all"
              id="btn-cancel-record"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer transition-all ${
                isIncome 
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25' 
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
              }`}
              id="btn-submit-record"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record {isIncome ? 'Income' : 'Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
