import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  CheckCircle2, 
  Calendar, 
  Printer
} from 'lucide-react';
import { formatPKR } from '../utils/feeHelper';
import { localISODate } from '../utils/dates';
import { PaymentMethod } from '../types';

interface FeePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  familyOrStudentName: string;
  identifier: string; // Family ID or Student ID
  totalDue: number;
  totalPaid: number;
  availableCredit?: number;
  onRecordPayment: (payment: {
    amount: number;
    method: PaymentMethod;
    date: string;
    notes?: string;
    useCredit?: boolean;
  }) => void;
  onPrintChallan?: () => void;
}

export const FeePaymentModal: React.FC<FeePaymentModalProps> = ({
  isOpen,
  onClose,
  title,
  familyOrStudentName,
  identifier,
  totalDue,
  totalPaid,
  availableCredit = 0,
  onRecordPayment,
  onPrintChallan
}) => {
  const [amount, setAmount] = useState<number>(totalDue > 0 ? totalDue : 5000);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [date, setDate] = useState<string>(() => localISODate());
  const [notes, setNotes] = useState<string>('Monthly tuition fee installment');
  const [useCredit, setUseCredit] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(totalDue > 0 ? totalDue : 5000);
      setDate(localISODate());
      setUseCredit(false);
    }
  }, [isOpen, totalDue]);

  if (!isOpen) return null;

  const creditApplied = useCredit ? Math.min(availableCredit, totalDue) : 0;
  const effectiveDueAfterCredit = Math.max(0, totalDue - creditApplied);
  const extraCreditSaved = Math.max(0, amount - effectiveDueAfterCredit);
  const remainingAfterPayment = Math.max(0, effectiveDueAfterCredit - amount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < 0 || (amount === 0 && !useCredit)) return;
    onRecordPayment({
      amount: Number(amount),
      method,
      date,
      notes,
      useCredit
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0f1725] border border-[#202f47] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col animate-in zoom-in-95 duration-200"
        id="modal-fee-payment"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#141e30] border-b border-[#1f2e46] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Record Fee Payment
              </h2>
              <p className="text-xs text-slate-400">
                {title} • {familyOrStudentName} ({identifier})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f2b3e] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Balance Overview */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-[#141d2c] border border-[#21314a] rounded-xl text-center">
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Current Due</span>
                <span className="text-sm font-bold text-red-400">{formatPKR(totalDue)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Total Paid</span>
                <span className="text-sm font-bold text-emerald-400">{formatPKR(totalPaid)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Remaining After</span>
                <span className="text-sm font-bold text-blue-400">{formatPKR(remainingAfterPayment)}</span>
              </div>
            </div>

            {availableCredit > 0 && (
              <label className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useCredit}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setUseCredit(next);
                      if (next) {
                        setAmount(Math.max(0, totalDue - Math.min(availableCredit, totalDue)));
                      } else {
                        setAmount(totalDue);
                      }
                    }}
                    className="rounded border-emerald-500/50 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-emerald-300">
                    Use available credit ({formatPKR(availableCredit)})
                  </span>
                </div>
                {useCredit && (
                  <span className="text-[11px] font-bold text-emerald-400">
                    -{formatPKR(creditApplied)}
                  </span>
                )}
              </label>
            )}

            {/* Payment Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Amount (PKR) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-bold">Rs.</span>
                <input
                  type="number"
                  min={useCredit ? "0" : "1"}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  className="w-full pl-11 pr-3.5 py-2.5 rounded-xl bg-[#141e30] border border-[#243753] text-white text-base font-bold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
              {extraCreditSaved > 0 && (
                <p className="mt-1.5 text-xs font-semibold text-emerald-400">
                  Rs {extraCreditSaved.toLocaleString()} extra will be saved as credit
                </p>
              )}
              {/* Quick Amount Buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setAmount(effectiveDueAfterCredit)}
                  className="px-2.5 py-1 rounded-lg bg-[#1a2537] hover:bg-[#22334b] border border-[#273852] text-[11px] font-semibold text-emerald-400 cursor-pointer"
                >
                  Full Due ({formatPKR(effectiveDueAfterCredit)})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(Math.round(effectiveDueAfterCredit / 2))}
                  className="px-2.5 py-1 rounded-lg bg-[#1a2537] hover:bg-[#22334b] border border-[#273852] text-[11px] font-semibold text-blue-300 cursor-pointer"
                >
                  50% Due
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(5000)}
                  className="px-2.5 py-1 rounded-lg bg-[#1a2537] hover:bg-[#22334b] border border-[#273852] text-[11px] font-semibold text-slate-300 cursor-pointer"
                >
                  5,000 PKR
                </button>
              </div>
            </div>

            {/* Payment Method & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e30] border border-[#243753] text-white text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="Cash">Cash (Accounts Counter)</option>
                  <option value="Bank Transfer">Bank Transfer (Meezan / HBL)</option>
                  <option value="Online">Online Transfer</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="Cheque">Bank Cheque / Pay Order</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Payment Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141e30] border border-[#243753] text-white text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Remarks / Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Remarks / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid in full for current term"
                className="w-full px-3.5 py-2 rounded-xl bg-[#141e30] border border-[#243753] text-white text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-[#141e30] border-t border-[#1f2e46] flex items-center justify-between">
            {onPrintChallan && (
              <button
                type="button"
                onClick={onPrintChallan}
                className="px-3 py-2 rounded-xl bg-[#1c2738] hover:bg-[#25344a] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Challan Slip</span>
              </button>
            )}
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1c2738] hover:bg-[#25344a] text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                id="btn-confirm-record-payment"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Record</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
