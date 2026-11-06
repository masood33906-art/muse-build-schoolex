import React, { useState, useMemo, useEffect } from 'react';
import { X, Receipt } from 'lucide-react';
import { GeneratedChallan, getGeneratedChallans } from '../utils/challanStore';
import { formatPKR, FamilyFeeSummary } from '../utils/feeHelper';
import { Student, PaymentMethod } from '../types';
import { localISODate } from '../utils/dates';

export interface ChallanPaymentPayload {
  selectedChallans: GeneratedChallan[];
  paymentInfo: {
    amount: number;
    method: PaymentMethod;
    date: string;
    notes?: string;
  };
}

interface GetChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  families: FamilyFeeSummary[];
  onPayAndDeduct: (payload: ChallanPaymentPayload) => void;
}

export const GetChallanModal: React.FC<GetChallanModalProps> = ({
  isOpen,
  onClose,
  students,
  families,
  onPayAndDeduct
}) => {
  // Raw text input of space-separated Challan IDs
  const [challanInput, setChallanInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [date, setDate] = useState<string>(() => localISODate());

  // Store of all generated challans
  const [allChallans, setAllChallans] = useState<GeneratedChallan[]>([]);

  // Load challans from store on open
  useEffect(() => {
    if (isOpen) {
      const list = getGeneratedChallans();
      setAllChallans(list);
      setChallanInput('');
      setMethod('Cash');
      setDate(localISODate());
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Parse entered tokens (space-separated, also supporting commas/newlines)
  const enteredTokens = useMemo(() => {
    return challanInput
      .split(/[\s,]+/)
      .map(t => t.trim())
      .filter(Boolean);
  }, [challanInput]);

  // Match entered tokens against generated challans
  const matchedChallans = useMemo(() => {
    if (enteredTokens.length === 0) return [];

    const matchedSet = new Map<string, GeneratedChallan>();

    enteredTokens.forEach(token => {
      const lower = token.toLowerCase();
      const found = allChallans.filter(c => {
        const cNum = c.challanNumber.toLowerCase();
        const cId = c.id.toLowerCase();
        const tId = c.targetId.toLowerCase();
        const fId = (c.familyId || '').toLowerCase();
        return (
          cNum === lower ||
          cId === lower ||
          tId === lower ||
          fId === lower ||
          cNum.includes(lower) ||
          cId.includes(lower)
        );
      });

      found.forEach(c => {
        matchedSet.set(c.id, c);
      });
    });

    return Array.from(matchedSet.values());
  }, [enteredTokens, allChallans]);

  // Compute members with names only and total due on that challan against that member
  const membersToDisplay = useMemo(() => {
    const items: Array<{
      challanId: string;
      challanNumber: string;
      memberName: string;
      totalDue: number;
      status: string;
      originalChallan: GeneratedChallan;
    }> = [];

    matchedChallans.forEach(c => {
      if (c.studentNames && c.studentNames.length > 0) {
        if (c.studentNames.length === 1) {
          items.push({
            challanId: c.id,
            challanNumber: c.challanNumber,
            memberName: c.studentNames[0],
            totalDue: c.amount,
            status: c.status,
            originalChallan: c
          });
        } else {
          const perStudentDue = Math.round(c.amount / c.studentNames.length);
          c.studentNames.forEach((name, i) => {
            items.push({
              challanId: `${c.id}-${i}`,
              challanNumber: c.challanNumber,
              memberName: name,
              totalDue: perStudentDue,
              status: c.status,
              originalChallan: c
            });
          });
        }
      } else {
        items.push({
          challanId: c.id,
          challanNumber: c.challanNumber,
          memberName: c.targetName,
          totalDue: c.amount,
          status: c.status,
          originalChallan: c
        });
      }
    });

    return items;
  }, [matchedChallans]);

  // Total due across all matched challans
  const totalPayableDue = useMemo(() => {
    return matchedChallans.reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [matchedChallans]);

  // Handle Pay All Dues
  const handlePayAll = () => {
    if (matchedChallans.length === 0) return;
    setIsSubmitting(true);

    onPayAndDeduct({
      selectedChallans: matchedChallans,
      paymentInfo: {
        amount: totalPayableDue,
        method,
        date
      }
    });

    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-[#0d1422] border border-[#202f47] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col animate-in zoom-in-95 duration-150"
        id="modal-get-challan-minimal"
      >
        {/* Header - Strictly minimal */}
        <div className="px-5 py-3.5 bg-[#121b2b] border-b border-[#1b283d] flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>Get Challan</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2538] transition-colors cursor-pointer"
            id="btn-close-get-challan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Input field for space-separated Challan ID(s) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Challan ID(s)
            </label>
            <input
              type="text"
              autoFocus
              value={challanInput}
              onChange={(e) => setChallanInput(e.target.value)}
              placeholder="Enter Challan ID(s) separated by space..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080d16] border border-[#22334b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all"
              id="input-challan-ids"
            />
            {allChallans.length > 0 && !challanInput && (
              <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-500 pt-0.5">
                <span>Available IDs:</span>
                {allChallans.slice(0, 3).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChallanInput(prev => prev ? `${prev} ${c.challanNumber}` : c.challanNumber)}
                    className="text-emerald-400 hover:underline font-mono"
                  >
                    {c.challanNumber}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Members Display Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Members</span>
              {matchedChallans.length > 0 && (
                <span className="text-slate-400 text-[11px]">
                  {membersToDisplay.length} member(s)
                </span>
              )}
            </div>

            <div 
              className="p-3 bg-[#080d16] border border-[#1b283d] rounded-xl min-h-[120px] max-h-[220px] overflow-y-auto divide-y divide-[#152236]"
              id="container-challan-members"
            >
              {enteredTokens.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-slate-500 text-xs text-center">
                  Type one or more Challan IDs above with space
                </div>
              ) : membersToDisplay.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-slate-500 text-xs text-center">
                  No matching challan found for &quot;{enteredTokens.join(', ')}&quot;
                </div>
              ) : (
                membersToDisplay.map((item, idx) => (
                  <div 
                    key={`${item.challanId}-${idx}`} 
                    className="py-2 first:pt-1 last:pb-1 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-white">
                      {item.memberName}
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatPKR(item.totalDue)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payment Method & Date */}
          {matchedChallans.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#080d16] border border-[#22334b] text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Online">Online</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#080d16] border border-[#22334b] text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Total Payable Summary */}
          {matchedChallans.length > 0 && (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#131f31] border border-[#1f314c] text-xs">
              <span className="font-semibold text-slate-300">Total Payable</span>
              <span className="text-sm font-black font-mono text-emerald-400">
                {formatPKR(totalPayableDue)}
              </span>
            </div>
          )}

          {/* Actions: Cancel & Pay */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#172337]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#141d2c] hover:bg-[#1a263a] border border-[#23354e] text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-all"
              id="btn-cancel-get-challan"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePayAll}
              disabled={matchedChallans.length === 0 || isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold shadow-lg shadow-emerald-600/25 cursor-pointer transition-all"
              id="btn-pay-challans-members"
            >
              Pay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
